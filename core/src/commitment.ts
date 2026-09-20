// core/src/commitment.ts
// Turns a claim into the single hex value that goes into the issuer's tree,
// and the blinded commitment that is the only thing this system ever writes
// to a chain.
//
// Two different commitments live here and they are not interchangeable:
//
//   commitClaim    binds a claim to a subject's salt. It is a LEAF: the
//                  issuer publishes a tree of these, the subject proves one
//                  is in it. Never anchored on its own.
//   commitOutcome  binds a session's OUTCOME to a random blinding factor. It
//                  is what gets anchored, and it is the only value in this
//                  file a third party ever sees.
//
// Nothing here can turn a claim into an anchorable value. That is deliberate
// and it is enforced by the types: commitOutcome takes an Outcome, and there
// is no function that produces an Outcome from a Claim's fields.

import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Claim } from "./claims.ts";
import type { FieldHash } from "./hash.ts";
import { fromHex, u64be, utf8 } from "./hash.ts";

const CLAIM_DOMAIN = "knowni:claim:v1";
const OUTCOME_DOMAIN = "knowni:outcome:v1";

// 32 random bytes the subject keeps. It is what stops an observer who knows
// the claim's shape from brute-forcing the leaf: the space of
// {documentValid, ofAge, attestedAt} is small enough to enumerate in
// milliseconds without it.
export interface Salt {
  readonly hex: string;
}

export function randomSalt(): Salt {
  return { hex: randomBytes(32).toString("hex") };
}

// Canonical encoding, written out per claim kind rather than by serialising
// the object. JSON.stringify would make the digest depend on key insertion
// order and on how a runtime renders numbers — a commitment that changes
// when a field is reordered is a commitment that cannot be re-checked by a
// second implementation, let alone by a circuit.
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

// What a completed verification session concluded. Deliberately tiny: four
// booleans and a tier, with no subject reference and no issuer in it, so
// that even the pre-image of an anchored commitment says nothing about who
// was verified.
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

// The only constructor of an anchorable value. Its parameter type is
// Outcome, so there is no overload, no sibling and no path by which a claim
// or a subjectRef becomes something that can be written to a chain.
export function commitOutcome(h: FieldHash, outcome: Outcome): BlindedCommitment {
  const blinding: Blinding = { hex: randomBytes(32).toString("hex") };
  return { commitment: digestOutcome(h, outcome, blinding), blinding };
}

// Lets the subject — and only the subject, who kept the blinding factor —
// open an anchored commitment later: to a court, to an auditor, to the
// landlord in a dispute. Without the blinding factor the anchor is opaque
// even to whoever wrote it.
export function verifyOutcomeCommitment(
  h: FieldHash,
  outcome: Outcome,
  blinding: Blinding,
  commitment: string,
): boolean {
  const expected = Buffer.from(digestOutcome(h, outcome, blinding), "hex");
  const actual = Buffer.from(commitment, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
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
