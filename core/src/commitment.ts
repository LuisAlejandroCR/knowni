// commitment.ts: the two commitments, and they are not interchangeable.
// commitClaim binds a claim for the issuer's tree; commitOutcome binds a
// session's outcome to a blinding factor, and only the second reaches a chain.

import { equalBytes, fromHex as hexToBytes, toHex } from "./bytes.ts";
import { randomBytes } from "./random.ts";
import type { Claim } from "./claims.ts";
import type { FieldHash } from "./hash.ts";
import { randomFieldElement } from "./field.ts";
import { fromHex, u64be, utf8 } from "./hash.ts";

import { DOMAINS } from "./domains.ts";

const CLAIM_DOMAIN = DOMAINS.claim;
const OUTCOME_DOMAIN = DOMAINS.outcome;

export interface Salt {
  readonly hex: string;
}

export function randomSalt(): Salt {
  return { hex: toHex(randomBytes(32)) };
}

/// A salt that is an element of the field, for the commitments that will be
/// built with a circuit's hash. `randomSalt` draws 32 bytes, which is 256 bits
/// and does not fit a 254-bit field: encoding one refuses rather than reducing,
/// so a salt has to be drawn in the field to begin with.
export function randomFieldSalt(prime: bigint): Salt {
  const value = randomFieldElement(prime);
  return { hex: value.toString(16).padStart(64, "0") };
}

function encodeClaim(claim: Claim): Uint8Array[] {
  const head = [utf8(claim.kind), utf8(claim.jurisdiction), fromHex(claim.subjectRef.hex)];
  switch (claim.kind) {
    case "identity":
      return [
        ...head,
        utf8(claim.documentKind),
        u64be(claim.documentValid ? 1 : 0),
        u64be(claim.subjectAlive ? 1 : 0),
        u64be(claim.ofAge ? 1 : 0),
        u64be(claim.attestedAt),
      ];
    case "income":
      return [
        ...head,
        u64be(claim.monthlyMinor),
        utf8(claim.currency),
        utf8(claim.basis),
        u64be(claim.periodsObserved),
        u64be(claim.periodsWindow),
        u64be(claim.attestedAt),
      ];
    case "formality":
      return [
        ...head,
        u64be(claim.lastContributionMonth),
        u64be(claim.monthsContributedLast12),
        u64be(claim.attestedAt),
      ];
    case "standing":
      return [
        ...head,
        u64be(claim.listed ? 1 : 0),
        fromHex(claim.listSetRoot),
        u64be(claim.attestedAt),
      ];
    case "capacity":
      return [...head, u64be(claim.restricted ? 1 : 0), utf8(claim.basis), u64be(claim.attestedAt)];
    case "assetStanding":
      return [
        ...head,
        u64be(claim.registered ? 1 : 0),
        u64be(claim.encumbered ? 1 : 0),
        u64be(claim.finesOutstanding ? 1 : 0),
        u64be(claim.attestedAt),
      ];
  }
}

export function commitClaim(h: FieldHash, claim: Claim, salt: Salt): string {
  return h.hash(CLAIM_DOMAIN, [...encodeClaim(claim), fromHex(salt.hex)]);
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
