// profile.spec.ts: criterio A16 — qué exige un contrato lo compone quien
// pregunta. Los dos perfiles de esta prueba viven aquí, no en `core/`: si
// alguno de los dos tuviera que existir dentro del dominio para que esto
// pasara, el criterio no estaría cumplido.

import { test } from "node:test";
import assert from "node:assert/strict";
import { SolvencyTier } from "../../src/predicates.ts";
import { meetsProfile, type Disclosure, type VerificationProfile } from "../../src/disclosure.ts";

const BASE: Disclosure = {
  sessionId: "ab".repeat(32),
  relyingPartyId: "notaria-17",
  purpose: "vehicle-sale",
  decidedAt: 1_760_000_000,
  personhood: true,
  solvency: SolvencyTier.STRONG,
  formality: true,
  standing: true,
  capacity: true,
  assetStanding: true,
  issuerRoots: ["0f".repeat(32)],
  nullifier: "cd".repeat(32),
};

// Two contracts, composed by their relying party. An agency renting a flat and
// a notary transferring a car do not need the same answers, and neither list
// is more canonical than the other.
const LEASE: VerificationProfile = [
  { answer: "personhood", mustBe: true },
  { answer: "formality", mustBe: true },
  { answer: "standing", mustBe: true },
  { answer: "solvency", atLeast: SolvencyTier.COMFORTABLE },
];

const VEHICLE_SALE: VerificationProfile = [
  { answer: "personhood", mustBe: true },
  { answer: "capacity", mustBe: true },
  { answer: "standing", mustBe: true },
  { answer: "assetStanding", mustBe: true },
];

test("a full envelope meets both profiles", () => {
  assert.deepEqual(meetsProfile(BASE, LEASE), { status: "meets" });
  assert.deepEqual(meetsProfile(BASE, VEHICLE_SALE), { status: "meets" });
});

test("each profile only looks at what it asked for", () => {
  // The vehicle answers are missing; the lease never asked for them.
  const rental: Disclosure = { ...BASE, capacity: "unavailable", assetStanding: "unavailable" };
  assert.deepEqual(meetsProfile(rental, LEASE), { status: "meets" });
  assert.deepEqual(meetsProfile(rental, VEHICLE_SALE), {
    status: "short",
    missing: [
      { answer: "capacity", reason: "unavailable" },
      { answer: "assetStanding", reason: "unavailable" },
    ],
  });

  // And the other way round, which is what the old lease-shaped check could
  // not express at all: solvency and formality are nobody's business here.
  const sale: Disclosure = { ...BASE, solvency: "unavailable", formality: "unavailable" };
  assert.deepEqual(meetsProfile(sale, VEHICLE_SALE), { status: "meets" });
  assert.deepEqual(meetsProfile(sale, LEASE), {
    status: "short",
    missing: [
      { answer: "formality", reason: "unavailable" },
      { answer: "solvency", reason: "unavailable" },
    ],
  });
});

test("unanswered and disproven are different shortfalls", () => {
  const unasked = meetsProfile({ ...BASE, capacity: "unavailable" }, VEHICLE_SALE);
  const refused = meetsProfile({ ...BASE, capacity: false }, VEHICLE_SALE);
  assert.deepEqual(unasked, { status: "short", missing: [{ answer: "capacity", reason: "unavailable" }] });
  assert.deepEqual(refused, { status: "short", missing: [{ answer: "capacity", reason: "not_proven" }] });
  assert.notDeepEqual(unasked, refused);
});

test("a band below the threshold is short of the tier, not unanswered", () => {
  assert.deepEqual(meetsProfile({ ...BASE, solvency: SolvencyTier.BASIC }, LEASE), {
    status: "short",
    missing: [{ answer: "solvency", reason: "below_tier" }],
  });
  // The same envelope meets a profile that asks for less.
  assert.deepEqual(
    meetsProfile({ ...BASE, solvency: SolvencyTier.BASIC }, [
      { answer: "solvency", atLeast: SolvencyTier.BASIC },
    ]),
    { status: "meets" },
  );
});

test("every shortfall is reported, not just the first", () => {
  const empty: Disclosure = {
    ...BASE,
    personhood: "unavailable",
    formality: false,
    standing: "unavailable",
    solvency: SolvencyTier.NONE,
  };
  assert.deepEqual(meetsProfile(empty, LEASE), {
    status: "short",
    missing: [
      { answer: "personhood", reason: "unavailable" },
      { answer: "formality", reason: "not_proven" },
      { answer: "standing", reason: "unavailable" },
      { answer: "solvency", reason: "below_tier" },
    ],
  });
});

test("a profile that requires nothing is never met", () => {
  assert.deepEqual(meetsProfile(BASE, []), { status: "unspecified" });
});

test("core names no profile of its own", async () => {
  const core = await import("../../src/index.ts");
  const exported = Object.keys(core).join(" ").toLowerCase();
  for (const contract of ["lease", "vehiclesale", "rental", "guarantee", "tier1", "profilefor"]) {
    assert.ok(!exported.includes(contract), `core exports something shaped like a profile: ${contract}`);
  }
});
