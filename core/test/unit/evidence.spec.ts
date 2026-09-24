// evidence.spec.ts: three evidences that must not pass for one another.
// An IBC is a declared base, a payroll figure is what someone was paid and a
// bank inflow is what arrived. Merging them is how a product starts lying.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { IncomeClaim } from "../../src/claims.ts";
import { BASIS_DOES_NOT_ESTIMATE } from "../../src/claims.ts";
import { SolvencyTier, proveSolvency } from "../../src/predicates.ts";

const NOW = 1_760_000_000;
const REF = "0a".repeat(32);
const RENT = 1_000_000;

const income = (over: Partial<IncomeClaim> = {}): IncomeClaim => ({
  kind: "income",
  jurisdiction: "CO",
  subjectRef: { hex: REF },
  monthlyMinor: RENT * 3,
  currency: "COP",
  basis: "contribution_base",
  provenance: "observed",
  periodsObserved: 12,
  periodsWindow: 12,
  attestedAt: NOW - 60,
  ...over,
});

const params = {
  expectedSubjectRef: REF,
  monthlyObligationMinor: RENT,
  currency: "COP",
  nowUnix: NOW,
  maxAgeSeconds: 86_400,
  minPeriodsObserved: 6,
  acceptedBases: ["contribution_base"] as const,
  acceptedProvenance: ["observed"] as const,
};

test("a contribution base answers a request that asked for one", () => {
  assert.equal(proveSolvency(income(), params), SolvencyTier.STRONG);
});

test("bank inflows do not answer a request for a contribution base, and the reverse", () => {
  // The counterparty asked what was declared to social security. What arrived
  // in an account is a different fact, however large.
  assert.equal(proveSolvency(income({ basis: "cashflow" }), params), SolvencyTier.NONE);
  assert.equal(
    proveSolvency(income(), { ...params, acceptedBases: ["cashflow"] }),
    SolvencyTier.NONE,
  );
});

test("a relying party that named no basis gets nothing", () => {
  // An empty list is not "anything goes": it is a question that was never
  // asked, and a tier handed out for it would be invented.
  assert.equal(proveSolvency(income(), { ...params, acceptedBases: [] }), SolvencyTier.NONE);
});

test("one good month is not a year of them", () => {
  assert.equal(proveSolvency(income({ periodsObserved: 1 }), params), SolvencyTier.NONE);
  assert.equal(
    proveSolvency(income({ periodsObserved: 1 }), { ...params, minPeriodsObserved: 1 }),
    SolvencyTier.STRONG,
  );
});

test("every basis carries what it does not estimate, and none of them claims to predict payment", () => {
  for (const basis of ["contribution_base", "verified_income", "cashflow"] as const) {
    const text = BASIS_DOES_NOT_ESTIMATE[basis];
    assert.ok(text.length > 0, `${basis} has no disclaimer`);
    assert.match(text, /No (estima|prueba)/);
  }
  assert.match(BASIS_DOES_NOT_ESTIMATE.contribution_base, /probabilidad de pago/);
  assert.match(BASIS_DOES_NOT_ESTIMATE.cashflow, /No prueba empleo/);
});

test("the periods a figure covers change its commitment", async () => {
  const { commitClaim, randomSalt } = await import("../../src/commitment.ts");
  const { poseidonHash } = await import("../../src/node.ts");
  const salt = randomSalt(poseidonHash.prime);
  assert.notEqual(
    commitClaim(poseidonHash, income({ periodsObserved: 12 }), salt),
    commitClaim(poseidonHash, income({ periodsObserved: 3 }), salt),
  );
});
