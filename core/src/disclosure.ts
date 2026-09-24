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

// What a contract requires is composed by whoever asks, never by this file.
// A profile is a list of requirements over the answers the envelope carries;
// `core/` knows how to check a list and nothing about which list a lease, a
// vehicle sale or a guarantee needs — criterio A16, D-63.

export type BooleanAnswer = "personhood" | "formality" | "standing" | "capacity" | "assetStanding";

export type Requirement =
  | { readonly answer: BooleanAnswer; readonly mustBe: true }
  | { readonly answer: "solvency"; readonly atLeast: SolvencyTier };

export type VerificationProfile = readonly Requirement[];

// Why a requirement was not met, kept apart on purpose: `unavailable` is an
// answer about the request — nobody asked, or no source answered — and
// `not_proven` is an answer about the subject. Folding them together is the
// mistake the whole product exists to avoid.
export type ShortfallReason = "unavailable" | "not_proven" | "below_tier";

export interface Shortfall {
  readonly answer: Requirement["answer"];
  readonly reason: ShortfallReason;
}

export type ProfileCheck =
  | { readonly status: "meets" }
  | { readonly status: "short"; readonly missing: readonly Shortfall[] }
  // A profile that requires nothing has not said what it accepts, so it is
  // never met. An empty list must not read as "everything is fine".
  | { readonly status: "unspecified" };

export function meetsProfile(disclosure: Disclosure, profile: VerificationProfile): ProfileCheck {
  if (profile.length === 0) return { status: "unspecified" };

  const missing: Shortfall[] = [];
  for (const requirement of profile) {
    if (requirement.answer === "solvency") {
      const answered = disclosure.solvency;
      if (answered === "unavailable") missing.push({ answer: "solvency", reason: "unavailable" });
      else if (answered < requirement.atLeast) missing.push({ answer: "solvency", reason: "below_tier" });
      continue;
    }
    const answered = disclosure[requirement.answer];
    if (answered === "unavailable") missing.push({ answer: requirement.answer, reason: "unavailable" });
    else if (answered !== true) missing.push({ answer: requirement.answer, reason: "not_proven" });
  }

  return missing.length === 0 ? { status: "meets" } : { status: "short", missing };
}
