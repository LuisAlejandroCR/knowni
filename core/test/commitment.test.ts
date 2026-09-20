// commitment.test.ts: The two commitments, and the rule that separates them: a claim can
// become a leaf, an outcome can become an anchor, and neither crosses over.

import { test } from "node:test";
import assert from "node:assert/strict";

import { sha256Hash } from "../src/node.ts";
import {
  commitClaim,
  commitOutcome,
  randomSalt,
  verifyOutcomeCommitment,
  type Outcome,
} from "../src/commitment.ts";
import { formality, identity, income, standing } from "./support/fixtures.ts";

const h = sha256Hash;

test("a claim commitment is stable across calls with the same salt", () => {
  const salt = randomSalt();
  assert.equal(commitClaim(h, identity, salt), commitClaim(h, identity, salt));
});

test("a different salt hides the same claim differently", () => {
  assert.notEqual(commitClaim(h, identity, randomSalt()), commitClaim(h, identity, randomSalt()));
});

test("every field of a claim is bound into its commitment", () => {
  const salt = randomSalt();
  const base = commitClaim(h, identity, salt);
  const variants = [
    { ...identity, documentValid: false },
    { ...identity, subjectAlive: false },
    { ...identity, ofAge: false },
    { ...identity, attestedAt: identity.attestedAt + 1 },
    { ...identity, documentKind: "CE" as const },
    { ...identity, jurisdiction: "PE" },
    { ...identity, subjectRef: { hex: "b".repeat(64) } },
  ];
  for (const variant of variants) {
    assert.notEqual(commitClaim(h, variant, salt), base);
  }
});

test("claims of different kinds never share a commitment", () => {
  const salt = randomSalt();
  const all = [identity, income, formality, standing].map((c) => commitClaim(h, c, salt));
  assert.equal(new Set(all).size, all.length);
});

test("field encoding is unambiguous across boundaries", () => {
  // Length-prefixed parts: a currency of "CO" with basis "Pdeclared" must not
  // hash the same bytes as "COP" with "declared".
  const salt = randomSalt();
  const a = commitClaim(h, { ...income, currency: "CO", basis: "declared" }, salt);
  const b = commitClaim(h, { ...income, currency: "COP", basis: "declared" }, salt);
  assert.notEqual(a, b);
});

const outcome: Outcome = {
  personhood: true,
  solvencyTier: 3,
  formality: true,
  standing: true,
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
