// service.ts: the issuance service — the only place that holds a provider key.
// Takes a consented lookup, runs the real Croma adapters, and returns answers
// signed by the issuer. The phone never sees a key and never calls a registry.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { chargeableMinor, paymentRef, quote } from "./pricing.ts";
import { createMemorySpentPayments, verifyPayment, type PaymentPolicy, type SpentPayments } from "./payments.ts";
import { noNotifier, type Notifier } from "./notify.ts";
import { sha256Hash } from "@knowni/core/node";
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

const WHAT_IT_DOES_NOT_SAY: Record<string, string> = {
  personhood: "No dice quién es, ni su edad, ni su domicilio.",
  capacity: "No afirma capacidad jurídica universal, solo ausencia de insolvencia.",
  sanctions: "Solo las listas solicitadas, en la fecha consultada.",
  assetStanding: "Registro y alertas del vehículo. No dice quién es el dueño.",
};

// A degraded source becomes `unavailable`, never `false`: "no sabemos" y "no
// cumple" son respuestas distintas y el producto entero depende de no
// confundirlas.
function answerOf(predicate: string, source: string, value: boolean | "unavailable"): AttestedAnswer {
  return {
    predicate,
    value,
    source,
    provenance: "observed",
    doesNotEstimate: WHAT_IT_DOES_NOT_SAY[predicate] ?? "",
  };
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
    subjectRef: sha256Hash.hash("knowni/subject-ref/v1", [
      new TextEncoder().encode(`${body.documentKind}:${body.documentNumber}`),
    ]),
  };

  const answers: AttestedAnswer[] = [];

  if (body.consented.includes("registraduria")) {
    const result = await createRegistraduriaPersonhoodSource(client).fetch(subject, nowUnix);
    answers.push(
      answerOf(
        "personhood",
        "registraduria",
        result.status === "claimed" && result.claim.kind === "identity"
          ? result.claim.documentValid && result.claim.subjectAlive && result.claim.ofAge
          : "unavailable",
      ),
    );
  }

  if (body.consented.includes("sicaac")) {
    const result = await createSicaacCapacitySource(client).fetch(subject, nowUnix);
    answers.push(
      answerOf(
        "capacity",
        "sicaac",
        result.status === "claimed" && result.claim.kind === "capacity" ? !result.claim.restricted : "unavailable",
      ),
    );
  }

  if (body.consented.includes("listas")) {
    const result = await createSanctionsSource(client, sha256Hash).fetch(subject, nowUnix);
    answers.push(
      answerOf(
        "sanctions",
        "procuraduria+contraloria+contaduria",
        result.status === "claimed" && result.claim.kind === "standing" ? !result.claim.listed : "unavailable",
      ),
    );
  }

  if (body.consented.includes("vehiculo") && body.plate !== undefined) {
    const result = await createVehicleStandingSource(client).fetch(
      {
        plate: body.plate,
        ownerDocumentNumber: body.documentNumber,
        assetRef: sha256Hash.hash("knowni/asset-ref/v1", [new TextEncoder().encode(body.plate)]),
      },
      nowUnix,
    );
    answers.push(
      answerOf(
        "assetStanding",
        "runt+simit",
        result.status === "claimed" && result.claim.kind === "assetStanding"
          ? result.claim.registered && !result.claim.encumbered && !result.claim.finesOutstanding
          : "unavailable",
      ),
    );
  }

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
    "Access-Control-Allow-Headers": "Content-Type",
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
const SOURCE_PREDICATE: Record<string, string> = {
  registraduria: "personhood",
  sicaac: "capacity",
  listas: "sanctions",
  vehiculo: "assetStanding",
};

export function predicatesOf(consented: readonly string[]): readonly string[] {
  return consented.map((source) => SOURCE_PREDICATE[source]).filter((p): p is string => p !== undefined);
}

export function createIssuerService(options: IssuerOptions) {
  const publicKey = nodeSignatures.publicKeyOf(options.seed);
  const spent = options.spentPayments ?? createMemorySpentPayments();
  const notifier = options.notifier ?? noNotifier;

  return createServer(async (request, response) => {
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
      return result.status === "quoted"
        ? send(response, 200, { quote: result.quote })
        : send(response, 400, { error: result.reason });
    }

    if (request.method === "POST" && request.url?.startsWith("/issue")) {
      const body = (await readBody(request)) as IssueRequestBody | undefined;
      if (body === undefined || typeof body.documentNumber !== "string" || body.request === undefined) {
        return send(response, 400, { error: "invalid_request" });
      }
      if (!Array.isArray(body.consented) || body.consented.length === 0) {
        return send(response, 400, { error: "consent_missing" });
      }
      // Paid before consulted: the sources cost money and a question nobody
      // paid for is a question nobody asked.
      if (options.payments !== undefined) {
        if (typeof body.paymentTx !== "string") {
          return send(response, 402, { error: "payment_required" });
        }
        const expected = paymentRef(body.request, predicatesOf(body.consented));
        const paid = await verifyPayment(body.paymentTx, expected, options.payments, spent);
        if (paid.status === "refused") {
          return send(response, 402, { error: "payment_refused", reason: paid.reason });
        }
      }

      try {
        const nowUnix = Math.floor(Date.now() / 1000);
        const { answers, results } = await issueAnswers(options, body, nowUnix);
        // The notice says an answer is ready and nothing more; a failure to
        // send it is not a failure to issue.
        if (typeof body.notifyPhone === "string" && body.notifyPhone !== "") {
          void notifier.notify(body.notifyPhone, results.sessionId);
        }
        // Only answers that came back are billed; an unavailable source is
        // not charged for.
        return send(response, 200, { results, chargedMinor: chargeableMinor(answers) });
      } catch {
        // Nothing from a provider crosses this boundary, not even in a 500.
        return send(response, 502, { error: "issuance_failed" });
      }
    }

    return send(response, 404, { error: "not_found" });
  });
}
