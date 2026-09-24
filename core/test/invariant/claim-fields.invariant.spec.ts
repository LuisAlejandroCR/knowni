// claim-fields.invariant.spec.ts: two claims that differ encode differently.
// A commitment is only worth the injectivity of what goes into it. If two
// distinct claims can produce one list of elements, an issuer can be held to a
// claim it never made, and no amount of hashing afterwards repairs that.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Claim, DocumentKind, IncomeBasis } from "../../src/claims.ts";
import { encodeClaimFields } from "../../src/claim-fields.ts";

const PRIME = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
/// The same derivation the hasher uses, written out here so the test does not
/// depend on the hasher to check the encoder.
const text = (value: string) =>
  BigInt(`0x${createHash("sha256").update(value, "utf8").digest("hex")}`) % PRIME;
const encode = (claim: Claim) => encodeClaimFields(text, claim, PRIME).join(",");

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const JURISDICTIONS = ["CO", "MX", "CL", "", "co"];
const DOCUMENT_KINDS: DocumentKind[] = ["CC", "CE", "PA", "NIT", "PEP", "OTHER"];
const BASES: IncomeBasis[] = ["contribution_base", "verified_income", "cashflow"];
const REFS = ["0a".repeat(32), "0b".repeat(32), "01", "0"];

function anyClaim(next: () => number): Claim {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!;
  const uint = (bound: number) => Math.floor(next() * bound);
  const subjectRef = { hex: pick(REFS) };
  const jurisdiction = pick(JURISDICTIONS);
  const attestedAt = uint(2_000_000_000);

  switch (Math.floor(next() * 6)) {
    case 0:
      return {
        kind: "identity",
        jurisdiction,
        documentKind: pick(DOCUMENT_KINDS),
        subjectRef,
        documentValid: next() < 0.5,
        subjectAlive: next() < 0.5,
        ofAge: next() < 0.5,
        attestedAt,
      };
    case 1:
      return {
        kind: "income",
        jurisdiction,
        subjectRef,
        monthlyMinor: uint(1e9),
        currency: pick(["COP", "USD", "MXN"]),
        basis: pick(BASES),
        periodsObserved: uint(13),
        periodsWindow: 12,
        attestedAt,
      };
    case 2:
      return {
        kind: "formality",
        jurisdiction,
        subjectRef,
        lastContributionMonth: 202_000 + uint(100),
        monthsContributedLast12: uint(13),
        attestedAt,
      };
    case 3:
      return {
        kind: "standing",
        jurisdiction,
        subjectRef,
        listed: next() < 0.5,
        listSetRoot: pick(REFS),
        attestedAt,
      };
    case 4:
      return {
        kind: "capacity",
        jurisdiction,
        subjectRef,
        restricted: next() < 0.5,
        basis: "insolvency_proceeding",
        attestedAt,
      };
    default:
      return {
        kind: "assetStanding",
        jurisdiction,
        subjectRef,
        registered: next() < 0.5,
        encumbered: next() < 0.5,
        finesOutstanding: next() < 0.5,
        attestedAt,
      };
  }
}

test("no two distinct claims encode to the same list of elements", () => {
  const seen = new Map<string, string>();
  for (let seed = 1; seed <= 4000; seed += 1) {
    const claim = anyClaim(rng(seed));
    const encoded = encode(claim);
    const shape = JSON.stringify(claim, Object.keys(claim).sort());

    const previous = seen.get(encoded);
    if (previous !== undefined) {
      assert.equal(previous, shape, `two different claims share an encoding:\n${previous}\n${shape}`);
    }
    seen.set(encoded, shape);
  }
  // A run that produced one claim over and over would satisfy the above and
  // prove nothing.
  assert.ok(seen.size > 100, `only ${seen.size} distinct encodings were generated`);
});

test("the same claim always encodes to the same list", () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const claim = anyClaim(rng(seed));
    assert.equal(encode(claim), encode(structuredClone(claim)));
  }
});
