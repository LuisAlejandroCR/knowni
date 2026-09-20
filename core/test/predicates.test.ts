// core/test/predicates.test.ts
// The shared spec for the predicate layer. The Circom circuits in circuits/
// evaluate the same comparisons on the same encodings, so a case added here
// is a case the circuit owes an answer to — see circuits/README.md.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SolvencyTier,
  monthsBetween,
  proveFormality,
  provePersonhood,
  proveSolvency,
  proveStanding,
} from "../src/predicates.ts";
import { DAY, LIST_ROOT, NOW, OTHER_REF, SUBJECT_REF, formality, identity, income, standing } from "./support/fixtures.ts";

const personhoodParams = {
  expectedSubjectRef: SUBJECT_REF,
  jurisdiction: "CO",
  nowUnix: NOW,
  maxAgeSeconds: 30 * DAY,
};

test("personhood holds for a current document belonging to a living adult", () => {
  assert.equal(provePersonhood(identity, personhoodParams), true);
});

test("personhood fails when the claim is about a different subject", () => {
  assert.equal(
    provePersonhood(identity, { ...personhoodParams, expectedSubjectRef: OTHER_REF }),
    false,
  );
});

test("personhood fails on a stale attestation", () => {
  assert.equal(provePersonhood(identity, { ...personhoodParams, maxAgeSeconds: 60 }), false);
});

test("personhood fails on an attestation dated in the future", () => {
  // Clock skew or forgery; either way it must not be treated as very fresh.
  const future = { ...identity, attestedAt: NOW + DAY };
  assert.equal(provePersonhood(future, personhoodParams), false);
});

for (const field of ["documentValid", "subjectAlive", "ofAge"] as const) {
  test(`personhood fails when ${field} is false`, () => {
    assert.equal(provePersonhood({ ...identity, [field]: false }, personhoodParams), false);
  });
}

const solvencyParams = {
  expectedSubjectRef: SUBJECT_REF,
  monthlyObligationMinor: 150_000_000, // 1,500,000.00 COP
  currency: "COP",
  nowUnix: NOW,
  maxAgeSeconds: 30 * DAY,
  acceptedBases: ["social_security", "payroll"] as const,
};

test("solvency bands are multiples of the obligation, not absolute salaries", () => {
  const at = (monthlyMinor: number) => proveSolvency({ ...income, monthlyMinor }, solvencyParams);
  assert.equal(at(149_999_999), SolvencyTier.NONE);
  assert.equal(at(150_000_000), SolvencyTier.BASIC);
  assert.equal(at(299_999_999), SolvencyTier.BASIC);
  assert.equal(at(300_000_000), SolvencyTier.COMFORTABLE);
  assert.equal(at(450_000_000), SolvencyTier.STRONG);
  assert.equal(at(481_230_000), SolvencyTier.STRONG);
});

test("solvency refuses a basis the relying party did not accept", () => {
  const declared = { ...income, basis: "declared" as const };
  assert.equal(proveSolvency(declared, solvencyParams), SolvencyTier.NONE);
});

test("solvency refuses a currency mismatch rather than comparing raw numbers", () => {
  // 481,230,000 minor units of USD would clear a COP obligation trivially.
  const usd = { ...income, currency: "USD" };
  assert.equal(proveSolvency(usd, solvencyParams), SolvencyTier.NONE);
});

test("solvency treats a zero obligation as unusable, not as universally satisfied", () => {
  assert.equal(
    proveSolvency(income, { ...solvencyParams, monthlyObligationMinor: 0 }),
    SolvencyTier.NONE,
  );
});

const formalityParams = {
  expectedSubjectRef: SUBJECT_REF,
  nowMonth: 202_509,
  maxMonthsSinceLastContribution: 2,
  minMonthsContributedLast12: 6,
};

test("formality accepts a contribution two months old", () => {
  assert.equal(proveFormality(formality, formalityParams), true);
});

test("formality rejects a contribution older than the window", () => {
  assert.equal(
    proveFormality({ ...formality, lastContributionMonth: 202_505 }, formalityParams),
    false,
  );
});

test("formality rejects a sporadic contributor", () => {
  assert.equal(
    proveFormality({ ...formality, monthsContributedLast12: 3 }, formalityParams),
    false,
  );
});

test("month arithmetic crosses year boundaries", () => {
  assert.equal(monthsBetween(202_411, 202_502), 3);
  assert.equal(monthsBetween(202_501, 202_501), 0);
  assert.equal(monthsBetween(202_312, 202_501), 13);
});

test("month arithmetic rejects a value that is not YYYYMM", () => {
  assert.throws(() => monthsBetween(202_513, 202_601), RangeError);
  assert.throws(() => monthsBetween(2025, 202_601), RangeError);
});

const standingParams = {
  expectedSubjectRef: SUBJECT_REF,
  acceptedListSetRoot: LIST_ROOT,
  nowUnix: NOW,
  maxAgeSeconds: 7 * DAY,
};

test("standing holds only against the snapshot the relying party named", () => {
  assert.equal(proveStanding(standing, standingParams), true);
  assert.equal(proveStanding({ ...standing, listSetRoot: "d".repeat(64) }, standingParams), false);
});

test("standing fails when the subject is on the list", () => {
  assert.equal(proveStanding({ ...standing, listed: true }, standingParams), false);
});
