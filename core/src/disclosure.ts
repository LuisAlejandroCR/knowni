// core/src/disclosure.ts
// Everything the relying party is ever handed, in one type.
//
// This file is the product's promise expressed as a data structure. If a
// landlord's system can display it, log it, sell it or lose it, it is in
// here — so the review question for any change is simply: would we be
// comfortable if this field were published?
//
// core/test/disclosure.invariant.test.ts asserts that a serialised
// Disclosure contains no value from the claims that produced it. That test
// is the reason this type is a hand-built envelope rather than a spread of
// the evaluation result.

import type { Outcome } from "./commitment.ts";
import type { SolvencyTier } from "./predicates.ts";
import type { Purpose } from "./session.ts";

// A predicate that could not be evaluated is NOT a predicate that failed,
// and collapsing the two is the difference between "you don't qualify" and
// "the registry was down". A landlord who sees `unavailable` knows to wait;
// one who sees `false` turns the applicant away.
export type PredicateResult = boolean | "unavailable";

export interface Disclosure {
  readonly sessionId: string;
  readonly relyingPartyId: string;
  readonly purpose: Purpose;
  readonly decidedAt: number;

  // The answers. Four of them, and a band.
  readonly personhood: PredicateResult;
  readonly solvency: SolvencyTier | "unavailable";
  readonly formality: PredicateResult;
  readonly standing: PredicateResult;

  // Which published issuer set each answer was proven against. This is what
  // makes the disclosure auditable without making it revealing: a regulator
  // can check the root was current, and learns nothing about the subject.
  readonly issuerRoots: readonly string[];

  // Spent once. The relying party stores it to refuse a replay; it is
  // useless to anyone else, and unlinkable to the same subject's nullifier
  // at a different relying party.
  readonly nullifier: string;

  // Present once the outcome has been anchored. Absent is a normal state,
  // not an error: anchoring is a durability feature, and a verification that
  // could not reach a chain still answered the question.
  readonly anchor?: {
    readonly chain: string;
    readonly txRef: string;
    readonly commitment: string;
  };
}

// The outcome the subject commits to and (optionally) anchors, derived from
// the same disclosure the relying party sees. `unavailable` collapses to the
// negative here on purpose: a commitment is a claim about what was PROVEN,
// and nothing was.
export function outcomeOf(disclosure: Disclosure): Outcome {
  return {
    personhood: disclosure.personhood === true,
    solvencyTier: typeof disclosure.solvency === "number" ? disclosure.solvency : 0,
    formality: disclosure.formality === true,
    standing: disclosure.standing === true,
    decidedAt: disclosure.decidedAt,
  };
}

// Whether every predicate the relying party asked for came back true. Kept
// out of Disclosure itself: "eligible" is the relying party's policy call,
// not a fact about the subject, and different landlords weigh these
// differently. This is a convenience for the common case, not a verdict.
export function meetsAll(
  disclosure: Disclosure,
  minimumTier: SolvencyTier,
): boolean {
  return (
    disclosure.personhood === true &&
    disclosure.formality === true &&
    disclosure.standing === true &&
    typeof disclosure.solvency === "number" &&
    disclosure.solvency >= minimumTier
  );
}
