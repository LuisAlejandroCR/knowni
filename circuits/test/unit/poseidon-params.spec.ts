// poseidon-params.spec.ts: the generator is only worth anything if it
// reproduces constants somebody else already published. These are circomlib's,
// read from `circomlib/circuits/poseidon_constants.circom`, which its own
// header says came from the reference `generate_parameters_grain.sage` — so
// matching them is matching the reference, not matching circomlib's opinion.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BLS12_381_PRIME,
  BN254_PRIME,
  circomlibSpec,
  roundConstants,
} from "../../tools/poseidon-params.ts";

// sage generate_parameters_grain.sage 1 0 254 2 8 56 <bn254>
const CIRCOMLIB_WIDTH_2 = [
  0x09c46e9ec68e9bd4fe1faaba294cba38a71aa177534cdd1b6c7dc0dbd0abd7a7n,
  0x0c0356530896eec42a97ed937f3135cfc5142b3ae405b8343c1d83ffa604cb81n,
];

// sage generate_parameters_grain.sage 1 0 254 3 8 57 <bn254>
const CIRCOMLIB_WIDTH_3 = [
  0x0ee9a592ba9a9518d05986d656f40c2114c4993c11bb29938d21d47304cd8e6en,
  0x00f1445235f2148c5986587169fc1bcd887b08d4d00868df5696fff40956e864n,
  0x08dff3487e8ac99e1f29a058d0fa80b930c728730b7ab36ce879f3890ecf73f5n,
];

test("the generator reproduces circomlib's BN254 constants for a two-wide state", () => {
  const constants = roundConstants(circomlibSpec(BN254_PRIME, 254, 2));
  assert.equal(constants.length, 2 * (8 + 56));
  assert.deepEqual(constants.slice(0, CIRCOMLIB_WIDTH_2.length), CIRCOMLIB_WIDTH_2);
});

test("and for a three-wide state, which is the one the circuit's Merkle path uses", () => {
  const constants = roundConstants(circomlibSpec(BN254_PRIME, 254, 3));
  assert.equal(constants.length, 3 * (8 + 57));
  assert.deepEqual(constants.slice(0, CIRCOMLIB_WIDTH_3.length), CIRCOMLIB_WIDTH_3);
});

// Not a correctness claim about the constants — nobody has checked these
// against a second implementation. It is a claim that the generator is
// deterministic, lands inside the field, and answers for this prime at all.
test("the same generator answers for BLS12-381, deterministically and in the field", () => {
  const spec = circomlibSpec(BLS12_381_PRIME, 255, 3);
  const first = roundConstants(spec);
  const second = roundConstants(spec);

  assert.deepEqual(first, second);
  assert.equal(first.length, 3 * (8 + 57));
  for (const value of first) {
    assert.ok(value >= 0n && value < BLS12_381_PRIME);
  }
  // A different field must not give the same constants, or the prime is not
  // reaching the LFSR's seed and every curve would share a parameter set.
  assert.notDeepEqual(first, roundConstants(circomlibSpec(BN254_PRIME, 254, 3)));
});
