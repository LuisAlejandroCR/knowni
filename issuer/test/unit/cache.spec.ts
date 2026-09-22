// cache.spec.ts: cache keys hide subject data and cached work is single-flight.
// Expiry, failures and capacity never turn a stale or failed issuance into a
// reusable answer.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryIssuanceCache, issuanceCacheKey } from "../../src/cache.ts";

const secret = Uint8Array.from({ length: 32 }, (_, index) => index);
const identity = {
  accessKey: "notaria-secret",
  documentKind: "CC",
  documentNumber: "1020304050",
  plate: "ABC123",
  consented: ["listas", "registraduria"],
  paymentRef: "ab".repeat(32),
  paymentTx: "cd".repeat(32),
};

test("the key is opaque and every answer-changing field changes it", () => {
  const base = issuanceCacheKey(secret, identity);
  assert.match(base, /^[0-9a-f]{64}$/);
  for (const sensitive of Object.values(identity).flat()) assert.equal(base.includes(String(sensitive)), false);

  const variants = [
    { ...identity, accessKey: "otra" },
    { ...identity, documentKind: "CE" },
    { ...identity, documentNumber: "1020304051" },
    { ...identity, plate: "XYZ987" },
    { ...identity, consented: ["registraduria"] },
    { ...identity, paymentRef: "ef".repeat(32) },
    { ...identity, paymentTx: "01".repeat(32) },
  ];
  for (const variant of variants) assert.notEqual(issuanceCacheKey(secret, variant), base);
  assert.equal(
    issuanceCacheKey(secret, { ...identity, consented: [...identity.consented].reverse() }),
    base,
  );
});

test("identical concurrent requests execute their producer once", async () => {
  const cache = createMemoryIssuanceCache<string>();
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  const create = async () => {
    calls += 1;
    await barrier;
    return { value: "signed", expiresAt: 200 };
  };
  const first = cache.resolve("key", 100, create);
  const second = cache.resolve("key", 100, create);
  release();
  assert.deepEqual(await first, { value: "signed", cached: false });
  assert.deepEqual(await second, { value: "signed", cached: true });
  assert.equal(calls, 1);
});

test("failures are forgotten and expiry is an exact boundary", async () => {
  const cache = createMemoryIssuanceCache<string>();
  let calls = 0;
  await assert.rejects(() => cache.resolve("failure", 100, async () => {
    calls += 1;
    throw new Error("provider down");
  }));
  assert.deepEqual(await cache.resolve("failure", 100, async () => {
    calls += 1;
    return { value: "recovered", expiresAt: 101 };
  }), { value: "recovered", cached: false });
  assert.deepEqual(await cache.resolve("failure", 100, async () => {
    throw new Error("must not run");
  }), { value: "recovered", cached: true });
  assert.deepEqual(await cache.resolve("failure", 101, async () => {
    calls += 1;
    return { value: "fresh", expiresAt: 201 };
  }), { value: "fresh", cached: false });
  assert.equal(calls, 3);
});

test("concurrent callers share the same failure and a later call can retry", async () => {
  const cache = createMemoryIssuanceCache<string>();
  let reject!: (error: Error) => void;
  const barrier = new Promise<never>((_resolve, rejectPromise) => { reject = rejectPromise; });
  let calls = 0;
  const create = async () => {
    calls += 1;
    return barrier;
  };
  const first = cache.resolve("key", 100, create);
  const second = cache.resolve("key", 100, create);
  reject(new Error("provider down"));
  await assert.rejects(first, /provider down/);
  await assert.rejects(second, /provider down/);
  assert.equal(calls, 1);
  assert.equal((await cache.resolve("key", 100, async () => ({ value: "recovered", expiresAt: 200 }))).value, "recovered");
});

test("capacity pressure never evicts in-flight work", async () => {
  const cache = createMemoryIssuanceCache<string>(1);
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  const createA = async () => {
    calls += 1;
    await barrier;
    return { value: "a", expiresAt: 200 };
  };
  const firstA = cache.resolve("a", 100, createA);
  const b = cache.resolve("b", 100, async () => ({ value: "b", expiresAt: 200 }));
  const secondA = cache.resolve("a", 100, createA);
  release();
  assert.equal((await firstA).value, "a");
  assert.equal((await secondA).value, "a");
  assert.equal((await b).value, "b");
  assert.equal(calls, 1);
});

test("capacity evicts the oldest entry without changing another", async () => {
  const cache = createMemoryIssuanceCache<string>(1);
  let calls = 0;
  const put = (key: string) => cache.resolve(key, 100, async () => ({ value: `${key}-${++calls}`, expiresAt: 200 }));
  assert.equal((await put("a")).value, "a-1");
  assert.equal((await put("b")).value, "b-2");
  assert.equal((await put("a")).value, "a-3");
  assert.throws(() => createMemoryIssuanceCache(0), /positive integer/);
});
