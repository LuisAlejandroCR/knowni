// predicates-vehicle.spec.ts: The two predicates the vehicle-sale profile added: capacity,
// about the person, and assetStanding, about the car.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { AssetStandingClaim, CapacityClaim } from "../../src/claims.ts";
import { proveAssetStanding, proveCapacity } from "../../src/predicates.ts";
import { commitClaim, randomSalt } from "../../src/commitment.ts";
import { poseidonHash } from "../../src/node.ts";

const NOW = 1_760_000_000;
const REF = "0a".repeat(32);
const ASSET = "0b".repeat(32);

const capacity = (over: Partial<CapacityClaim> = {}): CapacityClaim => ({
  kind: "capacity",
  jurisdiction: "CO",
  subjectRef: { hex: REF },
  restricted: false,
  basis: "insolvency_proceeding",
  attestedAt: NOW - 60,
  ...over,
});

const params = {
  expectedSubjectRef: REF,
  jurisdiction: "CO",
  acceptedBases: ["insolvency_proceeding"] as const,
  minPeriodsObserved: 6,
  nowUnix: NOW,
  maxAgeSeconds: 86_400,
};

test("an unrestricted, fresh capacity claim proves capacity", () => {
  assert.equal(proveCapacity(capacity(), params), true);
});

test("a restriction on record fails, and so does a stale attestation", () => {
  assert.equal(proveCapacity(capacity({ restricted: true }), params), false);
  assert.equal(proveCapacity(capacity({ attestedAt: NOW - 200_000 }), params), false);
});

test("a claim attested in the future is a clock skew or a forgery, never fresh", () => {
  assert.equal(proveCapacity(capacity({ attestedAt: NOW + 60 }), params), false);
});

test("a register the relying party did not accept does not answer their question", () => {
  assert.equal(proveCapacity(capacity({ basis: "corporate_status" }), params), false);
});

test("capacity proven for one subject does not transfer to another", () => {
  assert.equal(proveCapacity(capacity({ subjectRef: { hex: "0c".repeat(32) } }), params), false);
});

const vehicle = (over: Partial<AssetStandingClaim> = {}): AssetStandingClaim => ({
  kind: "assetStanding",
  jurisdiction: "CO",
  subjectRef: { hex: ASSET },
  registered: true,
  encumbered: false,
  finesOutstanding: false,
  attestedAt: NOW - 60,
  ...over,
});

const assetParams = {
  expectedAssetRef: ASSET,
  jurisdiction: "CO",
  nowUnix: NOW,
  maxAgeSeconds: 86_400,
  requireNoFines: true,
};

test("a registered, unencumbered, fine-free asset proves standing", () => {
  assert.equal(proveAssetStanding(vehicle(), assetParams), true);
});

test("an encumbrance fails whatever the buyer thinks of fines", () => {
  assert.equal(proveAssetStanding(vehicle({ encumbered: true }), assetParams), false);
  assert.equal(
    proveAssetStanding(vehicle({ encumbered: true }), { ...assetParams, requireNoFines: false }),
    false,
  );
});

test("outstanding fines are the buyer's call, and the parameter is where they make it", () => {
  assert.equal(proveAssetStanding(vehicle({ finesOutstanding: true }), assetParams), false);
  assert.equal(
    proveAssetStanding(vehicle({ finesOutstanding: true }), { ...assetParams, requireNoFines: false }),
    true,
  );
});

test("an attestation about a different car does not prove this one", () => {
  assert.equal(
    proveAssetStanding(vehicle({ subjectRef: { hex: "0d".repeat(32) } }), assetParams),
    false,
  );
});

test("both new kinds commit distinctly, so one cannot be replayed as the other", () => {
  const salt = randomSalt(poseidonHash.prime);
  const a = commitClaim(poseidonHash, capacity(), salt);
  const b = commitClaim(poseidonHash, vehicle(), salt);
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
  // And a changed field changes the commitment, which is what makes the
  // commitment worth checking at all.
  assert.notEqual(a, commitClaim(poseidonHash, capacity({ restricted: true }), salt));
});
