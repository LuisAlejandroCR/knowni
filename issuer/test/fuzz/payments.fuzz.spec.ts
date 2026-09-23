// payments.fuzz.spec.ts: the money boundary against a Horizon that answers
// something else. Whatever comes back, a payment check refuses or accepts —
// it never throws, because a payer who sent money deserves a reason and the
// protocol already has a word for every one of them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyPayment, type PaymentPolicy } from "../../src/payments.ts";

const REF = "ab".repeat(32);
const TX = "cd".repeat(32);
const DESTINATION = "GDESTINATION";
const REASONS = new Set([
  "not_found",
  "unreachable",
  "failed_on_chain",
  "wrong_reference",
  "wrong_destination",
  "wrong_asset",
  "underpaid",
  "already_spent",
]);

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/// Every one of these is a string, and none of them is an amount.
const NOT_AN_AMOUNT = [
  "abc",
  "",
  " 2.5",
  "2.5 ",
  "1.5e3",
  "-5",
  "+5",
  "2.50000001",
  "0x10",
  "Infinity",
  "NaN",
  "1,5",
  "2..5",
  ".5",
  "1e999",
  "٢٥",
];

const NOT_A_STRING: unknown[] = [null, undefined, 2.5, true, {}, [], { toString: "no" }];

const alwaysSpendable = { claim: () => true };

function horizonThatAnswers(transaction: unknown, payments: unknown): typeof fetch {
  return (async (url: string | URL) =>
    new Response(JSON.stringify(String(url).endsWith("/payments") ? payments : transaction), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
}

function policyWith(fetchImpl: typeof fetch): PaymentPolicy {
  return { destination: DESTINATION, minAmountStroops: 10_000_000n, fetchImpl };
}

const paidTransaction = {
  successful: true,
  memo_type: "hash",
  memo: Buffer.from(REF, "hex").toString("base64"),
};

async function check(transaction: unknown, payments: unknown) {
  return verifyPayment(TX, REF, policyWith(horizonThatAnswers(transaction, payments)), alwaysSpendable);
}

// `BigInt("abc")` threw out of the check, past the try that only wrapped the
// fetches: the caller got a crash where "underpaid" was the true answer.
test("an amount Horizon could not have written is not money, and never throws", async () => {
  for (const amount of [...NOT_AN_AMOUNT, ...NOT_A_STRING]) {
    const result = await check(paidTransaction, {
      _embedded: { records: [{ type: "payment", to: DESTINATION, asset_type: "native", amount }] },
    });
    assert.deepEqual(
      result,
      { status: "refused", reason: "underpaid" },
      `amount ${JSON.stringify(amount)} was not refused as underpaid`,
    );
  }
});

test("a page of records that is not a list is not a page of records", async () => {
  for (const records of [{ a: 1 }, "records", 7, null, true]) {
    const result = await check(paidTransaction, { _embedded: { records } });
    assert.equal(result.status, "refused");
  }
});

test("no shape of answer makes a payment check throw", async () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    const next = rng(seed);
    const anything = (): unknown => {
      const choice = Math.floor(next() * 7);
      if (choice === 0) return null;
      if (choice === 1) return next() < 0.5;
      if (choice === 2) return Math.floor((next() - 0.5) * 1e9);
      if (choice === 3) return NOT_AN_AMOUNT[Math.floor(next() * NOT_AN_AMOUNT.length)];
      if (choice === 4) return [];
      if (choice === 5) return {};
      return { _embedded: { records: [{ type: "payment", to: DESTINATION, amount: anything() }] } };
    };

    const result = await check(anything(), anything());
    assert.equal(result.status === "paid" || result.status === "refused", true, `seed ${seed}`);
    if (result.status === "refused") {
      assert.ok(REASONS.has(result.reason), `seed ${seed}: unknown reason "${result.reason}"`);
    }
  }
});

// The fix must not have made a real payment unreadable.
test("the amount Horizon actually writes is still read to the stroop", async () => {
  const result = await check(paidTransaction, {
    _embedded: { records: [{ type: "payment", to: DESTINATION, asset_type: "native", amount: "2.5000000" }] },
  });
  assert.deepEqual(result, { status: "paid", amountStroops: 25_000_000n, txHash: TX });
});

test("several readable payments to the same destination still add up", async () => {
  const record = (amount: string) => ({ type: "payment", to: DESTINATION, asset_type: "native", amount });
  const result = await check(paidTransaction, {
    _embedded: { records: [record("0.5000000"), record("nope"), record("1.0000000")] },
  });
  assert.deepEqual(result, { status: "paid", amountStroops: 15_000_000n, txHash: TX });
});
