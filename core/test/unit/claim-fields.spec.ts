// claim-fields.spec.ts: the encoding a commitment will be built on.
// What is checked is not that it produces particular numbers — it is that two
// different claims can never produce the same list, which is the only property
// a commitment rests on.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Claim } from "../../src/claims.ts";
import { CLAIM_WIDTH, encodeClaimFields } from "../../src/claim-fields.ts";
import { NotInFieldError } from "../../src/field.ts";

const PRIME = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
const digest = (bytes: Uint8Array) => Uint8Array.from(createHash("sha256").update(bytes).digest());
const encode = (claim: Claim) => encodeClaimFields(digest, claim, PRIME);

const subjectRef = { hex: "0a".repeat(32) };
const NOW = 1_760_000_000;

const identity: Claim = {
  kind: "identity",
  jurisdiction: "CO",
  documentKind: "CC",
  subjectRef,
  documentValid: true,
  subjectAlive: true,
  ofAge: true,
  attestedAt: NOW,
};

const income: Claim = {
  kind: "income",
  jurisdiction: "CO",
  subjectRef,
  monthlyMinor: 2_500_000,
  currency: "COP",
  basis: "contribution_base",
  periodsObserved: 11,
  periodsWindow: 12,
  attestedAt: NOW,
};

const standing: Claim = {
  kind: "standing",
  jurisdiction: "CO",
  subjectRef,
  listed: false,
  listSetRoot: "0b".repeat(32),
  attestedAt: NOW,
};

test("every element lands inside the field", () => {
  for (const claim of [identity, income, standing]) {
    for (const value of encode(claim)) {
      assert.ok(value >= 0n && value < PRIME, `${claim.kind}: ${value}`);
    }
  }
});

test("each kind encodes to the width its table declares", () => {
  for (const claim of [identity, income, standing]) {
    assert.equal(encode(claim).length, CLAIM_WIDTH[claim.kind]);
  }
});

test("two kinds never encode to the same list, whatever they share", () => {
  const encoded = [identity, income, standing].map((claim) => encode(claim).join(","));
  assert.equal(new Set(encoded).size, encoded.length);
  // The tag is what does it, and it is the first element for exactly that.
  assert.notEqual(encode(identity)[0], encode(income)[0]);
});

test("changing any one field changes the encoding", () => {
  const base = encode(identity).join(",");
  const variants: Claim[] = [
    { ...identity, documentValid: false },
    { ...identity, subjectAlive: false },
    { ...identity, ofAge: false },
    { ...identity, attestedAt: NOW + 1 },
    { ...identity, documentKind: "CE" },
    { ...identity, jurisdiction: "MX" },
    { ...identity, subjectRef: { hex: "0c".repeat(32) } },
  ];
  for (const variant of variants) {
    assert.notEqual(encode(variant).join(","), base, JSON.stringify(variant));
  }
});

// The trap this encoding exists to avoid: a 256-bit value reduced into a
// 254-bit field is not injective, and a commitment built on it merges two
// subjects that were never the same.
test("a reference that is not an element is refused, never reduced", () => {
  const tooBig = { ...identity, subjectRef: { hex: "ff".repeat(32) } };
  assert.throws(() => encode(tooBig), NotInFieldError);

  const rootTooBig: Claim = { ...standing, listSetRoot: "ff".repeat(32) };
  assert.throws(() => encode(rootTooBig), NotInFieldError);
});

test("a negative or fractional count is refused before it reaches the field", () => {
  assert.throws(() => encode({ ...identity, attestedAt: -1 }), RangeError);
  assert.throws(() => encode({ ...identity, attestedAt: 1.5 }), RangeError);
  assert.throws(() => encode({ ...income, monthlyMinor: Number.MAX_SAFE_INTEGER + 2 }), RangeError);
});

test("hex is read the same with or without its prefix, and rejected when it is not hex", () => {
  const prefixed: Claim = { ...identity, subjectRef: { hex: `0x${"0a".repeat(32)}` } };
  assert.deepEqual(encode(prefixed), encode(identity));
  assert.throws(() => encode({ ...identity, subjectRef: { hex: "zz" } }), RangeError);
});
