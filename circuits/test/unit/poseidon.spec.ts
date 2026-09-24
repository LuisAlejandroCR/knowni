// poseidon.spec.ts: this implementation against the gadget that will verify
// the proofs. The number below was not taken from a table — it came out of
// circomlib's own `Poseidon(2)`, compiled with circom 2.2.3 and evaluated on a
// witness for inputs 1 and 2. Anything that does not reproduce it is wrong.

import { test } from "node:test";
import assert from "node:assert/strict";
import { BLS12_381_PRIME, BN254_PRIME, circomlibSpec, parameters } from "../../tools/poseidon-params.ts";
import { poseidon } from "../../tools/poseidon.ts";

const CIRCOM_POSEIDON_1_2 = 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189an;

// circomlib's POSEIDON_M(3), which is the transpose of the reference script's
// matrix: its `Mix` template indexes `M[j][i]`, so it stores it turned around.
const CIRCOMLIB_M3_TRANSPOSED = [
  [
    0x109b7f411ba0e4c9b2b70caf5c36a7b194be7c11ad24378bfedb68592ba8118bn,
    0x2969f27eed31a480b9c36c764379dbca2cc8fdd1415c3dded62940bcde0bd771n,
    0x143021ec686a3f330d5f9e654638065ce6cd79e28c5b3753326244ee65a1b1a7n,
  ],
  [
    0x16ed41e13bb9c0c66ae119424fddbcbc9314dc9fdbdeea55d6c64543dc4903e0n,
    0x2e2419f9ec02ec394c9871c832963dc1b89d743c8c7b964029b2311687b1fe23n,
    0x176cc029695ad02582a70eff08a6fd99d057e12e58e7d7b6b16cdfabc8ee2911n,
  ],
  [
    0x2b90bba00fca0589f617e7dcbfe82e0df706ab640ceb247b791a93b74e36736dn,
    0x101071f0032379b697315876690f053d148d4e109f5fb065c8aacc55a0f89bfan,
    0x19a3fc0a56702bf417ba7fee3802593fa644470307043f7773279cd71d25d5e0n,
  ],
];

test("the generated matrix is circomlib's, turned the way circomlib stores it", () => {
  const { mds } = parameters(circomlibSpec(BN254_PRIME, 254, 3));
  const transposed = mds.map((_, i) => mds.map((row) => row[i]!));
  assert.deepEqual(transposed, CIRCOMLIB_M3_TRANSPOSED);
});

test("this implementation computes what circomlib's own gadget computes", () => {
  assert.equal(poseidon([1n, 2n], circomlibSpec(BN254_PRIME, 254, 3)), CIRCOM_POSEIDON_1_2);
});

test("a state one cell too wide or too narrow is refused, not padded", () => {
  const spec = circomlibSpec(BN254_PRIME, 254, 3);
  assert.throws(() => poseidon([1n], spec), RangeError);
  assert.throws(() => poseidon([1n, 2n, 3n], spec), RangeError);
});

test("changing one input changes the digest", () => {
  const spec = circomlibSpec(BN254_PRIME, 254, 3);
  assert.notEqual(poseidon([1n, 2n], spec), poseidon([1n, 3n], spec));
  assert.notEqual(poseidon([1n, 2n], spec), poseidon([2n, 1n], spec));
});

// The point of the whole exercise: the same construction, over the field
// Stellar actually verifies in. No published vector exists to check this
// against — what is checked is that it is a different hash, in that field.
test("the same construction answers over BLS12-381, in its field", () => {
  const spec = circomlibSpec(BLS12_381_PRIME, 255, 3);
  const digest = poseidon([1n, 2n], spec);

  assert.ok(digest > 0n && digest < BLS12_381_PRIME);
  assert.equal(digest, poseidon([1n, 2n], spec));
  assert.notEqual(digest, CIRCOM_POSEIDON_1_2);
});
