// issuer-client.ts: how the phone talks to the issuance service.
// The service holds the provider key and queries the registries; the phone
// sends a consented lookup and gets back answers it verifies itself.

import type { AttestedResults, IssuerRegistry } from "@knowni/attestation";
import type { SessionRequest } from "@knowni/core";
import { createMemoryRegistry, verifyResults } from "@knowni/attestation";
import { fromHex } from "@knowni/core";
import { appHash, appSignatures } from "./crypto.ts";
import type { PaymentTerms } from "./stellar-payment.ts";

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

export type IssuanceOutcome =
  | { readonly status: "issued"; readonly results: AttestedResults }
  | { readonly status: "failed"; readonly reason: string };

export interface IssuerQuote {
  readonly currency: string;
  readonly totalMinor: number;
  readonly paymentRef: string;
  readonly expiresAt: number;
}

export type QuoteOutcome =
  | { readonly status: "quoted"; readonly quote: IssuerQuote; readonly payment?: PaymentTerms }
  | { readonly status: "failed"; readonly reason: string };

// Measured, not guessed: a four-source issuance took 83 s on 2026-09-21,
// because the three sanctions registries are slow live upstreams. A 20 s
// timeout would abort every real consultation.
const TIMEOUT_MS = 180_000;

async function call(url: string, init?: RequestInit): Promise<Response | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
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
): Promise<QuoteOutcome> {
  const response = await call(`${baseUrl}/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request, predicates }),
  });
  if (response === undefined) return { status: "failed", reason: "No pudimos obtener la cotización." };
  const body = (await response.json().catch(() => undefined)) as
    | { quote?: IssuerQuote; payment?: PaymentTerms; error?: string }
    | undefined;
  if (!response.ok || body?.quote === undefined) {
    return { status: "failed", reason: body?.error ?? "La cotización no es válida." };
  }
  return { status: "quoted", quote: body.quote, payment: body.payment };
}

export async function requestIssuance(input: IssuanceInput, baseUrl = ISSUER_URL): Promise<IssuanceOutcome> {
  const response = await call(`${baseUrl}/issue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ACCESS_KEY === undefined ? {} : { "X-Knowni-Access-Key": ACCESS_KEY }),
    },
    body: JSON.stringify(input),
  });
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
  const body = (await response.json().catch(() => undefined)) as { results?: AttestedResults } | undefined;
  if (body?.results === undefined) return { status: "failed", reason: "El emisor respondió algo ilegible." };
  return { status: "issued", results: body.results };
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
