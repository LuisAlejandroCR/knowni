// issuer-client.ts: how the phone talks to the issuance service.
// The service holds the provider key and queries the registries; the phone
// sends a consented lookup and gets back answers it verifies itself.

import type { AttestedResults, IssuerRegistry } from "@knowni/attestation";
import type { SessionRequest } from "@knowni/core";
import { createMemoryRegistry, verifyResults } from "@knowni/attestation";
import { fromHex, toHex } from "@knowni/core";
import { appHash, appSignatures } from "./crypto.ts";
import { payQuote, type PaymentTerms } from "./stellar-payment.ts";
import type { PayerWalletPort } from "./wallet-port.ts";

// Set with EXPO_PUBLIC_ISSUER_URL. The default points at a service running on
// the same machine, which is what `npm start` in issuer/ gives you.
export const ISSUER_URL = process.env.EXPO_PUBLIC_ISSUER_URL ?? "http://localhost:8787";

// This app's relying-party key. Without it the service refuses every /issue
// call rather than answer anyone who finds the URL. See docs/memoria.md D-31.
const ACCESS_KEY = process.env.EXPO_PUBLIC_ISSUER_ACCESS_KEY;

export interface IssuerIdentity {
  readonly issuerId: string;
  readonly registry: IssuerRegistry;
}

// The key the issuer serves at /keys, as hex, so the verifier can tell a rotated
// key from a forged answer.
export function servedIssuerKey(issuer: IssuerIdentity | undefined): string | undefined {
  const key = issuer?.registry.publicKeyOf(issuer.issuerId);
  return key === undefined ? undefined : toHex(key);
}

// Why a source did not answer, as the issuer describes it to the person whose
// verification it is. It arrives beside the signed results and is never part of
// them: what the counterparty receives says `unavailable` and nothing else.
export type SourceStateName =
  | "answered"
  | "not_found"
  | "degraded"
  | "failed"
  | "consent_missing"
  | "needs_human_review";

export interface SourceState {
  readonly predicate: string;
  readonly source: string;
  readonly state: SourceStateName;
}

const STATE_NAMES: readonly SourceStateName[] = [
  "answered",
  "not_found",
  "degraded",
  "failed",
  "consent_missing",
  "needs_human_review",
];

// Validated like anything else off the wire: a state this app does not know is
// dropped rather than rendered, because a screen must not print a word the
// issuer invented.
export function readSourceStates(value: unknown): readonly SourceState[] {
  if (!Array.isArray(value)) return [];
  const states: SourceState[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const fields = entry as Record<string, unknown>;
    const { predicate, source, state } = fields;
    if (typeof predicate !== "string" || typeof source !== "string") continue;
    if (typeof state !== "string" || !STATE_NAMES.includes(state as SourceStateName)) continue;
    states.push({ predicate, source, state: state as SourceStateName });
  }
  return states;
}

export type IssuanceOutcome =
  | {
      readonly status: "issued";
      readonly results: AttestedResults;
      readonly sourceStates: readonly SourceState[];
    }
  | { readonly status: "failed"; readonly reason: string };

export interface IssuerQuote {
  readonly currency: string;
  readonly totalMinor: number;
  readonly paymentRef: string;
  readonly expiresAt: number;
}

export type QuoteOutcome =
  | {
      readonly status: "quoted";
      readonly quote: IssuerQuote;
      readonly paymentRequired: boolean;
      readonly payment?: PaymentTerms;
    }
  | { readonly status: "failed"; readonly reason: string };

// Measured, not guessed: a four-source issuance took 83 s on 2026-09-21,
// because the three sanctions registries are slow live upstreams. A 20 s
// timeout would abort every real consultation.
const TIMEOUT_MS = 180_000;

async function call(url: string, init?: RequestInit, fetchImpl: typeof fetch = fetch): Promise<Response | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

// The issuer's public key comes from the service's registry endpoint, never
// from the credential: a credential that carries its own key proves only that
// somebody had a key.
export async function fetchIssuer(baseUrl = ISSUER_URL): Promise<IssuerIdentity | undefined> {
  const response = await call(`${baseUrl}/keys`);
  if (response === undefined || !response.ok) return undefined;
  const body = (await response.json()) as { issuerId?: string; publicKey?: string };
  if (typeof body.issuerId !== "string" || typeof body.publicKey !== "string") return undefined;
  try {
    return {
      issuerId: body.issuerId,
      registry: createMemoryRegistry({ [body.issuerId]: fromHex(body.publicKey) }),
    };
  } catch {
    return undefined;
  }
}

export interface IssuanceInput {
  readonly documentKind: string;
  readonly documentNumber: string;
  readonly plate?: string;
  readonly consented: readonly string[];
  readonly request: SessionRequest;
  readonly paymentTx?: string;
}

export async function requestQuote(
  request: SessionRequest,
  predicates: readonly string[],
  baseUrl = ISSUER_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<QuoteOutcome> {
  const response = await call(`${baseUrl}/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request, predicates }),
  }, fetchImpl);
  if (response === undefined) return { status: "failed", reason: "No pudimos obtener la cotización." };
  const body = (await response.json().catch(() => undefined)) as
    | { quote?: IssuerQuote; paymentRequired?: boolean; payment?: PaymentTerms; error?: string }
    | undefined;
  if (!response.ok || body?.quote === undefined) {
    return { status: "failed", reason: body?.error ?? "La cotización no es válida." };
  }
  if (typeof body.paymentRequired !== "boolean") {
    return { status: "failed", reason: "La cotización no declaró si requiere pago." };
  }
  if (body.paymentRequired && body.payment === undefined) {
    return { status: "failed", reason: "El emisor exige pago pero no publicó términos válidos." };
  }
  if (body.payment !== undefined && body.payment.paymentRef !== body.quote.paymentRef) {
    return { status: "failed", reason: "La referencia de pago no coincide con la cotización." };
  }
  return {
    status: "quoted",
    quote: body.quote,
    paymentRequired: body.paymentRequired,
    payment: body.payment,
  };
}

export async function requestIssuance(
  input: IssuanceInput,
  baseUrl = ISSUER_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<IssuanceOutcome> {
  const response = await call(`${baseUrl}/issue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ACCESS_KEY === undefined ? {} : { "X-Knowni-Access-Key": ACCESS_KEY }),
    },
    body: JSON.stringify(input),
  }, fetchImpl);
  if (response === undefined) {
    return { status: "failed", reason: "No pudimos hablar con el emisor. No se consultó ninguna fuente." };
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    return {
      status: "failed",
      reason:
        body.error === "consent_missing"
          ? "Falta tu autorización para consultar."
          : "El emisor no pudo completar la consulta.",
    };
  }
  const body = (await response.json().catch(() => undefined)) as
    | { results?: AttestedResults; sourceStates?: unknown }
    | undefined;
  if (body?.results === undefined) return { status: "failed", reason: "El emisor respondió algo ilegible." };
  return { status: "issued", results: body.results, sourceStates: readSourceStates(body.sourceStates) };
}

const SOURCE_PREDICATE: Readonly<Record<string, string>> = {
  registraduria: "personhood",
  sicaac: "capacity",
  listas: "sanctions",
  vehiculo: "assetStanding",
};

export type PaidIssuanceOutcome =
  | { readonly status: "issued"; readonly results: AttestedResults; readonly paymentTx?: string }
  | { readonly status: "failed"; readonly stage: "quote" | "payment" | "issuance"; readonly reason: string };

// The payer-facing coordinator has one ordering: quote, pay if required, then
// issue. A failed signature or chain submission can never spend a Croma call.
export async function requestPaidIssuance(
  input: IssuanceInput,
  wallet: PayerWalletPort,
  options: { readonly baseUrl?: string; readonly horizonUrl?: string; readonly fetchImpl?: typeof fetch } = {},
): Promise<PaidIssuanceOutcome> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const predicates = input.consented
    .map((source) => SOURCE_PREDICATE[source])
    .filter((predicate): predicate is string => predicate !== undefined);
  const quoted = await requestQuote(input.request, predicates, options.baseUrl ?? ISSUER_URL, fetchImpl);
  if (quoted.status === "failed") return { status: "failed", stage: "quote", reason: quoted.reason };

  let paymentTx: string | undefined;
  if (quoted.paymentRequired) {
    const paid = await payQuote({
      terms: quoted.payment!,
      expiresAt: quoted.quote.expiresAt,
      wallet,
      horizonUrl: options.horizonUrl,
      fetchImpl,
    });
    if (paid.status === "failed") return { status: "failed", stage: "payment", reason: paid.reason };
    paymentTx = paid.txHash;
  }

  const issued = await requestIssuance({ ...input, paymentTx }, options.baseUrl ?? ISSUER_URL, fetchImpl);
  return issued.status === "issued"
    ? { ...issued, paymentTx }
    : { status: "failed", stage: "issuance", reason: issued.reason };
}

// Verified on the phone before anything is displayed: the service signs, and
// the wallet checks that signature against the registry rather than trusting
// the transport it arrived on.
export function verifyIssued(
  results: AttestedResults,
  issuer: IssuerIdentity,
  request: SessionRequest,
  nowUnix: number,
) {
  return verifyResults(appHash, results, {
    signatures: appSignatures,
    registry: issuer.registry,
    request,
    nowUnix,
  });
}
