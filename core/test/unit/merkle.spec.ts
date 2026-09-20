// merkle.spec.ts: The issuer's published set and the inclusion proof against it, including the
// two forgery surfaces this implementation is written to close: second-preimage via domain
// confusion, and root collision via last-leaf duplication.

import { test } from "node:test";
import assert from "node:assert/strict";

import { sha256Hash } from "../../src/node.ts";
import { buildMerkleTree, hashLeaf, verifyInclusion } from "../../src/merkle.ts";

const h = sha256Hash;
const leaves = (n: number) => Array.from({ length: n }, (_, i) => hashLeaf(h, pad(i)));
const pad = (i: number) => i.toString(16).padStart(64, "0");

for (const size of [1, 2, 3, 5, 8, 17]) {
  test(`every leaf of a ${size}-leaf tree proves inclusion`, () => {
    const set = leaves(size);
    const tree = buildMerkleTree(h, set);
    assert.equal(tree.size, size);
    for (const leaf of set) {
      const proof = tree.proveInclusion(leaf);
      assert.ok(proof, "expected a proof");
      assert.equal(verifyInclusion(h, proof), true);
      assert.equal(proof.root, tree.root);
    }
  });
}

test("a leaf outside the set has no proof", () => {
  const tree = buildMerkleTree(h, leaves(5));
  assert.equal(tree.proveInclusion(hashLeaf(h, pad(99))), undefined);
});

test("a tampered path does not fold into the root", () => {
  const set = leaves(4);
  const tree = buildMerkleTree(h, set);
  const proof = tree.proveInclusion(set[1]!)!;
  const tampered = {
    ...proof,
    path: proof.path.map((step, i) => (i === 0 ? { ...step, sibling: pad(0xdead) } : step)),
  };
  assert.equal(verifyInclusion(h, tampered), false);
});

test("flipping the side of a path step does not fold into the root", () => {
  // Order matters at every level; a verifier that hashed the pair unordered
  // would accept a sibling swapped for the node.
  const set = leaves(4);
  const tree = buildMerkleTree(h, set);
  const proof = tree.proveInclusion(set[0]!)!;
  const flipped = { ...proof, path: proof.path.map((s) => ({ ...s, right: !s.right })) };
  assert.equal(verifyInclusion(h, flipped), false);
});

test("an internal node cannot be passed off as a leaf", () => {
  const set = leaves(4);
  const tree = buildMerkleTree(h, set);
  const internal = h.hash("knowni:merkle:node:v1", [
    Buffer.from(set[0]!, "hex"),
    Buffer.from(set[1]!, "hex"),
  ]);
  assert.equal(tree.proveInclusion(internal), undefined);
});

test("a promoted odd leaf does not collide with a duplicated one", () => {
  // Duplicating the last leaf to balance a level is the classic way a
  // 3-leaf and a 4-leaf tree end up sharing a root. Promotion cannot.
  const three = leaves(3);
  const duplicated = [...three, three[2]!];
  assert.notEqual(buildMerkleTree(h, three).root, buildMerkleTree(h, duplicated).root);
});

test("the empty set still has a pinnable root, distinct from any leaf", () => {
  const empty = buildMerkleTree(h, []);
  assert.equal(empty.size, 0);
  assert.equal(empty.proveInclusion(hashLeaf(h, pad(0))), undefined);
  assert.notEqual(empty.root, buildMerkleTree(h, leaves(1)).root);
});
