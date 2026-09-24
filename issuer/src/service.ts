// service.ts: the issuance service — the only place that holds a provider key.
// Takes a consented lookup, runs the real Croma adapters, and returns answers
// signed by the issuer. The phone never sees a key and never calls a registry.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { chargeableMinor, paymentRef, quote } from "./pricing.ts";
import {
  createMemorySpentPayments,
  paymentTerms,
  quotedAmountStroops,
  verifyPayment,
  type PaymentPolicy,
  type SpentPayments,
} from "./payments.ts";
import { checkAccess, createMemoryRequestQuota, type AccessPolicy, type RequestQuota } from "./access.ts";
import { createMemoryIssuanceCache, issuanceCacheKey, type IssuanceCache } from "./cache.ts";
import { noNotifier, type Notifier } from "./notify.ts";
import { poseidonHash, sha256Hash } from "@knowni/core/node";
import type { SessionRequest } from "@knowni/core";
import { toHex } from "@knowni/core";
import { attestResults, type AttestedAnswer } from "@knowni/attestation";
import { nodeSignatures } from "@knowni/attestation/node";
import {
  createCromaClient,
  createRegistraduriaPersonhoodSource,
  createSanctionsSource,
  createSicaacCapacitySource,
  createVehicleStandingSource,
} from "@knowni/sources";

export interface IssuerOptions {
  readonly apiKey: string;
  readonly issuerId: string;
  readonly seed: Uint8Array;
  readonly fetchImpl?: typeof fetch;
  // Absent means the service answers without charging — the shape a demo and
  // a pilot need before a treasury account exists.
  readonly payments?: PaymentPolicy;
  readonly spentPayments?: SpentPayments;
  readonly notifier?: Notifier;
  // Absent means /issue refuses every call: with nobody named as a relying
  // party, "anyone with the URL" is not a caller this service recognizes.
  readonly access?: AccessPolicy;
  readonly requestQuota?: RequestQuota;
  readonly issuanceCache?: IssuanceCache<IssuanceResponse>;
  // How long one source has before the issuance stops waiting for it. A bound,
  // not a measurement: it exists so one slow source cannot hold the other
  // three — and the buyer — hostage. See D-41.
  readonly sourceDeadlineMs?: number;
}

export interface IssuanceResponse {
  readonly results: ReturnType<typeof attestResults>;
  readonly chargedMinor: number;
}

class IssueHttpError extends Error {
  readonly statusCode: number;
  readonly responseBody: Readonly<Record<string, string>>;

  constructor(statusCode: number, responseBody: Readonly<Record<string, string>>) {
    super("issuance refused");
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export interface IssueRequestBody {
  readonly documentKind: string;
  readonly documentNumber: string;
  readonly plate?: string;
  // What the subject ticked. A source with no consent is not queried at all,
  // which is the difference between a product and a lookup service.
  readonly consented: readonly string[];
  readonly request: SessionRequest;
  // The transaction that paid for this question. Required when the service
  // runs with a payment policy.
  readonly paymentTx?: string;
  // Where to send the "your answer is ready" notice, if the subject asked for
  // one. Optional, per-request, and never stored with the consultation.
  readonly notifyPhone?: string;
}

const WHAT_IT_DOES_NOT_SAY = new Map<string, string>([
  ["personhood", "No dice quién es, ni su edad, ni su domicilio."],
  ["capacity", "No afirma capacidad jurídica universal, solo ausencia de insolvencia."],
  ["sanctions", "Solo las listas solicitadas, en la fecha consultada."],
  ["assetStanding", "Registro y alertas del vehículo. No dice quién es el dueño."],
]);

// A degraded source becomes `unavailable`, never `false`: "no sabemos" y "no
// cumple" son respuestas distintas y el producto entero depende de no
// confundirlas.
function answerOf(predicate: string, source: string, value: boolean | "unavailable"): AttestedAnswer {
  return {
    predicate,
    value,
    source,
    provenance: "observed",
    doesNotEstimate: WHAT_IT_DOES_NOT_SAY.get(predicate) ?? "",
  };
}

export const DEFAULT_SOURCE_DEADLINE_MS = 60_000;

// A source that runs out of time answers `unavailable` — never `false`. The
// difference is the whole product: "we could not ask" is not "the answer is
// no", and an unavailable answer is not charged either. See pricing.ts.
interface SourceTask {
  readonly predicate: string;
  readonly sourceId: string;
  run(): Promise<AttestedAnswer>;
}

async function withDeadline(task: SourceTask, deadlineMs: number): Promise<AttestedAnswer> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const started = task.run();
  // A rejection is the adapter's own failure and reads as unavailable too;
  // nothing above this line ever sees it.
  const settled = started.catch(() => answerOf(task.predicate, task.sourceId, "unavailable"));
  const expired = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), deadlineMs);
  });
  try {
    return (await Promise.race([settled, expired])) ?? answerOf(task.predicate, task.sourceId, "unavailable");
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function issueAnswers(
  options: IssuerOptions,
  body: IssueRequestBody,
  nowUnix: number,
): Promise<{ readonly answers: readonly AttestedAnswer[]; readonly results: ReturnType<typeof attestResults> }> {
  const client = createCromaClient({ apiKey: options.apiKey, fetchImpl: options.fetchImpl });
  const subject = {
    documentKind: body.documentKind,
    documentNumber: body.documentNumber,
    // An element, not a digest: this reference ends up inside a claim, and a
    // claim is committed in the field. A 256-bit hash does not fit one.
    subjectRef: poseidonHash.toHex(
      poseidonHash.hashFields("subjectRef", [
        poseidonHash.element(`${body.documentKind}:${body.documentNumber}`),
      ]),
    ),
  };

  // One task per consented source, all in flight at once. They were sequential
  // and four of them took 83 s; nothing about them needs the previous answer.
  const tasks: SourceTask[] = [];

  if (body.consented.includes("registraduria")) {
    tasks.push({ predicate: "personhood", sourceId: "registraduria", run: async () => {
      const result = await createRegistraduriaPersonhoodSource(client).fetch(subject, nowUnix);
      return answerOf(
        "personhood",
        "registraduria",
        result.status === "claimed" && result.claim.kind === "identity"
          ? result.claim.documentValid && result.claim.subjectAlive && result.claim.ofAge
          : "unavailable",
      );
    } });
  }

  if (body.consented.includes("sicaac")) {
    tasks.push({ predicate: "capacity", sourceId: "sicaac", run: async () => {
      const result = await createSicaacCapacitySource(client).fetch(subject, nowUnix);
      return answerOf(
        "capacity",
        "sicaac",
        result.status === "claimed" && result.claim.kind === "capacity" ? !result.claim.restricted : "unavailable",
      );
    } });
  }

  if (body.consented.includes("listas")) {
    tasks.push({ predicate: "sanctions", sourceId: "procuraduria+contraloria+contaduria", run: async () => {
      const result = await createSanctionsSource(client, poseidonHash).fetch(subject, nowUnix);
      return answerOf(
        "sanctions",
        "procuraduria+contraloria+contaduria",
        result.status === "claimed" && result.claim.kind === "standing" ? !result.claim.listed : "unavailable",
      );
    } });
  }

  if (body.consented.includes("vehiculo") && body.plate !== undefined) {
    const plate = body.plate;
    tasks.push({ predicate: "assetStanding", sourceId: "runt+simit", run: async () => {
      const result = await createVehicleStandingSource(client).fetch(
        {
          plate,
          ownerDocumentNumber: body.documentNumber,
          assetRef: sha256Hash.hash("knowni/asset-ref/v1", [new TextEncoder().encode(plate)]),
        },
        nowUnix,
      );
      return answerOf(
        "assetStanding",
        "runt+simit",
        result.status === "claimed" && result.claim.kind === "assetStanding"
          ? result.claim.registered && !result.claim.encumbered && !result.claim.finesOutstanding
          : "unavailable",
      );
    } });
  }

  // `Promise.all` keeps the order of the tasks, not of their answers, so the
  // envelope is the same whichever source lands first.
  const answers: readonly AttestedAnswer[] = await Promise.all(
    tasks.map((task) => withDeadline(task, options.sourceDeadlineMs ?? DEFAULT_SOURCE_DEADLINE_MS)),
  );

  const results = attestResults(sha256Hash, nodeSignatures, options.seed, {
    issuerId: options.issuerId,
    request: body.request,
    answers,
    issuedAt: nowUnix,
    expiresAt: nowUnix + 300,
  });

  // The raw provider responses are gone by here: each adapter reduced its own
  // and nothing above the port ever held one.
  return { answers, results };
}

function send(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Knowni-Access-Key",
  });
  response.end(payload);
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return undefined;
  }
}

// The predicates a set of consented sources can answer. The price and the
// payment reference are computed from these, never from what the caller says
// it is buying.
// A `Map` and not an object literal: the caller chooses these keys, and
// `"constructor"` indexed into an object literal answers with a function,
// which then priced and hashed as if it were a predicate.
const SOURCE_PREDICATE = new Map<string, string>([
  ["registraduria", "personhood"],
  ["sicaac", "capacity"],
  ["listas", "sanctions"],
  ["vehiculo", "assetStanding"],
]);

export function predicatesOf(consented: readonly string[]): readonly string[] {
  return consented.map((source) => SOURCE_PREDICATE.get(source)).filter((p): p is string => p !== undefined);
}

export function createIssuerService(options: IssuerOptions) {
  const publicKey = nodeSignatures.publicKeyOf(options.seed);
  const spent = options.spentPayments ?? createMemorySpentPayments();
  const notifier = options.notifier ?? noNotifier;
  const quota = options.requestQuota ?? createMemoryRequestQuota();
  const cache = options.issuanceCache ?? createMemoryIssuanceCache<IssuanceResponse>();

  const handle = async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method === "OPTIONS") return send(response, 204, {});

    // The registry the wallet resolves the issuer against. Public by design:
    // a key nobody can look up is a signature nobody can check.
    if (request.method === "GET" && request.url?.startsWith("/keys")) {
      return send(response, 200, { issuerId: options.issuerId, publicKey: toHex(publicKey) });
    }

    // Quoted before the subject is asked to consent: the payer sees the total
    // before a single source is called.
    if (request.method === "POST" && request.url?.startsWith("/quote")) {
      const body = (await readBody(request)) as
        | { predicates?: string[]; request?: SessionRequest }
        | undefined;
      if (body?.request === undefined || !Array.isArray(body.predicates)) {
        return send(response, 400, { error: "invalid_request" });
      }
      const result = quote(body.request, body.predicates, Math.floor(Date.now() / 1000));
      if (result.status !== "quoted") return send(response, 400, { error: result.reason });
      try {
        return send(response, 200, {
          quote: result.quote,
          paymentRequired: options.payments !== undefined,
          payment:
            options.payments === undefined
              ? undefined
              : paymentTerms(result.quote.totalMinor, result.quote.paymentRef, result.quote.currency, options.payments),
        });
      } catch {
        return send(response, 503, { error: "payment_misconfigured" });
      }
    }

    if (request.method === "POST" && request.url?.startsWith("/issue")) {
      // Checked before the body is even read: an unrecognized or throttled
      // caller never reaches consent, payment or a single call to Croma.
      const keyHeader = request.headers["x-knowni-access-key"];
      const callerKey = typeof keyHeader === "string" ? keyHeader : undefined;
      const access =
        options.access === undefined
          ? { status: "refused" as const, reason: "missing_key" as const }
          : checkAccess(
              callerKey,
              options.access,
              quota,
              Math.floor(Date.now() / 1000),
            );
      if (access.status === "refused") {
        return send(response, access.reason === "rate_limited" ? 429 : 401, { error: access.reason });
      }
      if (callerKey === undefined) return send(response, 401, { error: "missing_key" });

      const body = (await readBody(request)) as IssueRequestBody | undefined;
      if (body === undefined || typeof body.documentNumber !== "string" || body.request === undefined) {
        return send(response, 400, { error: "invalid_request" });
      }
      if (!Array.isArray(body.consented) || body.consented.length === 0) {
        return send(response, 400, { error: "consent_missing" });
      }
      const nowUnix = Math.floor(Date.now() / 1000);
      const predicates = predicatesOf(body.consented);
      const expected = paymentRef(body.request, predicates);
      const key = issuanceCacheKey(options.seed, {
        accessKey: callerKey,
        documentKind: body.documentKind,
        documentNumber: body.documentNumber,
        plate: body.plate,
        consented: body.consented,
        paymentRef: expected,
        paymentTx: body.paymentTx,
      });
      try {
        const resolved = await cache.resolve(key, nowUnix, async () => {
          // Paid before consulted: the sources cost money and a question nobody
          // paid for is a question nobody asked. Only the producer reaches here;
          // identical concurrent retries await it instead of spending twice.
          if (options.payments !== undefined) {
            if (typeof body.paymentTx !== "string") {
              throw new IssueHttpError(402, { error: "payment_required" });
            }
            const expectedQuote = quote(body.request, predicates, nowUnix);
            if (expectedQuote.status !== "quoted") {
              throw new IssueHttpError(400, { error: expectedQuote.reason });
            }
            const paid = await verifyPayment(
              body.paymentTx,
              expected,
              {
                ...options.payments,
                minAmountStroops: quotedAmountStroops(expectedQuote.quote.totalMinor, options.payments),
              },
              spent,
            );
            if (paid.status === "refused") {
              throw new IssueHttpError(402, { error: "payment_refused", reason: paid.reason });
            }
            // The spend must be on disk before Croma is touched: between the
            // claim and the write there is a window where a crash makes a
            // redeemed transaction redeemable again. D-38.
            try {
              await spent.settled?.();
            } catch {
              throw new IssueHttpError(503, { error: "payment_not_durable" });
            }
          }

          const { answers, results } = await issueAnswers(options, body, nowUnix);
          // The notice says an answer is ready and nothing more; a failure to
          // send it is not a failure to issue. A cache hit never sends it twice.
          if (typeof body.notifyPhone === "string" && body.notifyPhone !== "") {
            void notifier.notify(body.notifyPhone, results.sessionId);
          }
          return {
            value: { results, chargedMinor: chargeableMinor(answers) },
            expiresAt: results.expiresAt,
          };
        });
        return send(response, 200, resolved.value);
      } catch (error) {
        if (error instanceof IssueHttpError) return send(response, error.statusCode, error.responseBody);
        // Nothing from a provider crosses this boundary, not even in a 500.
        return send(response, 502, { error: "issuance_failed" });
      }
    }

    return send(response, 404, { error: "not_found" });
  };

  // The listener returns void: a rejection that escapes `handle` would land as
  // an unhandled rejection and take the process down instead of the request.
  return createServer((request, response) => {
    void handle(request, response).catch(() => send(response, 500, { error: "internal_error" }));
  });
}
