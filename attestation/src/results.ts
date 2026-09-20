// results.ts: what actually crosses the wire — answers, signed by the issuer and bound to one
// request. The claim and its salt stay in the wallet.

import type { FieldHash, SessionRequest } from "@knowni/core";
import { fromHex, lengthPrefixed, sessionId, toHex, utf8 } from "@knowni/core";
import type { SignaturePort } from "./signing.ts";
import type { IssuerRegistry } from "./types.ts";

const RESULTS_DOMAIN = "knowni/attested-results/v1";

export interface AttestedAnswer {
  readonly predicate: string; // "personhood", "capacity", "assetStanding", …
  readonly value: boolean | number | "unavailable";
  // Which register produced it, as a logical name — not a URL and not a
  // provider account. "sicaac", "registraduria", "runt+simit".
  readonly source: string;
  readonly provenance: "observed" | "documentary" | "self_declared";
  readonly doesNotEstimate: string;
}

export interface AttestedResults {
  readonly issuerId: string;
  readonly sessionId: string;
  readonly answers: readonly AttestedAnswer[];
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly algorithm: "ed25519";
  readonly signature: string; // hex
}

export type ResultsFailure =
  | "unknown_issuer"
  | "bad_signature"
  | "session_mismatch"
  | "expired"
  | "answer_missing";

export type ResultsVerification =
  | { readonly status: "valid"; readonly answers: readonly AttestedAnswer[] }
  | { readonly status: "invalid"; readonly reason: ResultsFailure };

export function resultsBytes(results: Omit<AttestedResults, "signature" | "algorithm">): Uint8Array {
  const parts: Uint8Array[] = [
    utf8(RESULTS_DOMAIN),
    utf8(results.issuerId),
    utf8(results.sessionId),
    utf8(String(results.issuedAt)),
    utf8(String(results.expiresAt)),
    utf8(String(results.answers.length)),
  ];
  for (const answer of results.answers) {
    parts.push(
      utf8(answer.predicate),
      utf8(String(answer.value)),
      utf8(answer.source),
      utf8(answer.provenance),
      utf8(answer.doesNotEstimate),
    );
  }
  return lengthPrefixed(parts);
}

export interface AttestResultsRequest {
  readonly issuerId: string;
  readonly request: SessionRequest;
  readonly answers: readonly AttestedAnswer[];
  readonly issuedAt: number;
  // Short by default at the call site: results answer one request, and a
  // long-lived answer is a credential nobody asked for.
  readonly expiresAt: number;
}

export function attestResults(
  h: FieldHash,
  signatures: SignaturePort,
  seed: Uint8Array,
  request: AttestResultsRequest,
): AttestedResults {
  const unsigned = {
    issuerId: request.issuerId,
    sessionId: sessionId(h, request.request),
    answers: request.answers,
    issuedAt: request.issuedAt,
    expiresAt: request.expiresAt,
  };
  return {
    ...unsigned,
    algorithm: "ed25519",
    signature: toHex(signatures.sign(seed, resultsBytes(unsigned))),
  };
}

export interface ResultsCheck {
  readonly signatures: SignaturePort;
  readonly registry: IssuerRegistry;
  readonly request: SessionRequest;
  readonly nowUnix: number;
  // Predicates the counterparty asked about. An envelope missing one of
  // them is incomplete, not partially acceptable.
  readonly required?: readonly string[];
}

export function verifyResults(
  h: FieldHash,
  results: AttestedResults,
  check: ResultsCheck,
): ResultsVerification {
  const publicKey = check.registry.publicKeyOf(results.issuerId);
  if (publicKey === undefined) return { status: "invalid", reason: "unknown_issuer" };

  if (results.sessionId !== sessionId(h, check.request)) {
    return { status: "invalid", reason: "session_mismatch" };
  }
  // Stamped in the future is a clock problem or a forgery, and expired is
  // expired: neither is an answer.
  if (results.issuedAt > check.nowUnix || check.nowUnix > results.expiresAt) {
    return { status: "invalid", reason: "expired" };
  }

  const { signature, algorithm: _algorithm, ...unsigned } = results;
  if (!check.signatures.verify(publicKey, resultsBytes(unsigned), fromHex(signature))) {
    return { status: "invalid", reason: "bad_signature" };
  }

  for (const predicate of check.required ?? []) {
    if (!results.answers.some((answer) => answer.predicate === predicate)) {
      return { status: "invalid", reason: "answer_missing" };
    }
  }

  return { status: "valid", answers: results.answers };
}

export function containsHeldSecrets(payload: unknown): boolean {
  const seen = new Set<unknown>();
  const walk = (value: unknown): boolean => {
    if (typeof value !== "object" || value === null || seen.has(value)) return false;
    seen.add(value);
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === "claim" || key === "salt" || key === "subjectRef" || key === "blinding") return true;
      if (walk(child)) return true;
    }
    return false;
  };
  return walk(payload);
}
