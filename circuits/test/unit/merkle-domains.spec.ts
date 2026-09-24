// merkle-domains.spec.ts: the circuit's fold, reproduced outside the circuit.
// Both numbers below came from a witness of the real gadget — `MerkleLeaf` and
// `MerkleLevel` compiled with circom 2.2.3 — not from this file's own maths.
// They are what `core/` will have to reproduce when its hash changes, which is
// the whole point of putting the domain in.

import { test } from "node:test";
import assert from "node:assert/strict";
import { BN254_PRIME, circomlibSpec } from "../../tools/poseidon-params.ts";
import { poseidon } from "../../tools/poseidon.ts";
import { DOMAINS, domainElement } from "../../tools/domains.ts";

/// Named by how many inputs go in: the state is always one cell wider.
const TWO_INPUTS = circomlibSpec(BN254_PRIME, 254, 3);
const THREE_INPUTS = circomlibSpec(BN254_PRIME, 254, 4);
const LEAF = domainElement(DOMAINS.merkleLeaf, BN254_PRIME);
const NODE = domainElement(DOMAINS.merkleNode, BN254_PRIME);

// From the witness: MerkleLeaf(commitment = 7).
const CIRCUIT_LEAF_7 = 0x09403be3592e8428549b1fe9e7536926cd9f3800b57d9d8ba14e8d53d16a04b4n;
// From the witness: MerkleLevel(node = 7, sibling = 9, isRight = 0).
const CIRCUIT_NODE_7_9 = 0x03b5f4ce2b65a3b4cc959aa4e64c48db5606fc26ddf20aee0b96a8519a9672e7n;

test("a leaf is the commitment under the leaf domain, and the circuit agrees", () => {
  assert.equal(poseidon([LEAF, 7n], TWO_INPUTS), CIRCUIT_LEAF_7);
});

test("a node is the ordered pair under the node domain, and the circuit agrees", () => {
  assert.equal(poseidon([NODE, 7n, 9n], THREE_INPUTS), CIRCUIT_NODE_7_9);
});

// The reason the domains exist. Without them both of these are the same
// Poseidon call on the same numbers, and a prover can show an interior node
// as if it were a leaf.
test("the same numbers hashed as a leaf and as a node give different values", () => {
  assert.notEqual(poseidon([LEAF, 7n], TWO_INPUTS), poseidon([NODE, 7n, 9n], THREE_INPUTS));
  assert.notEqual(LEAF, NODE);
});

test("a domain element is derived from the string core/ hashes, and stays in the field", () => {
  assert.equal(LEAF, domainElement("knowni:merkle:leaf:v1", BN254_PRIME));
  assert.equal(NODE, domainElement("knowni:merkle:node:v1", BN254_PRIME));
  for (const value of [LEAF, NODE]) assert.ok(value > 0n && value < BN254_PRIME);
});
