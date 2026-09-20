// results.ts: what actually crosses the wire — answers, signed by the issuer
// and bound to one request. The claim and its salt stay in the wallet.

// The hole this closes: an AttestedCredential carries `claim` and `salt`,
// because verifyCredential needs both to open the commitment. Handing one to
// a counterparty hands them the income figure, the subject reference and
// everything else the claim holds — no matter what the screen displays.
//
// Two ways out, and this file picks one of them on purpose:
//
//   predicate proof     the wallet proves `income >= 3 x rent` without
//                       revealing income. It is where the product is going,
//                       and it needs the ZK path measured on a real phone.
//   attested results    the ISSUER evaluates the predicates for the
//                       thresholds the request names, and signs the answers.
//                       Buildable today, and honest as long as its costs are
//                       stated rather than dressed up as zero-knowledge.
//
// What attested results cost, plainly:
//
//   * the issuer sees the evidence — it always did, but now it also learns
//     which counterparty asked, because the answers are bound to a session;
//   * the issuer must be reachable at request time, so a new threshold
//     cannot be answered offline from an old credential;
//   * the counterparty trusts the issuer's evaluation rather than checking
//     it, which is exactly what the ZK path removes later.
//
// This is NOT a zero-knowledge proof and nothing here may be labelled as one.

import type { FieldHash, SessionRequest } from "@knowni/core";
import { sessionId, utf8 } from "@knowni/core";
import { createPublicKey, sign, verify } from "node:crypto";
import type { IssuerRegistry } from "./types.ts";

const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const RESULTS_DOMAIN = "knowni/attested-results/v1";

// One answer. `value` is a boolean or a band — never an amount, never a
// date, never an identifier. `provenance` and `scope` are what let a
// counterparty know what they actually received.
export interface AttestedAnswer {
  readonly predicate: string; // "personhood", "capacity", "assetStanding", …
  readonly value: boolean | number | "unavailable";
  // Which register produced it, as a logical name — not a URL and not a
  // provider account. "sicaac", "registraduria", "runt+simit".
  readonly source: string;
  readonly provenance: "observed" | "documentary" | "self_declared";
  // What this answer does NOT say. Carried explicitly so a counterparty
  // cannot quietly widen it: "no insolvency proceeding on record" is not
  // "has legal capacity".
  readonly doesNotEstimate: string;
}

// The envelope the wallet sends. No claim, no salt, no subject reference,
// no Merkle path — the path proves a commitment the counterparty is not
// allowed to open anyway.
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

function lengthPrefixed(parts: readonly Uint8Array[]): Buffer {
  return Buffer.concat(
    parts.map((part) => {
      const length = Buffer.alloc(4);
      length.writeUInt32BE(part.length);
      return Buffer.concat([length, Buffer.from(part)]);
    }),
  );
}

// Every field of every answer is signed, in order. Signing only the values
// would let an answer be re-labelled: `true` about the vehicle presented as
// `true` about insolvency.
export function resultsBytes(results: Omit<AttestedResults, "signature" | "algorithm">): Buffer {
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
  const key = {
    key: Buffer.concat([PKCS8_PREFIX, Buffer.from(seed)]),
    format: "der" as const,
    type: "pkcs8" as const,
  };
  return {
    ...unsigned,
    algorithm: "ed25519",
    signature: sign(null, resultsBytes(unsigned), key).toString("hex"),
  };
}

export interface ResultsCheck {
  readonly registry: IssuerRegistry;
  // The request this counterparty sent. The session id is recomputed from
  // it, so answers cannot be moved to another audience, purpose, challenge
  // or set of parameters.
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
  const key = createPublicKey({
    key: Buffer.concat([SPKI_PREFIX, Buffer.from(publicKey)]),
    format: "der",
    type: "spki",
  });
  if (!verify(null, resultsBytes(unsigned), key, Buffer.from(signature, "hex"))) {
    return { status: "invalid", reason: "bad_signature" };
  }

  for (const predicate of check.required ?? []) {
    if (!results.answers.some((answer) => answer.predicate === predicate)) {
      return { status: "invalid", reason: "answer_missing" };
    }
  }

  return { status: "valid", answers: results.answers };
}

// A compile-time guard, checked by a test as well: whatever is presented
// must not carry the fields that opening a commitment requires. It is cheap
// and it fails loudly the day someone adds `claim` "just for debugging".
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
