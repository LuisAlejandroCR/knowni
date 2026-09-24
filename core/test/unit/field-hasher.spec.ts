// field-hasher.spec.ts: core hashing the way the circuit hashes.
// The two numbers below came from witnesses of the compiled gadget —
// `MerkleLeaf` and `MerkleLevel` in circuits/merkle.circom. If this port
// reproduces them, a root computed here is a root the circuit can prove.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { BN254_PRIME } from "../../src/poseidon-params.ts";
import { createPoseidonHasher } from "../../src/field-hasher.ts";

const digest = (bytes: Uint8Array) => Uint8Array.from(createHash("sha256").update(bytes).digest());
const hasher = createPoseidonHasher(digest, BN254_PRIME, 254);

const CIRCUIT_LEAF_7 = 0x09403be3592e8428549b1fe9e7536926cd9f3800b57d9d8ba14e8d53d16a04b4n;
const CIRCUIT_NODE_7_9 = 0x03b5f4ce2b65a3b4cc959aa4e64c48db5606fc26ddf20aee0b96a8519a9672e7n;

test("a leaf hashed here is the leaf the circuit computes", () => {
  assert.equal(hasher.hashFields("merkleLeaf", [7n]), CIRCUIT_LEAF_7);
});

test("a node hashed here is the node the circuit computes", () => {
  assert.equal(hasher.hashFields("merkleNode", [7n, 9n]), CIRCUIT_NODE_7_9);
});

// The point of the domain being an element and not a prefix on some bytes.
test("the same elements under two domains give two different digests", () => {
  assert.notEqual(hasher.hashFields("merkleNode", [1n, 2n]), hasher.hashFields("claim", [1n, 2n]));
  assert.notEqual(hasher.hashFields("session", [1n, 2n]), hasher.hashFields("nullifier", [1n, 2n]));
});

test("an input outside the field is refused, not reduced", () => {
  assert.throws(() => hasher.hashFields("claim", [BN254_PRIME]), RangeError);
  assert.throws(() => hasher.hashFields("claim", [-1n]), RangeError);
});

test("every digest is itself an element, so it can be hashed again", () => {
  let value = 0n;
  for (let i = 0; i < 40; i += 1) {
    value = hasher.hashFields("merkleNode", [value, BigInt(i)]);
    assert.ok(value >= 0n && value < BN254_PRIME);
  }
});

test("width follows the input count, so two arities do not collide", () => {
  assert.notEqual(hasher.hashFields("claim", [1n]), hasher.hashFields("claim", [1n, 0n]));
});
