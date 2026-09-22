// access.spec.ts: who may call /issue, and how often — checked without a
// server, against the pure functions that the HTTP layer wraps.

import { test } from "node:test";
import assert from "node:assert/strict";

import { checkAccess, createMemoryRequestQuota, type AccessPolicy } from "../../src/access.ts";

const NOW = 1_760_000_000;
const policy: AccessPolicy = { keys: new Set(["notaria-17-key"]) };

test("no key at all is refused, not treated as an anonymous caller", () => {
  const result = checkAccess(undefined, policy, createMemoryRequestQuota(), NOW);
  assert.deepEqual(result, { status: "refused", reason: "missing_key" });
});

test("an empty string is refused the same as a missing key", () => {
  const result = checkAccess("", policy, createMemoryRequestQuota(), NOW);
  assert.deepEqual(result, { status: "refused", reason: "missing_key" });
});

test("a key nobody issued is refused", () => {
  const result = checkAccess("guessed", policy, createMemoryRequestQuota(), NOW);
  assert.deepEqual(result, { status: "refused", reason: "unknown_key" });
});

test("a recognized key is allowed", () => {
  const result = checkAccess("notaria-17-key", policy, createMemoryRequestQuota(), NOW);
  assert.deepEqual(result, { status: "allowed" });
});

test("a key over its per-minute budget is throttled, not blocked forever", () => {
  const quota = createMemoryRequestQuota(2);
  assert.equal(checkAccess("notaria-17-key", policy, quota, NOW).status, "allowed");
  assert.equal(checkAccess("notaria-17-key", policy, quota, NOW).status, "allowed");
  assert.deepEqual(checkAccess("notaria-17-key", policy, quota, NOW), {
    status: "refused",
    reason: "rate_limited",
  });
  // A new minute is a fresh window.
  assert.equal(checkAccess("notaria-17-key", policy, quota, NOW + 60).status, "allowed");
});

test("one key's budget never borrows from another's", () => {
  const twoKeys: AccessPolicy = { keys: new Set(["a", "b"]) };
  const quota = createMemoryRequestQuota(1);
  assert.equal(checkAccess("a", twoKeys, quota, NOW).status, "allowed");
  assert.equal(checkAccess("b", twoKeys, quota, NOW).status, "allowed");
  assert.equal(checkAccess("a", twoKeys, quota, NOW).status, "refused");
});
