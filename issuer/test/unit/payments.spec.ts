// payments.spec.ts: a payment buys the question it was quoted for, once.
// Includes the transaction this repository really sent to Stellar testnet, so
// the checks run against a shape Horizon actually produces.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createMemorySpentPayments, verifyPayment } from "../../src/payments.ts";

// The anchor from 2026-09-20: a payment to self carrying a 32-byte memo.
const REAL_TX = "0dc0fdf46ebffc72257b068fe0022a6b732c6f4b9dda5503aaa8b005f18f8161";
const REAL_MEMO_HEX = "a88721ff2ce8c84aca495dd751964fe98f41d06a955b7544394c4702da6df523";
const TREASURY = "GAZONAKJ7XIJVQI37HR2ZZKMQIISUIFAYXVCXJOCXVGQQNGM24BF2UZD";

function horizon(tx: unknown, payments: unknown[]) {
  return (async (url: string) => {
    if (String(url).endsWith("/payments")) {
      return new Response(JSON.stringify({ _embedded: { records: payments } }), { status: 200 });
    }
    if (tx === undefined) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify(tx), { status: 200 });
  }) as unknown as typeof fetch;
}

const okTx = { successful: true, memo_type: "hash", memo: Buffer.from(REAL_MEMO_HEX, "hex").toString("base64") };
const okPayment = { type: "payment", to: TREASURY, amount: "0.0100000", asset_type: "native" };

const policy = (over: Record<string, unknown> = {}) => ({
  destination: TREASURY,
  minAmountStroops: 100_000n,
  ...over,
});

test("a successful payment with the right memo and amount pays for the question", async () => {
  const result = await verifyPayment(
    REAL_TX,
    REAL_MEMO_HEX,
    policy({ fetchImpl: horizon(okTx, [okPayment]) }),
    createMemorySpentPayments(),
  );
  assert.equal(result.status, "paid");
  assert.equal(result.status === "paid" && result.amountStroops, 100_000n);
});

test("a payment for another question does not pay for this one", async () => {
  const result = await verifyPayment(
    REAL_TX,
    "f".repeat(64),
    policy({ fetchImpl: horizon(okTx, [okPayment]) }),
    createMemorySpentPayments(),
  );
  assert.deepEqual(result, { status: "refused", reason: "wrong_reference" });
});

test("a memo that is not a hash is not a reference", async () => {
  const textMemo = { successful: true, memo_type: "text", memo: "hola" };
  const result = await verifyPayment(
    REAL_TX,
    REAL_MEMO_HEX,
    policy({ fetchImpl: horizon(textMemo, [okPayment]) }),
    createMemorySpentPayments(),
  );
  assert.deepEqual(result, { status: "refused", reason: "wrong_reference" });
});

test("money that landed somewhere else, or not enough of it, is refused", async () => {
  const elsewhere = await verifyPayment(
    REAL_TX,
    REAL_MEMO_HEX,
    policy({ fetchImpl: horizon(okTx, [{ ...okPayment, to: "GOTRA...." }]) }),
    createMemorySpentPayments(),
  );
  assert.deepEqual(elsewhere, { status: "refused", reason: "wrong_destination" });

  const short = await verifyPayment(
    REAL_TX,
    REAL_MEMO_HEX,
    policy({ fetchImpl: horizon(okTx, [{ ...okPayment, amount: "0.0000001" }]) }),
    createMemorySpentPayments(),
  );
  assert.deepEqual(short, { status: "refused", reason: "underpaid" });
});

test("a failed transaction never pays", async () => {
  const result = await verifyPayment(
    REAL_TX,
    REAL_MEMO_HEX,
    policy({ fetchImpl: horizon({ ...okTx, successful: false }, [okPayment]) }),
    createMemorySpentPayments(),
  );
  assert.deepEqual(result, { status: "refused", reason: "failed_on_chain" });
});

test("one transaction pays once", async () => {
  const spent = createMemorySpentPayments();
  const check = () =>
    verifyPayment(REAL_TX, REAL_MEMO_HEX, policy({ fetchImpl: horizon(okTx, [okPayment]) }), spent);
  assert.equal((await check()).status, "paid");
  assert.deepEqual(await check(), { status: "refused", reason: "already_spent" });
});

test("a refused payment stays spendable, so nobody is charged for a question we rejected", async () => {
  const spent = createMemorySpentPayments();
  const wrong = await verifyPayment(
    REAL_TX,
    "e".repeat(64),
    policy({ fetchImpl: horizon(okTx, [okPayment]) }),
    spent,
  );
  assert.equal(wrong.status, "refused");
  const right = await verifyPayment(
    REAL_TX,
    REAL_MEMO_HEX,
    policy({ fetchImpl: horizon(okTx, [okPayment]) }),
    spent,
  );
  assert.equal(right.status, "paid");
});

test("Horizon being unreachable is its own answer, not a free pass", async () => {
  const down = (async () => {
    throw new Error("ENOTFOUND");
  }) as unknown as typeof fetch;
  const result = await verifyPayment(REAL_TX, REAL_MEMO_HEX, policy({ fetchImpl: down }), createMemorySpentPayments());
  assert.deepEqual(result, { status: "refused", reason: "unreachable" });
});

test("a transaction nobody sent is not found", async () => {
  const result = await verifyPayment(
    "0".repeat(64),
    REAL_MEMO_HEX,
    policy({ fetchImpl: horizon(undefined, []) }),
    createMemorySpentPayments(),
  );
  assert.deepEqual(result, { status: "refused", reason: "not_found" });
});
