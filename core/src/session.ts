// session.ts: Binds a proof to one question, asked once, by one counterparty. "Verify the
// proof but not the statement" and "no anti-replay" are the two ways a working ZK system still
// gets robbed.

import type { FieldHash } from "./hash.ts";
import { fromHex, u64be, utf8 } from "./hash.ts";

const SESSION_DOMAIN = "knowni:session:v1";
const NULLIFIER_DOMAIN = "knowni:nullifier:v1";

export type Purpose = string;

const PURPOSE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isPurpose(value: string): boolean {
  return value.length <= 64 && PURPOSE.test(value);
}

export interface SessionRequest {
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

export interface SubjectSecret {
  readonly hex: string;
}

export function deriveNullifier(h: FieldHash, secret: SubjectSecret, session: string): string {
  return h.hash(NULLIFIER_DOMAIN, [fromHex(secret.hex), fromHex(session)]);
}

export function isExpired(request: SessionRequest, nowUnix: number): boolean {
  return nowUnix > request.expiresAt;
}
