// poseidon-curve.spec.ts: the same hash over the curve Stellar verifies.
// circomlib's constants are derived for BN254 and compiling them against
// another field reinterprets them without complaint. This repository derives
// its own, and the check that the derivation is right is that on BN254 it
// reproduces circomlib's published gadget exactly.

import { test } from "node:test";
import assert from "node:assert/strict";
import { BLS12_381_PRIME, BN254_PRIME, circomlibSpec, poseidon } from "@knowni/core";

const BN254 = circomlibSpec(BN254_PRIME, 254, 3);
const BLS12_381 = circomlibSpec(BLS12_381_PRIME, 255, 3);

/// From a witness of circomlib's own `Poseidon(2)`, compiled with circom 2.2.3.
const CIRCOMLIB_BN254 = 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189an;
/// From a witness of `PoseidonKnowni2` in poseidon_knowni_bls12381.circom,
/// compiled with `circom -p bls12381`.
const CIRCUIT_BLS12_381 = 0x28ce19420fc246a05553ad1e8c98f5c9d67166be2c18e9e4cb4b4e317dd2a78an;

// The anchor for everything else: our constants and our permutation give what
// somebody else's gadget gives, on the field theirs was built for.
test("on BN254 this derivation reproduces circomlib's own gadget", () => {
  assert.equal(poseidon([1n, 2n], BN254), CIRCOMLIB_BN254);
});

// And the point of the exercise: the same construction, over the field the
// contract's pairing lives in, agreeing with the circuit compiled for it.
test("on BLS12-381 core and the circuit compute the same digest", () => {
  assert.equal(poseidon([1n, 2n], BLS12_381), CIRCUIT_BLS12_381);
});

// If these ever matched, the constants would not be field-specific and the
// whole exercise would have been pointless.
test("the two fields do not give the same digest for the same inputs", () => {
  assert.notEqual(poseidon([1n, 2n], BN254), poseidon([1n, 2n], BLS12_381));
});

test("every BLS12-381 digest is an element of that field", () => {
  for (let i = 0n; i < 20n; i += 1n) {
    const digest = poseidon([i, i + 1n], BLS12_381);
    assert.ok(digest >= 0n && digest < BLS12_381_PRIME);
  }
});
