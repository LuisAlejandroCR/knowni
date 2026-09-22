// ugpp.spec.ts: the documentary path, and the ways it must refuse.
// A statement the holder brought is evidence only once someone checked it is
// the one UGPP issued; unchecked, it is a PDF anybody could type.

import { test } from "node:test";
import assert from "node:assert/strict";

import { sha256Hash } from "@knowni/core/node";
import {
  UGPP_WINDOW_MONTHS,
  createUgppContributionSource,
  statementRef,
  type UgppStatement,
} from "../../src/country/colombia/ugpp.ts";

// 2026-09-21, so "this month" is 202609.
const NOW = 1_789_000_000;
const subject = { documentKind: "CC", documentNumber: "1020304050", subjectRef: "a".repeat(64) };

const statement = (over: Partial<UgppStatement> = {}): UgppStatement => ({
  periods: [
    { month: 202_606, ibcMinor: 200_000_000 },
    { month: 202_607, ibcMinor: 210_000_000 },
    { month: 202_608, ibcMinor: 205_000_000 },
    { month: 202_609, ibcMinor: 215_000_000 },
  ],
  verificationCode: "UGPP-2026-0001",
  issuedAtMonth: 202_609,
  ...over,
});

const sourceWith = (
  provided: UgppStatement | undefined,
  authentic = true,
  maxAgeMonths?: number,
) =>
  createUgppContributionSource(sha256Hash, async () => provided, {
    checkAuthenticity: async () => authentic,
    maxAgeMonths,
  });

test("a checked statement becomes a contribution-base claim over its own window", async () => {
  const result = await sourceWith(statement()).fetch(subject, NOW);
  assert.equal(result.status, "claimed");
  if (result.status !== "claimed" || result.claim.kind !== "income") throw new Error("shape");
  assert.equal(result.claim.basis, "contribution_base");
  assert.equal(result.claim.periodsWindow, UGPP_WINDOW_MONTHS);
  assert.equal(result.claim.periodsObserved, 4);
  assert.equal(result.claim.monthlyMinor, 207_500_000);
});

test("four months cannot answer a twelve-month question, and the claim says so", async () => {
  const result = await sourceWith(statement()).fetch(subject, NOW);
  // The window travels with the figure, so a relying party asking for six
  // periods gets a claim that visibly covers four.
  assert.ok(result.status === "claimed" && result.claim.kind === "income" && result.claim.periodsWindow === 4);
});

test("an unverified document is no claim at all, not a weaker one", async () => {
  const result = await sourceWith(statement(), false).fetch(subject, NOW);
  assert.deepEqual(result, { status: "degraded", reason: "needs_human_review" });
});

test("no document means no consent, not a zero", async () => {
  assert.deepEqual(await sourceWith(undefined).fetch(subject, NOW), {
    status: "degraded",
    reason: "consent_missing",
  });
});

test("a statement older than the policy is not current evidence", async () => {
  const old = statement({ issuedAtMonth: 202_601 });
  assert.deepEqual(await sourceWith(old, true, 2).fetch(subject, NOW), {
    status: "degraded",
    reason: "not_found",
  });
});

test("the claim carries no verification code, no months and no employer", async () => {
  const result = await sourceWith(statement()).fetch(subject, NOW);
  const wire = JSON.stringify(result);
  for (const secret of ["UGPP-2026-0001", "202606", "1020304050"]) {
    assert.ok(!wire.includes(secret), `${secret} leaked into the claim`);
  }
});

test("the statement reference names the document without carrying it", () => {
  const ref = statementRef(sha256Hash, statement());
  assert.match(ref, /^[0-9a-f]{64}$/);
  assert.notEqual(ref, statementRef(sha256Hash, statement({ verificationCode: "UGPP-2026-0002" })));
  assert.ok(!ref.includes("UGPP"));
});

test("a reader that throws degrades instead of taking the whole issuance down", async () => {
  const source = createUgppContributionSource(
    sha256Hash,
    async () => {
      throw new Error("el archivo no se pudo leer");
    },
    { checkAuthenticity: async () => true },
  );
  assert.deepEqual(await source.fetch(subject, NOW), {
    status: "degraded",
    reason: "source_unavailable",
  });
});
