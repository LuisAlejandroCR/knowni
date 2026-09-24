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

  // The answers, and a band. A profile asks for the ones its contract needs;
  // the rest come back `unavailable`, which is an answer about the request and
  // not about the subject.
  readonly personhood: PredicateResult;
  readonly solvency: SolvencyTier | "unavailable";
  readonly formality: PredicateResult;
  readonly standing: PredicateResult;
  readonly capacity: PredicateResult;
  readonly assetStanding: PredicateResult;

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
    capacity: disclosure.capacity === true,
    assetStanding: disclosure.assetStanding === true,
    decidedAt: disclosure.decidedAt,
  };
}

// The lease-shaped check, and it only covers the four answers it names. A
// profile that asks for capacity or assetStanding composes its own: see
// docs/memoria.md D-63.
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
