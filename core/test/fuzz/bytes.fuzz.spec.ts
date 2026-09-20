// bytes.fuzz.spec.ts: arbitrary input into the encoders every signature depends on.
// A hex parser that accepts something it should not, or a length prefix that can
// be re-split, breaks every signed structure above it at once.

import { test } from "node:test";
import assert from "node:assert/strict";

import { fromHex, lengthPrefixed, toHex, u32be, u64be, utf8 } from "../../src/bytes.ts";

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

test("hex round-trips for arbitrary bytes, and nothing else parses", () => {
  const random = lcg(7);
  for (let i = 0; i < 500; i += 1) {
    const length = Math.floor(random() * 64);
    const bytes = Uint8Array.from({ length }, () => Math.floor(random() * 256));
    assert.deepEqual(Array.from(fromHex(toHex(bytes))), Array.from(bytes));
  }
  for (const bad of ["0", "xyz", "FF", "0x00", " 00", "00 ", "😀", "0.0"]) {
    assert.throws(() => fromHex(bad), TypeError, `accepted ${JSON.stringify(bad)}`);
  }
});

test("integers refuse what they cannot represent instead of wrapping", () => {
  assert.throws(() => u64be(-1), RangeError);
  assert.throws(() => u64be(1.5), RangeError);
  assert.throws(() => u64be(2n ** 64n), RangeError);
  assert.equal(toHex(u64be(2n ** 64n - 1n)), "ffffffffffffffff");
  assert.equal(toHex(u32be(0)), "00000000");
});

test("length prefixing cannot be re-split into a different pair", () => {
  const random = lcg(99);
  const seen = new Map<string, string>();
  for (let i = 0; i < 400; i += 1) {
    const left = "x".repeat(Math.floor(random() * 6));
    const right = "y".repeat(Math.floor(random() * 6));
    const encoded = toHex(lengthPrefixed([utf8(left), utf8(right)]));
    const key = `${left}|${right}`;
    const clash = seen.get(encoded);
    assert.ok(clash === undefined || clash === key, `collision: ${clash} vs ${key}`);
    seen.set(encoded, key);
  }
});

test("utf8 survives the characters Colombian names actually contain", () => {
  for (const text of ["ñ", "ANA MARÍA", "PEÑA", "José Ángel", "ü", "🙂", ""]) {
    assert.equal(new TextDecoder().decode(utf8(text)), text);
  }
});
