// fixtures.ts: Synthetic claims used across the core tests. The values are deliberately
// distinctive (odd amounts, a rare month) so an invariant test can search a serialised
// disclosure for them and know a match is not a coincidence.

import type {
  AssetStandingClaim,
  CapacityClaim,
  FormalityClaim,
  IdentityClaim,
  IncomeClaim,
  StandingClaim,
} from "../../src/claims.ts";

export const SUBJECT_REF = "0a".repeat(32);
export const OTHER_REF = "0b".repeat(32);
export const LIST_ROOT = "0c".repeat(32);
// The asset carries a salted ref of its own, and it is not the subject's.
export const ASSET_REF = "0d".repeat(32);
export const NOW = 1_760_000_000; // unix seconds
export const DAY = 86_400;

export const identity: IdentityClaim = {
  kind: "identity",
  jurisdiction: "CO",
  documentKind: "CC",
  subjectRef: { hex: SUBJECT_REF },
  documentValid: true,
  subjectAlive: true,
  ofAge: true,
  attestedAt: NOW - DAY,
};

// 4,812,300.00 COP a month, in cents. Distinctive on purpose.
export const income: IncomeClaim = {
  kind: "income",
  jurisdiction: "CO",
  subjectRef: { hex: SUBJECT_REF },
  monthlyMinor: 481_230_000,
  currency: "COP",
  basis: "contribution_base",
  periodsObserved: 12,
  periodsWindow: 12,
  attestedAt: NOW - DAY,
};

export const formality: FormalityClaim = {
  kind: "formality",
  jurisdiction: "CO",
  subjectRef: { hex: SUBJECT_REF },
  lastContributionMonth: 202_507,
  monthsContributedLast12: 11,
  attestedAt: NOW - DAY,
};

export const standing: StandingClaim = {
  kind: "standing",
  jurisdiction: "CO",
  subjectRef: { hex: SUBJECT_REF },
  listed: false,
  listSetRoot: LIST_ROOT,
  attestedAt: NOW - DAY,
};

export const capacity: CapacityClaim = {
  kind: "capacity",
  jurisdiction: "CO",
  subjectRef: { hex: SUBJECT_REF },
  restricted: false,
  basis: "insolvency_proceeding",
  attestedAt: NOW - DAY,
};

export const assetStanding: AssetStandingClaim = {
  kind: "assetStanding",
  jurisdiction: "CO",
  subjectRef: { hex: ASSET_REF },
  registered: true,
  encumbered: false,
  finesOutstanding: false,
  attestedAt: NOW - DAY,
};
