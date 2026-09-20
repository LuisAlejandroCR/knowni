// core/src/predicates.ts
// The predicates, as pure functions over a claim and PUBLIC parameters.
//
// This module is the off-circuit reference implementation: the circuit in
// circuits/ evaluates the same comparisons over the same encodings, and
// core/test/predicates.test.ts is the shared spec both sides are checked
// against. Keeping it pure and dependency-free is what makes that possible
// — there is no clock, no I/O and no randomness in here, so a test can pin
// "now" and a circuit can be handed the same value as a public input.
//
// Every function returns an outcome and NOTHING else. No function in this
// file returns, logs or embeds the claim it read.

import type { FormalityClaim, IdentityClaim, IncomeClaim, StandingClaim } from "./claims.ts";

// What a solvency proof discloses. A band, never an amount: a landlord
// needs to know the rent is covered, and "COP 4,812,300/month" is a fact
// about someone's life that answers a question nobody asked.
//
// The bands are multiples of the rent, not absolute salaries, which is what
// makes the same enum work in Bogotá and in Lima without a table of
// country-specific thresholds.
// A const object rather than a TypeScript `enum`: enums are the one piece of
// TS syntax that emits runtime code, so they are rejected by Node's
// type-stripping loader — and this repository runs its tests with no build
// step at all. The companion type gives the same compile-time safety.
export const SolvencyTier = {
  NONE: 0, // below the requested rent
  BASIC: 1, // >= 1x
  COMFORTABLE: 2, // >= 2x
  STRONG: 3, // >= 3x — the ratio most Colombian agencies ask for
} as const;

export type SolvencyTier = (typeof SolvencyTier)[keyof typeof SolvencyTier];

export interface PersonhoodParams {
  // The ref the relying party was given at the start of the session. The
  // predicate checks the claim is about THIS subject, which is what stops a
  // valid attestation issued for someone else being replayed.
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
  // Which bases the relying party will accept. A landlord may insist on
  // contributions data and refuse a self-declared figure; that is their call
  // to make in public, not ours to make silently.
  readonly acceptedBases: readonly IncomeClaim["basis"][];
}

export function proveSolvency(claim: IncomeClaim, params: SolvencyParams): SolvencyTier {
  const admissible =
    claim.subjectRef.hex === params.expectedSubjectRef &&
    claim.currency === params.currency &&
    params.acceptedBases.includes(claim.basis) &&
    withinAge(claim.attestedAt, params.nowUnix, params.maxAgeSeconds);

  if (!admissible) return SolvencyTier.NONE;

  const rent = params.monthlyObligationMinor;
  // A zero obligation would make every claim STRONG by division; treat it as
  // an unusable parameter rather than silently flattering the subject.
  if (!Number.isSafeInteger(rent) || rent <= 0) return SolvencyTier.NONE;

  // Multiplication, not division: integer division would round a subject who
  // earns 2.99x the rent up or down depending on the operand order, and the
  // circuit has no floats to fall back on either.
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

export interface StandingParams {
  readonly expectedSubjectRef: string;
  // The snapshot the relying party accepts. A "clean" answer against a root
  // nobody published, or against last year's list, is not an answer.
  readonly acceptedListSetRoot: string;
  readonly nowUnix: number;
  readonly maxAgeSeconds: number;
}

export function proveStanding(claim: StandingClaim, params: StandingParams): boolean {
  return (
    claim.subjectRef.hex === params.expectedSubjectRef &&
    claim.listSetRoot === params.acceptedListSetRoot &&
    !claim.listed &&
    withinAge(claim.attestedAt, params.nowUnix, params.maxAgeSeconds)
  );
}

// Converts two YYYYMM integers into a month distance. Written out rather
// than done with Date, because a circuit has no calendar: this is exactly
// the arithmetic the Compact/Circom version performs on the same integers.
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
