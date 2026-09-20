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
// obtained for one contract cannot be re-presented for another — the purpose
// is part of what was proven.
//
// An open validated string, not a union of the contract types that happened
// to exist when this was written. The product is "prove you qualify to sign",
// whatever is being signed: a lease, a sale, a guarantee, a supply contract,
// an employment offer. A closed union would make adding a contract type a
// change to the domain layer — the same coupling ChainId is open to avoid.
// A contract type is a PROFILE of the request, composed by the caller; core
// never learns what any of them mean.
//
// The cost of not pinning the union is that the value has to be checked
// somewhere, so isPurpose is that somewhere.
export type Purpose = string;

// Lowercase, dash-separated alphanumerics: "lease", "vehicle-sale",
// "supply-contract". Constrained because the purpose is hashed into the
// session id and shown to the subject before they answer — a value they
// cannot read is a question they cannot refuse.
const PURPOSE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isPurpose(value: string): boolean {
  return value.length <= 64 && PURPOSE.test(value);
}

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
  // Throws rather than degrades: this is a pure helper at the hashing
  // boundary, like fromHex, and a malformed purpose here is a caller bug.
  // The orchestrator checks it first and refuses — see verify().
  if (!isPurpose(request.purpose)) {
    throw new TypeError(`not a purpose: ${JSON.stringify(request.purpose)}`);
  }
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
