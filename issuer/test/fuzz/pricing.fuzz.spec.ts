// pricing.fuzz.spec.ts: the money boundary against predicate names nobody
// published. `/quote` answers without an access key, so the list of predicates
// it prices is the least trusted input this service takes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { PRICE_MINOR, chargeableMinor, quote } from "../../src/pricing.ts";

const PUBLISHED = [...PRICE_MINOR.keys()];
const NOW = 1_700_000_000;
const REQUEST = {
  relyingPartyId: "notaria-17",
  purpose: "vehicle-sale",
  nonce: "ab".repeat(16),
  expiresAt: NOW + 600,
  paramsHash: "cd".repeat(32),
};

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/// Names that resolve to something on every JavaScript object, and names that
/// resolve to nothing anywhere.
const NOT_A_PREDICATE = [
  "__proto__",
  "constructor",
  "prototype",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "",
  " personhood",
  "PERSONHOOD",
  "personhood\u0000",
];

test("a predicate nobody published is never quoted, whatever it is named", () => {
  for (const name of NOT_A_PREDICATE) {
    const result = quote(REQUEST, [name], NOW);
    assert.deepEqual(result, { status: "refused", reason: "unknown_predicate" }, `"${name}" was quoted`);
  }
});

test("one unpublished predicate refuses the whole quote, wherever it sits in the list", () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const next = rng(seed);
    const predicates = Array.from({ length: 1 + Math.floor(next() * 4) }, () =>
      PUBLISHED[Math.floor(next() * PUBLISHED.length)]!,
    );
    const at = Math.floor(next() * (predicates.length + 1));
    const hostile = NOT_A_PREDICATE[Math.floor(next() * NOT_A_PREDICATE.length)]!;
    predicates.splice(at, 0, hostile);

    const result = quote(REQUEST, predicates, NOW);
    assert.equal(result.status, "refused", `seed ${seed}: ${JSON.stringify(predicates)} was quoted`);
  }
});

// The type says `number`. Before `PRICE_MINOR` was a `Map`, a predicate named
// `constructor` made the total a string — "0function Object() { [native code] }".
test("a quoted total is a number, and it is the sum of its lines", () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const next = rng(seed);
    const predicates = Array.from({ length: 1 + Math.floor(next() * 4) }, () =>
      PUBLISHED[Math.floor(next() * PUBLISHED.length)]!,
    );

    const result = quote(REQUEST, predicates, NOW);
    assert.equal(result.status, "quoted");
    if (result.status !== "quoted") continue;
    assert.equal(typeof result.quote.totalMinor, "number");
    assert.ok(Number.isSafeInteger(result.quote.totalMinor));
    assert.equal(
      result.quote.totalMinor,
      result.quote.lines.reduce((sum, line) => sum + line.priceMinor, 0),
    );
  }
});

test("an answer about something nobody published is charged nothing, not something", () => {
  for (const predicate of NOT_A_PREDICATE) {
    assert.equal(chargeableMinor([{ predicate, value: true }]), 0, `"${predicate}" was charged`);
  }
});
