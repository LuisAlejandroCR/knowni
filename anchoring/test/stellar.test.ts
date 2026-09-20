// anchoring/test/stellar.test.ts
// Both Stellar paths, against stub submitters. What is checked here is not
// that Stellar works — it is that this adapter never throws, never invents a
// receipt, and never lets a provider's raw error reach a result.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createStellarContractAnchor, createStellarMemoAnchor } from "../src/adapters/stellar.ts";

const COMMITMENT = { hex: "ab".repeat(32) };
const NULLIFIER = { hex: "cd".repeat(32) };

test("the memo path submits the commitment as exactly 32 bytes", () => {
  let seen: Uint8Array | undefined;
  const port = createStellarMemoAnchor({
    async sendMemoHash(hash32) {
      seen = hash32;
      return { hash: "TXHASH" };
    },
  });
  return port.anchor({ commitment: COMMITMENT }).then((result) => {
    assert.equal(result.status, "anchored");
    assert.equal(seen?.length, 32);
    assert.equal(Buffer.from(seen!).toString("hex"), COMMITMENT.hex);
  });
});

test("the memo path reports that it cannot guard replays", () => {
  // A relying party reading `replayGuarded: false` knows to keep its own
  // nullifier set. Reporting true here would be the quiet kind of wrong.
  const port = createStellarMemoAnchor({ async sendMemoHash() { return { hash: "T" }; } });
  assert.equal(port.replayGuarded, false);
  return port.anchor({ commitment: COMMITMENT }).then((r) => {
    assert.equal(r.status === "anchored" && r.receipt.replayGuarded, false);
  });
});

test("a provider outage degrades instead of throwing", async () => {
  const logged: unknown[] = [];
  const port = createStellarMemoAnchor(
    { async sendMemoHash() { throw new Error("horizon 504 at https://internal.rpc:8000"); } },
    { logError: (e) => logged.push(e) },
  );
  const result = await port.anchor({ commitment: COMMITMENT });
  assert.equal(result.status, "degraded");
  assert.equal(result.status === "degraded" && result.degraded.reason, "provider_unavailable");
  // The endpoint was logged, not returned.
  assert.equal(logged.length, 1);
  assert.equal(JSON.stringify(result).includes("internal.rpc"), false);
});

test("a malformed commitment degrades rather than being truncated onto the chain", async () => {
  const port = createStellarMemoAnchor({ async sendMemoHash() { return { hash: "T" }; } });
  const result = await port.anchor({ commitment: { hex: "abcd" } });
  assert.equal(result.status, "degraded");
  assert.equal(result.status === "degraded" && result.degraded.reason, "invalid_response");
});

test("a response with no transaction hash is not turned into a receipt", async () => {
  const port = createStellarMemoAnchor({ async sendMemoHash() { return { hash: "" }; } });
  const result = await port.anchor({ commitment: COMMITMENT });
  assert.equal(result.status, "degraded");
});

test("the network is part of the chain id, and defaults to testnet", () => {
  const stub = { async sendMemoHash() { return { hash: "T" }; } };
  assert.equal(createStellarMemoAnchor(stub).chain, "stellar:testnet");
  assert.equal(createStellarMemoAnchor(stub, { chain: "stellar:pubnet" }).chain, "stellar:pubnet");
});

test("the contract path refuses to anchor without a nullifier", async () => {
  // Its whole reason to exist is refusing replays; without a nullifier it
  // cannot, and pretending otherwise would be worse than declining.
  let invoked = false;
  const port = createStellarContractAnchor({
    async invokeAnchor() { invoked = true; return { hash: "T", accepted: true }; },
  });
  const result = await port.anchor({ commitment: COMMITMENT });
  assert.equal(result.status, "degraded");
  assert.equal(result.status === "degraded" && result.degraded.reason, "rejected_by_policy");
  assert.equal(invoked, false);
});

test("the contract path maps a spent nullifier onto the port's vocabulary", async () => {
  const port = createStellarContractAnchor({
    async invokeAnchor() {
      return { hash: "T", accepted: false, reason: "nullifier_already_spent" };
    },
  });
  const result = await port.anchor({ commitment: COMMITMENT, nullifier: NULLIFIER });
  assert.equal(result.status, "degraded");
  assert.equal(result.status === "degraded" && result.degraded.reason, "nullifier_already_spent");
});

test("an unrecognised contract error does not leak through as its own reason", async () => {
  const port = createStellarContractAnchor({
    async invokeAnchor() {
      return { hash: "T", accepted: false, reason: "HostError: Error(Contract, #7) at 0xdeadbeef" };
    },
  });
  const result = await port.anchor({ commitment: COMMITMENT, nullifier: NULLIFIER });
  assert.equal(result.status === "degraded" && result.degraded.reason, "rejected_by_policy");
  assert.equal(JSON.stringify(result).includes("HostError"), false);
});

test("an accepted contract invocation reports a replay-guarded receipt", async () => {
  const port = createStellarContractAnchor({
    async invokeAnchor() { return { hash: "SOROBAN_TX", accepted: true }; },
  });
  const result = await port.anchor({ commitment: COMMITMENT, nullifier: NULLIFIER });
  assert.equal(result.status, "anchored");
  assert.equal(result.status === "anchored" && result.receipt.replayGuarded, true);
  assert.equal(result.status === "anchored" && result.receipt.txRef, "SOROBAN_TX");
});
