// core/src/session.ts
// Binds a proof to one question, asked once, by one counterparty.
//
// "Verify the proof but not the statement" and "no anti-replay" are the two
// ways a working ZK system still gets robbed. A Groth16 proof is a portable
// file: without the binding in this module, the proof a subject gave to one
// agency is a proof that agency can present to a second landlord as its own
// applicant, and the subject can present the same proof to fifty landlords
// from one three-month-old attestation.
//
// Two values do that work, and both are PUBLIC inputs to the circuit:
//
//   sessionId   who is asking, what for, and until when. Hashed into the
//               proof, so a proof built for one session verifies against no
//               other.
//   nullifier   derived from the subject's secret AND the sessionId. The
//               policy contract stores it; a second proof in the same
//               session is refused. Because the sessionId is mixed in, the
//               nullifiers a subject leaves across two landlords are
//               unlinkable — which is the property a plain "one nullifier
//               per person" scheme destroys.

import type { FieldHash } from "./hash.ts";
import { fromHex, u64be, utf8 } from "./hash.ts";

const SESSION_DOMAIN = "knowni:session:v1";
const NULLIFIER_DOMAIN = "knowni:nullifier:v1";

// Why the proof is being asked for. It travels in the sessionId, so a proof
// obtained to sign a lease cannot be re-presented to open a credit line —
// the purpose is part of what was proven.
export type Purpose = "lease" | "purchase" | "guarantor" | "employment" | "other";

export interface SessionRequest {
  // Who is asking. A stable public identifier for the relying party — an
  // agency, a notary, a marketplace. Public by design: the subject must be
  // able to read who they are answering before they answer.
  readonly relyingPartyId: string;
  readonly purpose: Purpose;
  // Fresh per request, from the relying party. A reused nonce collapses two
  // sessions into one identifier and re-links them.
  readonly nonce: string; // hex
  readonly expiresAt: number; // unix seconds
  // The parameters the answer is about — the rent, the currency, the list
  // snapshot. Hashed in so a proof cannot be moved to a cheaper question.
  readonly paramsHash: string; // hex
}

export function sessionId(h: FieldHash, request: SessionRequest): string {
  return h.hash(SESSION_DOMAIN, [
    utf8(request.relyingPartyId),
    utf8(request.purpose),
    fromHex(request.nonce),
    u64be(request.expiresAt),
    fromHex(request.paramsHash),
  ]);
}

// The subject's long-term secret. Never transmitted, never committed to a
// chain, and the only input that makes a nullifier unforgeable by anyone
// else — without it a relying party could precompute the nullifier of a
// cédula they already know and watch for it.
export interface SubjectSecret {
  readonly hex: string;
}

export function deriveNullifier(h: FieldHash, secret: SubjectSecret, session: string): string {
  return h.hash(NULLIFIER_DOMAIN, [fromHex(secret.hex), fromHex(session)]);
}

export function isExpired(request: SessionRequest, nowUnix: number): boolean {
  return nowUnix > request.expiresAt;
}
