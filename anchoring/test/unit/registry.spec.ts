// registry.spec.ts: The chain-agnostic claim, exercised: the same verification anchors to two
// different chains with no change to anything above the registry.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createAnchorRegistry } from "../../src/registry.ts";
import { createMemoryAnchor } from "../../src/adapters/memory.ts";
import { createStellarMemoAnchor } from "../../src/adapters/stellar.ts";

const COMMITMENT = { hex: "ab".repeat(32) };
const NULLIFIER = { hex: "cd".repeat(32) };

test("an application selects a chain by id and gets a port", async () => {
  const registry = createAnchorRegistry();
  registry.register(createMemoryAnchor("memory"));
  registry.register(
    createStellarMemoAnchor({ async sendMemoHash() { return { hash: "T" }; } }, { chain: "stellar:testnet" }),
  );

  assert.deepEqual(registry.chains(), ["memory", "stellar:testnet"]);

  // The same request, anchored on two chains, with no branch on chain name
  // anywhere above this line.
  for (const chain of registry.chains()) {
    const port = registry.get(chain)!;
    const result = await port.anchor({ commitment: COMMITMENT, nullifier: NULLIFIER });
    assert.equal(result.status, "anchored", `${chain} should anchor`);
  }
});

test("an unregistered chain resolves to undefined rather than a default", () => {
  // Silently falling back to some other chain would anchor evidence
  // somewhere nobody agreed to.
  const registry = createAnchorRegistry();
  registry.register(createMemoryAnchor());
  assert.equal(registry.get("stellar:pubnet"), undefined);
});

test("registering a chain twice is an error, not an overwrite", () => {
  const registry = createAnchorRegistry();
  registry.register(createMemoryAnchor("memory"));
  assert.throws(() => registry.register(createMemoryAnchor("memory")), /already registered/);
});

test("a malformed chain id is refused at registration", () => {
  // The cost of an open ChainId is that the id is validated somewhere; this
  // is that somewhere.
  const registry = createAnchorRegistry();
  for (const bad of ["Stellar", "stellar testnet", "", "stellar:", ":testnet"]) {
    assert.throws(() => registry.register(createMemoryAnchor(bad)), TypeError, `expected ${bad} to be refused`);
  }
});

test("the memory anchor refuses a nullifier it has already seen", async () => {
  const port = createMemoryAnchor();
  assert.equal((await port.anchor({ commitment: COMMITMENT, nullifier: NULLIFIER })).status, "anchored");
  const replay = await port.anchor({ commitment: COMMITMENT, nullifier: NULLIFIER });
  assert.equal(replay.status, "degraded");
  assert.equal(replay.status === "degraded" && replay.degraded.reason, "nullifier_already_spent");
  assert.equal(port.spent(NULLIFIER.hex), true);
});
