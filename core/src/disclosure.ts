// disclosure.ts: Everything the relying party is ever handed, in one type. This file is the
// product's promise expressed as a data structure.

import type { Outcome } from "./commitment.ts";
import type { SolvencyTier } from "./predicates.ts";
import type { Purpose } from "./session.ts";

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

  readonly issuerRoots: readonly string[];

  readonly nullifier: string;

  readonly anchor?: {
    readonly chain: string;
    readonly txRef: string;
    readonly commitment: string;
  };
}

export function outcomeOf(disclosure: Disclosure): Outcome {
  return {
    personhood: disclosure.personhood === true,
    solvencyTier: typeof disclosure.solvency === "number" ? disclosure.solvency : 0,
    formality: disclosure.formality === true,
    standing: disclosure.standing === true,
    decidedAt: disclosure.decidedAt,
  };
}

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
