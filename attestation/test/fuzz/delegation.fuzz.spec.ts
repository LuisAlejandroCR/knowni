// delegation.fuzz.spec.ts: delegations arrive from an agent, outside the process.
// Whatever the shape, the check answers with a typed refusal and never throws.

import { test } from "node:test";
import assert from "node:assert/strict";

import { toHex } from "@knowni/core";
import { checkDelegation, signDelegation, type Delegation } from "../../src/index.ts";
import { nodeSignatures } from "../../src/node.ts";

const NOW = 1_760_000_000;
const seed = nodeSignatures.randomSeed();
const agentKey = toHex(nodeSignatures.publicKeyOf(nodeSignatures.randomSeed()));
const valid = signDelegation(nodeSignatures, seed, {
  id: "0f".repeat(16),
  subjectKey: toHex(nodeSignatures.publicKeyOf(seed)),
  agentKey,
  purpose: "vehicle-sale",
  relyingPartyId: "notaria-17",
  notBefore: NOW - 60,
  expiresAt: NOW + 3600,
});
const context = { nowUnix: NOW, agentKey, purpose: "vehicle-sale", relyingPartyId: "notaria-17" };

const junk: readonly unknown[] = [null, undefined, 0, -1, 1.5, "", "zz", "0".repeat(129), {}, [], true, NaN, 2 ** 64];

let state = 0x9e3779b9;
const next = (): number => {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 2 ** 32;
};

test("mutated delegations are refused with a reason and never throw", () => {
  const keys = Object.keys(valid) as (keyof Delegation)[];
  for (let round = 0; round < 2000; round += 1) {
    const mutated: Record<string, unknown> = { ...valid };
    const key = keys[Math.floor(next() * keys.length)]!;
    mutated[key] = junk[Math.floor(next() * junk.length)];
    const result = checkDelegation(nodeSignatures, mutated as unknown as Delegation, context);
    assert.equal(result.status, "invalid");
  }
});

test("non-objects are refused as malformed", () => {
  for (const value of [null, undefined, 1, "delegation", []]) {
    const result = checkDelegation(nodeSignatures, value as unknown as Delegation, context);
    assert.deepEqual(result, { status: "invalid", reason: "malformed" });
  }
});
