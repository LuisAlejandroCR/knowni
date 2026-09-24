// verify-vehicle.spec.ts: the envelope answering the vehicle-sale profile, which asks two
// predicates the lease profile never asks: the seller's capacity and the car's standing.
// The asset's reference is the relying party's, not the subject's, and this is where that shows.

import { test } from "node:test";
import assert from "node:assert/strict";

import { sha256Hash } from "../../src/node.ts";
import { outcomeOf } from "../../src/disclosure.ts";
import { commitOutcome, verifyOutcomeCommitment } from "../../src/commitment.ts";
import { verify, type HeldClaims, type VerificationRequest } from "../../src/verify.ts";
import {
  ASSET_REF,
  DAY,
  NOW,
  OTHER_REF,
  SUBJECT_REF,
  assetStanding,
  capacity,
  identity,
} from "../support/fixtures.ts";

const h = sha256Hash;
const IDENTITY_ROOT = "1".repeat(64);
const CAPACITY_ROOT = "3".repeat(64);
const ASSET_ROOT = "4".repeat(64);

const request: VerificationRequest = {
  session: {
    relyingPartyId: "notaria-42-bogota",
    purpose: "vehicle-sale",
    nonce: "ef".repeat(16),
    expiresAt: NOW + 600,
    paramsHash: "ab".repeat(32),
  },
  personhood: { jurisdiction: "CO", nowUnix: NOW, maxAgeSeconds: 30 * DAY },
  capacity: {
    jurisdiction: "CO",
    acceptedBases: ["insolvency_proceeding"],
    nowUnix: NOW,
    maxAgeSeconds: 30 * DAY,
  },
  assetStanding: {
    expectedAssetRef: ASSET_REF,
    jurisdiction: "CO",
    nowUnix: NOW,
    maxAgeSeconds: 7 * DAY,
    requireNoFines: true,
  },
};

const held: HeldClaims = {
  subjectRef: SUBJECT_REF,
  secret: { hex: "9".repeat(64) },
  identity: { claim: identity, issuerRoot: IDENTITY_ROOT },
  capacity: { claim: capacity, issuerRoot: CAPACITY_ROOT },
  asset: { claim: assetStanding, issuerRoot: ASSET_ROOT },
};

function disclose(r = request, hc = held) {
  const result = verify(h, r, hc, NOW);
  assert.equal(result.status, "disclosed");
  return result.status === "disclosed" ? result.disclosure : undefined!;
}

test("the vehicle profile gets its two answers, and the lease ones stay unanswered", () => {
  const d = disclose();
  assert.equal(d.personhood, true);
  assert.equal(d.capacity, true);
  assert.equal(d.assetStanding, true);
  assert.equal(d.solvency, "unavailable");
  assert.equal(d.formality, "unavailable");
  assert.equal(d.standing, "unavailable");
});

// The asset is held by the subject but is not the subject. Matching it against
// `subjectRef` would refuse every honest sale.
test("the asset claim carries its own reference and is not refused for it", () => {
  assert.notEqual(assetStanding.subjectRef.hex, SUBJECT_REF);
  assert.equal(disclose().assetStanding, true);
});

test("a car the relying party did not ask about answers nothing", () => {
  const other = {
    ...request,
    assetStanding: { ...request.assetStanding!, expectedAssetRef: OTHER_REF },
  };
  assert.equal(disclose(other).assetStanding, false);
});

test("an unasked predicate is unavailable, not false", () => {
  const { assetStanding: _asked, ...rest } = request;
  assert.equal(disclose(rest as VerificationRequest).assetStanding, "unavailable");
});

test("a predicate asked without the claim to answer it is unavailable too", () => {
  const { asset: _held, ...rest } = held;
  assert.equal(disclose(request, rest as HeldClaims).assetStanding, "unavailable");
});

// An issuer only appears when it actually answered something.
test("the roots named are the ones that answered", () => {
  const roots = disclose().issuerRoots;
  assert.deepEqual([...roots].sort(), [IDENTITY_ROOT, CAPACITY_ROOT, ASSET_ROOT].sort());
});

// The asset's reference is a fact about the subject's car; the envelope answers
// about it without carrying it.
test("the envelope answers about the car without naming it", () => {
  const d = disclose();
  const { sessionId: _s, nullifier: _n, issuerRoots: _r, ...rest } = d;
  assert.equal(JSON.stringify(rest).includes(ASSET_REF), false);
});

test("the two new answers reach the committed outcome", () => {
  const d = disclose();
  const outcome = outcomeOf(d);
  assert.equal(outcome.capacity, true);
  assert.equal(outcome.assetStanding, true);

  const { commitment, blinding } = commitOutcome(h, outcome);
  assert.equal(verifyOutcomeCommitment(h, outcome, blinding, commitment), true);
  // Flipping one of them has to change the commitment, or the envelope would
  // be committing to less than it says.
  assert.equal(
    verifyOutcomeCommitment(h, { ...outcome, assetStanding: false }, blinding, commitment),
    false,
  );
  assert.equal(
    verifyOutcomeCommitment(h, { ...outcome, capacity: false }, blinding, commitment),
    false,
  );
});
