// pila.test.ts: What PILA can and cannot answer, made explicit.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createPilaFormalitySource, createPilaIncomeSource, type PilaClient } from "../src/country/colombia/pila.ts";

const NOW = 1_760_000_000;
const subject = { documentKind: "CC", documentNumber: "1020304050", subjectRef: "a".repeat(64) };

const clientOf = (rows: { month: number; ibcMinor: number }[]): PilaClient => ({
  async contributions() { return rows; },
});

const twelve = (ibc: number) =>
  Array.from({ length: 12 }, (_, i) => ({ month: 202_410 + i - (i > 2 ? 88 : 0), ibcMinor: ibc }));

test("income is the median of the last twelve months, not the mean", async () => {
  // Eleven ordinary months and one severance payment. The mean would read
  // this as a 4.5x earner and underwrite a year's lease against a one-off.
  const rows = [
    ...Array.from({ length: 11 }, (_, i) => ({ month: 202_410 + i, ibcMinor: 200_000_000 })),
    { month: 202_509, ibcMinor: 5_000_000_000 },
  ];
  const source = createPilaIncomeSource(clientOf(rows));
  const result = await source.fetch(subject, NOW);
  assert.equal(result.status, "claimed");
  assert.equal(
    result.status === "claimed" && result.claim.kind === "income" ? result.claim.monthlyMinor : -1,
    200_000_000,
  );
});

test("the income claim names its basis, so a landlord knows what they accepted", async () => {
  const source = createPilaIncomeSource(clientOf(twelve(200_000_000)));
  const result = await source.fetch(subject, NOW);
  assert.equal(
    result.status === "claimed" && result.claim.kind === "income" ? result.claim.basis : undefined,
    "social_security",
  );
});

test("a subject with no contributions is not-found, not zero income", async () => {
  // An informal worker looks identical to someone with no income, and
  // reporting COP 0 would let a landlord read absence as insolvency.
  const source = createPilaIncomeSource(clientOf([]));
  const result = await source.fetch(subject, NOW);
  assert.equal(result.status, "degraded");
  assert.equal(result.status === "degraded" && result.reason, "not_found");
});

test("an operator outage degrades without leaking its error text", async () => {
  const logged: unknown[] = [];
  const source = createPilaIncomeSource(
    { async contributions() { throw new Error("SOAP fault at https://operador.internal/pila?cc=1020304050"); } },
    { logError: (e) => logged.push(e) },
  );
  const result = await source.fetch(subject, NOW);
  assert.equal(result.status === "degraded" && result.reason, "source_unavailable");
  assert.equal(logged.length, 1);
  // The queried document number was in that message. Colombian registry
  // APIs do echo it, and it must not ride out on a result.
  assert.equal(JSON.stringify(result).includes("1020304050"), false);
});

test("formality counts distinct months, not rows", async () => {
  // Two employers in one month, or a correction, files two rows. Counting
  // rows would report fourteen months of contributions in a year.
  const rows = [
    { month: 202_507, ibcMinor: 100_000_000 },
    { month: 202_507, ibcMinor: 50_000_000 },
    { month: 202_508, ibcMinor: 100_000_000 },
  ];
  const source = createPilaFormalitySource(clientOf(rows));
  const result = await source.fetch(subject, NOW);
  assert.equal(
    result.status === "claimed" && result.claim.kind === "formality"
      ? result.claim.monthsContributedLast12
      : -1,
    2,
  );
});

test("formality reports the most recent month, whatever order rows arrive in", async () => {
  const rows = [
    { month: 202_505, ibcMinor: 1 },
    { month: 202_509, ibcMinor: 1 },
    { month: 202_507, ibcMinor: 1 },
  ];
  const source = createPilaFormalitySource(clientOf(rows));
  const result = await source.fetch(subject, NOW);
  assert.equal(
    result.status === "claimed" && result.claim.kind === "formality"
      ? result.claim.lastContributionMonth
      : -1,
    202_509,
  );
});

test("a malformed month is not treated as a contribution", async () => {
  const source = createPilaFormalitySource(clientOf([{ month: 202_513, ibcMinor: 1 }]));
  const result = await source.fetch(subject, NOW);
  assert.equal(result.status === "degraded" && result.reason, "invalid_response");
});

test("neither claim carries anything the predicate does not read", async () => {
  // The real PILA response has the employer's NIT, the ARL and the fund on
  // it. None of them may survive the adapter.
  const source = createPilaIncomeSource(clientOf(twelve(200_000_000)));
  const result = await source.fetch(subject, NOW);
  assert.equal(result.status, "claimed");
  const claim = result.status === "claimed" ? result.claim : undefined!;
  assert.deepEqual(Object.keys(claim).sort(), [
    "attestedAt",
    "basis",
    "currency",
    "jurisdiction",
    "kind",
    "monthlyMinor",
    "subjectRef",
  ]);
});
