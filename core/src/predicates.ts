// predicates.ts: the predicates, as pure functions over a claim and public parameters.
// The off-circuit reference implementation: no clock, no I/O, no randomness, so a
// test can pin `now` and a circuit can be handed the same values.

import type {
  AssetStandingClaim,
  CapacityClaim,
  FormalityClaim,
  IdentityClaim,
  IncomeClaim,
  SanctionsClaim,
} from "./claims.ts";

export const SolvencyTier = {
  NONE: 0, // below the requested rent
  BASIC: 1, // >= 1x
  COMFORTABLE: 2, // >= 2x
  STRONG: 3, // >= 3x — the ratio most Colombian agencies ask for
} as const;

export type SolvencyTier = (typeof SolvencyTier)[keyof typeof SolvencyTier];

export interface PersonhoodParams {
  readonly expectedSubjectRef: string;
  readonly jurisdiction: string;
  readonly nowUnix: number;
  // How stale an identity attestation may be before it must be refreshed.
  readonly maxAgeSeconds: number;
}

export function provePersonhood(claim: IdentityClaim, params: PersonhoodParams): boolean {
  return (
    claim.subjectRef.hex === params.expectedSubjectRef &&
    claim.jurisdiction === params.jurisdiction &&
    claim.documentValid &&
    claim.subjectAlive &&
    claim.ofAge &&
    withinAge(claim.attestedAt, params.nowUnix, params.maxAgeSeconds)
  );
}

export interface SolvencyParams {
  readonly expectedSubjectRef: string;
  // The rent (or instalment) being underwritten, in the same minor units and
  // currency as the claim. Public: the landlord already knows it.
  readonly monthlyObligationMinor: number;
  readonly currency: string;
  readonly nowUnix: number;
  readonly maxAgeSeconds: number;
  readonly acceptedBases: readonly IncomeClaim["basis"][];
  // How the figure may have been learned. Empty accepts nothing, like
  // `acceptedBases`: a relying party that named no route has not said what
  // evidence it would take, and defaulting to "any" would quietly accept a
  // self-declared figure wherever an observed one was meant.
  readonly acceptedProvenance: readonly IncomeClaim["provenance"][];
  // How many periods with data the relying party requires. Theirs to set and
  // public, like the obligation itself.
  readonly minPeriodsObserved: number;
}

export function proveSolvency(claim: IncomeClaim, params: SolvencyParams): SolvencyTier {
  const admissible =
    claim.subjectRef.hex === params.expectedSubjectRef &&
    claim.currency === params.currency &&
    // An empty list accepts nothing: a relying party that named no basis has
    // not said what evidence it would take.
    params.acceptedBases.length > 0 &&
    params.acceptedBases.includes(claim.basis) &&
    params.acceptedProvenance.length > 0 &&
    params.acceptedProvenance.includes(claim.provenance) &&
    claim.periodsObserved >= params.minPeriodsObserved &&
    withinAge(claim.attestedAt, params.nowUnix, params.maxAgeSeconds);

  if (!admissible) return SolvencyTier.NONE;

  const rent = params.monthlyObligationMinor;
  // A zero obligation would make every claim STRONG by division; treat it as
  // an unusable parameter rather than silently flattering the subject.
  if (!Number.isSafeInteger(rent) || rent <= 0) return SolvencyTier.NONE;

  if (claim.monthlyMinor >= rent * 3) return SolvencyTier.STRONG;
  if (claim.monthlyMinor >= rent * 2) return SolvencyTier.COMFORTABLE;
  if (claim.monthlyMinor >= rent) return SolvencyTier.BASIC;
  return SolvencyTier.NONE;
}

export interface FormalityParams {
  readonly expectedSubjectRef: string;
  readonly nowMonth: number; // YYYYMM
  readonly maxMonthsSinceLastContribution: number;
  readonly minMonthsContributedLast12: number;
}

export function proveFormality(claim: FormalityClaim, params: FormalityParams): boolean {
  return (
    claim.subjectRef.hex === params.expectedSubjectRef &&
    monthsBetween(claim.lastContributionMonth, params.nowMonth) <=
      params.maxMonthsSinceLastContribution &&
    claim.monthsContributedLast12 >= params.minMonthsContributedLast12
  );
}

export interface SanctionsParams {
  readonly expectedSubjectRef: string;
  // The snapshot the relying party accepts. A "clean" answer against a root
  // nobody published, or against last year's list, is not an answer.
  readonly acceptedListSetRoot: string;
  readonly nowUnix: number;
  readonly maxAgeSeconds: number;
}

export function proveSanctions(claim: SanctionsClaim, params: SanctionsParams): boolean {
  return (
    claim.subjectRef.hex === params.expectedSubjectRef &&
    claim.listSetRoot === params.acceptedListSetRoot &&
    !claim.listed &&
    withinAge(claim.attestedAt, params.nowUnix, params.maxAgeSeconds)
  );
}

export interface CapacityParams {
  readonly expectedSubjectRef: string;
  readonly jurisdiction: string;
  readonly acceptedBases: readonly CapacityClaim["basis"][];
  readonly nowUnix: number;
  readonly maxAgeSeconds: number;
}

export function proveCapacity(claim: CapacityClaim, params: CapacityParams): boolean {
  return (
    claim.subjectRef.hex === params.expectedSubjectRef &&
    claim.jurisdiction === params.jurisdiction &&
    params.acceptedBases.includes(claim.basis) &&
    !claim.restricted &&
    withinAge(claim.attestedAt, params.nowUnix, params.maxAgeSeconds)
  );
}

export interface AssetStandingParams {
  readonly expectedAssetRef: string;
  readonly jurisdiction: string;
  readonly nowUnix: number;
  readonly maxAgeSeconds: number;
  // Outstanding fines block a transfer in Colombia, but whether they
  // disqualify the deal is the buyer's call, not ours.
  readonly requireNoFines: boolean;
}

export function proveAssetStanding(claim: AssetStandingClaim, params: AssetStandingParams): boolean {
  return (
    claim.subjectRef.hex === params.expectedAssetRef &&
    claim.jurisdiction === params.jurisdiction &&
    claim.registered &&
    !claim.encumbered &&
    (!params.requireNoFines || !claim.finesOutstanding) &&
    withinAge(claim.attestedAt, params.nowUnix, params.maxAgeSeconds)
  );
}

export function monthsBetween(fromYyyymm: number, toYyyymm: number): number {
  const [fy, fm] = splitYyyymm(fromYyyymm);
  const [ty, tm] = splitYyyymm(toYyyymm);
  return (ty - fy) * 12 + (tm - fm);
}

function splitYyyymm(value: number): [number, number] {
  if (!Number.isSafeInteger(value) || value < 100001 || value > 999912) {
    throw new RangeError(`expected YYYYMM, got ${value}`);
  }
  const month = value % 100;
  if (month < 1 || month > 12) throw new RangeError(`month out of range in ${value}`);
  return [Math.floor(value / 100), month];
}

// A claim attested in the future is not "very fresh" — it is a clock skew or
// a forgery, and either way it must not pass.
function withinAge(attestedAt: number, nowUnix: number, maxAgeSeconds: number): boolean {
  const age = nowUnix - attestedAt;
  return age >= 0 && age <= maxAgeSeconds;
}
