// commitment.ts: the two commitments, and they are not interchangeable.
// commitClaim binds a claim for the issuer's tree; commitOutcome binds a
// session's outcome to a blinding factor, and only the second reaches a chain.

import { equalBytes, fromHex as hexToBytes, toHex } from "./bytes.ts";
import { randomBytes } from "./random.ts";
import type { Claim } from "./claims.ts";
import type { FieldHash } from "./hash.ts";
import { randomFieldElement } from "./field.ts";
import { encodeClaimFields } from "./claim-fields.ts";
import type { FieldHasher } from "./field-hasher.ts";
import { fromHex, u64be } from "./hash.ts";

import { DOMAINS } from "./domains.ts";

const OUTCOME_DOMAIN = DOMAINS.outcome;

export interface Salt {
  readonly hex: string;
}

/// A salt is an element of the field. Thirty-two random bytes are 256 bits and
/// the field is 254: committing one refuses rather than reducing, so there is
/// no second way to make a salt and this is it.
export function randomSalt(prime: bigint): Salt {
  const value = randomFieldElement(prime);
  return { hex: value.toString(16).padStart(64, "0") };
}

/// The claim as elements, then the salt, under the claim domain. The byte
/// encoding below is what the sha256 hash used; this is the shape a circuit
/// can reproduce, and `encodeClaimFields` is where it is decided.
export function commitClaim(h: FieldHasher, claim: Claim, salt: Salt): string {
  const fields = encodeClaimFields((value) => h.element(value), claim, h.prime);
  return h.toHex(h.hashFields("claim", [...fields, h.fromHex(salt.hex, "salt")]));
}

export interface Outcome {
  readonly personhood: boolean;
  readonly solvencyTier: number;
  readonly formality: boolean;
  readonly standing: boolean;
  readonly decidedAt: number; // unix seconds
}

export interface Blinding {
  readonly hex: string;
}

export interface BlindedCommitment {
  readonly commitment: string;
  readonly blinding: Blinding;
}

export function commitOutcome(h: FieldHash, outcome: Outcome): BlindedCommitment {
  const blinding: Blinding = { hex: toHex(randomBytes(32)) };
  return { commitment: digestOutcome(h, outcome, blinding), blinding };
}

export function verifyOutcomeCommitment(
  h: FieldHash,
  outcome: Outcome,
  blinding: Blinding,
  commitment: string,
): boolean {
  return equalBytes(hexToBytes(digestOutcome(h, outcome, blinding)), hexToBytes(commitment));
}

function digestOutcome(h: FieldHash, outcome: Outcome, blinding: Blinding): string {
  return h.hash(OUTCOME_DOMAIN, [
    u64be(outcome.personhood ? 1 : 0),
    u64be(outcome.solvencyTier),
    u64be(outcome.formality ? 1 : 0),
    u64be(outcome.standing ? 1 : 0),
    u64be(outcome.decidedAt),
    fromHex(blinding.hex),
  ]);
}
