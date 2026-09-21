// pricing.spec.ts: the quote, and the rule that an unanswered source is free.
// Price is the lever that discourages asking beyond the purpose, so it has to
// be per predicate and it has to bind to the question it was quoted for.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { SessionRequest } from "@knowni/core";
import { PRICE_MINOR, chargeableMinor, paymentRef, quote } from "../../src/pricing.ts";

const NOW = 1_760_000_000;
const request: SessionRequest = {
  relyingPartyId: "notaria-17",
  purpose: "vehicle-sale",
  nonce: "ab".repeat(16),
  expiresAt: NOW + 600,
  paramsHash: "cd".repeat(32),
};

test("asking for more costs more, line by line", () => {
  const two = quote(request, ["personhood", "capacity"], NOW);
  const four = quote(request, ["personhood", "capacity", "sanctions", "assetStanding"], NOW);
  assert.equal(two.status, "quoted");
  assert.equal(four.status, "quoted");
  const totalOf = (r: typeof two) => (r.status === "quoted" ? r.quote.totalMinor : 0);
  assert.ok(totalOf(four) > totalOf(two));
  assert.equal(totalOf(two), PRICE_MINOR.personhood! + PRICE_MINOR.capacity!);
});

test("a predicate with no published price is refused, not invented", () => {
  assert.deepEqual(quote(request, ["personhood", "creditScore"], NOW), {
    status: "refused",
    reason: "unknown_predicate",
  });
  assert.deepEqual(quote(request, [], NOW), { status: "refused", reason: "empty_request" });
});

test("the payment reference binds to the question and to the predicates quoted", () => {
  const base = paymentRef(request, ["personhood", "capacity"]);
  assert.match(base, /^[0-9a-f]{64}$/);
  // Same predicates in another order is the same question.
  assert.equal(base, paymentRef(request, ["capacity", "personhood"]));
  // A different challenge, audience, purpose or parameter set is not.
  for (const other of [
    { ...request, nonce: "11".repeat(16) },
    { ...request, relyingPartyId: "otra-notaria" },
    { ...request, purpose: "lease" },
    { ...request, paramsHash: "99".repeat(32) },
  ]) {
    assert.notEqual(base, paymentRef(other, ["personhood", "capacity"]));
  }
  // And adding a predicate after paying does not reuse the payment.
  assert.notEqual(base, paymentRef(request, ["personhood", "capacity", "sanctions"]));
});

test("a quote expires, so a price cannot be held forever", () => {
  const result = quote(request, ["personhood"], NOW, 600);
  assert.equal(result.status === "quoted" && result.quote.expiresAt, NOW + 600);
});

test("an unavailable answer is not charged", () => {
  const charged = chargeableMinor([
    { predicate: "personhood", value: true },
    { predicate: "capacity", value: false },
    { predicate: "sanctions", value: "unavailable" },
  ]);
  assert.equal(charged, PRICE_MINOR.personhood! + PRICE_MINOR.capacity!);
  // Nothing answered, nothing owed.
  assert.equal(chargeableMinor([{ predicate: "personhood", value: "unavailable" }]), 0);
});

test("a false answer is still an answer, and is charged", () => {
  // Charging only for the answer the asker hoped for would pay the issuer to
  // bias the verdict.
  assert.equal(chargeableMinor([{ predicate: "capacity", value: false }]), PRICE_MINOR.capacity);
});
