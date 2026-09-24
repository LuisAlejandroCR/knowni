// commitment.spec.ts: The two commitments, and the rule that separates them: a claim can
// become a leaf, an outcome can become an anchor, and neither crosses over.

import { test } from "node:test";
import assert from "node:assert/strict";

import { poseidonHash, sha256Hash } from "../../src/node.ts";
import {
  commitClaim,
  commitOutcome,
  randomSalt,
  verifyOutcomeCommitment,
  type Outcome,
} from "../../src/commitment.ts";
import { formality, identity, income, standing } from "../support/fixtures.ts";
import type { IncomeBasis } from "../../src/claims.ts";

const h = sha256Hash;
/// El camino reclamo/Merkle hashea en elementos; el resto sigue en bytes.
const fh = poseidonHash;

test("a claim commitment is stable across calls with the same salt", () => {
  const salt = randomSalt(poseidonHash.prime);
  assert.equal(commitClaim(fh, identity, salt), commitClaim(fh, identity, salt));
});

test("a different salt hides the same claim differently", () => {
  assert.notEqual(commitClaim(fh, identity, randomSalt(poseidonHash.prime)), commitClaim(fh, identity, randomSalt(poseidonHash.prime)));
});

test("every field of a claim is bound into its commitment", () => {
  const salt = randomSalt(poseidonHash.prime);
  const base = commitClaim(fh, identity, salt);
  const variants = [
    { ...identity, documentValid: false },
    { ...identity, subjectAlive: false },
    { ...identity, ofAge: false },
    { ...identity, attestedAt: identity.attestedAt + 1 },
    { ...identity, documentKind: "CE" as const },
    { ...identity, jurisdiction: "PE" },
    { ...identity, subjectRef: { hex: "0b".repeat(32) } },
  ];
  for (const variant of variants) {
    assert.notEqual(commitClaim(fh, variant, salt), base);
  }
});

test("claims of different kinds never share a commitment", () => {
  const salt = randomSalt(poseidonHash.prime);
  const all = [identity, income, formality, standing].map((c) => commitClaim(fh, c, salt));
  assert.equal(new Set(all).size, all.length);
});

test("field encoding is unambiguous across boundaries", () => {
  // Length-prefixed parts: a currency of "CO" with basis "Pdeclared" must not
  // hash the same bytes as "COP" with "declared".
  const salt = randomSalt(poseidonHash.prime);
  // The basis is deliberately outside its domain: what is under test is the
  // encoding of the boundary between two fields, not which bases exist.
  const a = commitClaim(fh, { ...income, currency: "CO", basis: "declared" as IncomeBasis }, salt);
  const b = commitClaim(fh, { ...income, currency: "COP", basis: "declared" as IncomeBasis }, salt);
  assert.notEqual(a, b);
});

const outcome: Outcome = {
  personhood: true,
  solvencyTier: 3,
  formality: true,
  standing: true,
  capacity: false,
  assetStanding: false,
  decidedAt: 1_760_000_000,
};

test("an anchored outcome opens only with the blinding factor that made it", () => {
  const { commitment, blinding } = commitOutcome(h, outcome);
  assert.equal(verifyOutcomeCommitment(h, outcome, blinding, commitment), true);
  const other = commitOutcome(h, outcome);
  assert.equal(verifyOutcomeCommitment(h, outcome, other.blinding, commitment), false);
});

test("an outcome commitment does not open to a different outcome", () => {
  const { commitment, blinding } = commitOutcome(h, outcome);
  assert.equal(
    verifyOutcomeCommitment(h, { ...outcome, solvencyTier: 1 }, blinding, commitment),
    false,
  );
});

test("the same outcome anchored twice is not recognisably the same", () => {
  assert.notEqual(commitOutcome(h, outcome).commitment, commitOutcome(h, outcome).commitment);
});
