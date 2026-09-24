// field.spec.ts: drawing an element, and why it is not 32 random bytes.
// A salt that does not fit the field cannot be committed by a circuit, and a
// salt drawn with bias is a salt with fewer possibilities than it looks.

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes as nodeRandomBytes } from "node:crypto";
import "../../src/node.ts";
import { randomFieldElement } from "../../src/field.ts";
import { randomFieldSalt } from "../../src/commitment.ts";
import { setRandomSource } from "../../src/random.ts";

const BN254 = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
const BLS12_381 = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n;

test("every element drawn is in the field, for either field", () => {
  for (const prime of [BN254, BLS12_381]) {
    for (let i = 0; i < 500; i += 1) {
      const value = randomFieldElement(prime);
      assert.ok(value >= 0n && value < prime, `${value} is not in ${prime}`);
    }
  }
});

test("a salt is an element, written as 32 bytes of hex", () => {
  for (let i = 0; i < 100; i += 1) {
    const salt = randomFieldSalt(BN254);
    assert.equal(salt.hex.length, 64);
    assert.ok(BigInt(`0x${salt.hex}`) < BN254);
  }
});

// What the mask actually buys, which is not what it looks like it buys: for
// BN254 the prime sits at about three quarters of 2^254, so a masked draw is
// still rejected about one time in four. Unmasked it would be four in five.
// The loop therefore has to retry, and this pins that it does — with a source
// that hands back the largest maskable value first, which is ABOVE the prime.
test("a draw above the prime is rejected and the next one is taken", () => {
  const scripted = [0xff, 0x00];
  let draws = 0;
  setRandomSource((byteLength) => {
    const fill = scripted[draws] ?? 0x00;
    draws += 1;
    const bytes = new Uint8Array(byteLength).fill(fill);
    // The mask is a right shift, so the low bits are the ones discarded:
    // 0x04 in the last byte survives it as a 1.
    if (fill === 0x00) bytes[byteLength - 1] = 0x04;
    return bytes;
  });
  try {
    assert.equal(randomFieldElement(BN254), 1n);
    assert.equal(draws, 2, "the first draw should have been rejected");
  } finally {
    setRandomSource((byteLength) => Uint8Array.from(nodeRandomBytes(byteLength)));
  }
});

test("two draws differ, so the source is actually being read", () => {
  assert.notEqual(randomFieldElement(BN254), randomFieldElement(BN254));
});
