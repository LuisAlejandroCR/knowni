// sources/test/croma-adapters.test.ts
// The four adapters of the vehicle-sale profile. Responses are built from
// the shapes Croma's own OpenAPI declares (captured 2026-09-20), so what is
// exercised is the contract and not a convenient invention.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { CromaClient, CromaOutcome } from "../src/croma/client.ts";
import { createRegistraduriaPersonhoodSource } from "../src/croma/registraduria.ts";
import { createSicaacCapacitySource } from "../src/croma/sicaac.ts";
import { createSanctionsSource } from "../src/croma/sanctions.ts";
import { createVehicleStandingSource } from "../src/croma/vehicle.ts";

const NOW = 1_760_000_000;
const subject = { documentKind: "CC", documentNumber: "1020304050", subjectRef: "a".repeat(64) };
const asset = { plate: "ABC123", ownerDocumentNumber: "1020304050", assetRef: "b".repeat(64) };

// A client that answers per path, and records what it was asked.
function clientOf(byPath: Record<string, CromaOutcome>): CromaClient & { paths: string[] } {
  const paths: string[] = [];
  return {
    paths,
    async call(path: string): Promise<CromaOutcome> {
      paths.push(path);
      return byPath[path] ?? { status: "degraded", reason: "source_unavailable" };
    },
  };
}

const data = (value: unknown): CromaOutcome => ({ status: "data", data: value });
const down: CromaOutcome = { status: "degraded", reason: "source_unavailable" };

const VITAL = "/co/registraduria/vital-status/v1";
const INSOLVENCY = "/co/sicaac/insolvency-cases/v1";
const PROC = "/co/procuraduria/disciplinary-records/v1";
const CONTRAL = "/co/contraloria/fiscal-records/v1";
const CONTAD = "/co/contaduria/state-delinquent-debtors/v1";
const RUNT = "/co/runt/vehicle-by-plate/v1";
const SIMIT = "/co/simit/account-status/v1";

// ─── personhood ───────────────────────────────────────────────────────────

test("a living cédula holder is personhood, and the claim carries no document number", async () => {
  const source = createRegistraduriaPersonhoodSource(
    clientOf({ [VITAL]: data({ found: true, document_number: "1020304050", status: "ALIVE" }) }),
  );
  const result = await source.fetch(subject, NOW);
  assert.equal(result.status, "claimed");
  assert.ok(!JSON.stringify(result).includes("1020304050"));
  if (result.status !== "claimed" || result.claim.kind !== "identity") throw new Error("shape");
  assert.deepEqual(
    [result.claim.documentValid, result.claim.subjectAlive, result.claim.ofAge],
    [true, true, true],
  );
});

test("a deceased holder produces a claim that says so, not a degradation", async () => {
  const source = createRegistraduriaPersonhoodSource(
    clientOf({ [VITAL]: data({ found: true, document_number: "x", status: "DECEASED" }) }),
  );
  const result = await source.fetch(subject, NOW);
  assert.equal(result.status, "claimed");
  assert.equal(
    result.status === "claimed" && result.claim.kind === "identity" ? result.claim.subjectAlive : true,
    false,
  );
});

test("a cédula the register does not hold is not-found, never a dead person", async () => {
  const source = createRegistraduriaPersonhoodSource(
    clientOf({ [VITAL]: data({ found: false, document_number: "x", status: null }) }),
  );
  assert.deepEqual(await source.fetch(subject, NOW), {
    status: "degraded",
    reason: "not_found",
  });
});

test("UNKNOWN is an unparsed upstream value, so it becomes no claim at all", async () => {
  const source = createRegistraduriaPersonhoodSource(
    clientOf({ [VITAL]: data({ found: true, document_number: "x", status: "UNKNOWN" }) }),
  );
  assert.deepEqual(await source.fetch(subject, NOW), {
    status: "degraded",
    reason: "invalid_response",
  });
});

test("this route cannot speak to age for a document that is not a cédula", async () => {
  const source = createRegistraduriaPersonhoodSource(
    clientOf({ [VITAL]: data({ found: true, document_number: "x", status: "ALIVE" }) }),
  );
  const result = await source.fetch({ ...subject, documentKind: "CE" }, NOW);
  assert.deepEqual(result, { status: "degraded", reason: "needs_human_review" });
});

// ─── capacity ─────────────────────────────────────────────────────────────

test("an empty insolvency register is an unrestricted capacity claim", async () => {
  const source = createSicaacCapacitySource(
    clientOf({ [INSOLVENCY]: data({ document_number: "x", cases: [] }) }),
  );
  const result = await source.fetch(subject, NOW);
  assert.equal(result.status, "claimed");
  if (result.status !== "claimed" || result.claim.kind !== "capacity") throw new Error("shape");
  assert.equal(result.claim.restricted, false);
  assert.equal(result.claim.basis, "insolvency_proceeding");
});

test("a case on record restricts capacity without carrying the case", async () => {
  const source = createSicaacCapacitySource(
    clientOf({
      [INSOLVENCY]: data({
        document_number: "x",
        cases: [
          { entity_name: "CENTRO DE CONCILIACION XYZ", party_type: "Solicitante", request_date: "2025-02-11" },
        ],
      }),
    }),
  );
  const result = await source.fetch(subject, NOW);
  assert.equal(result.status === "claimed" && result.claim.kind === "capacity" && result.claim.restricted, true);
  assert.ok(!JSON.stringify(result).includes("CONCILIACION"));
});

// ─── sanctions ────────────────────────────────────────────────────────────

const cleanRegisters = {
  [PROC]: data({ found: true, has_records: false, status: "El ciudadano no presenta antecedentes", checked_at: "2026-09-20T10:00:00Z" }),
  [CONTRAL]: data({ found: true, is_fiscal_responsible: false, verification_code: "ABC-123", certified_at: "2026-09-20" }),
  [CONTAD]: data({ found: true, reported: false, checked_at: "2026-09-20T10:00:05Z" }),
};

test("three clean registers make one standing claim, rooted in the snapshots read", async () => {
  const client = clientOf(cleanRegisters);
  const result = await createSanctionsSource(client).fetch(subject, NOW);
  assert.equal(result.status, "claimed");
  if (result.status !== "claimed" || result.claim.kind !== "standing") throw new Error("shape");
  assert.equal(result.claim.listed, false);
  assert.match(result.claim.listSetRoot, /^[0-9a-f]{64}$/);
  assert.equal(client.paths.length, 3);
});

test("the root changes when a register publishes a different snapshot", async () => {
  const first = await createSanctionsSource(clientOf(cleanRegisters)).fetch(subject, NOW);
  const second = await createSanctionsSource(
    clientOf({
      ...cleanRegisters,
      [CONTRAL]: data({ found: true, is_fiscal_responsible: false, verification_code: "ZZZ-999" }),
    }),
  ).fetch(subject, NOW);
  const rootOf = (r: typeof first) =>
    r.status === "claimed" && r.claim.kind === "standing" ? r.claim.listSetRoot : "";
  assert.notEqual(rootOf(first), rootOf(second));
});

test("one register reporting is enough to be listed", async () => {
  const result = await createSanctionsSource(
    clientOf({
      ...cleanRegisters,
      [PROC]: data({ found: true, has_records: true, status: "SANCION", checked_at: "2026-09-20T10:00:00Z" }),
    }),
  ).fetch(subject, NOW);
  assert.equal(result.status === "claimed" && result.claim.kind === "standing" && result.claim.listed, true);
});

test("a register that could not be read makes the whole screening unavailable", async () => {
  const result = await createSanctionsSource(
    clientOf({ ...cleanRegisters, [CONTAD]: down }),
  ).fetch(subject, NOW);
  assert.deepEqual(result, { status: "degraded", reason: "source_unavailable" });
});

test("the full name the Procuraduría returns never reaches the claim", async () => {
  const result = await createSanctionsSource(
    clientOf({
      ...cleanRegisters,
      [PROC]: data({ found: true, full_name: "MARIA RODRIGUEZ GOMEZ", has_records: false, checked_at: "2026-09-20T10:00:00Z" }),
    }),
  ).fetch(subject, NOW);
  assert.ok(!JSON.stringify(result).includes("RODRIGUEZ"));
});

// ─── assetStanding ────────────────────────────────────────────────────────

const cleanVehicle = {
  [RUNT]: data({ found: true, plate: "ABC123", pledges: [], ownership_limitations: [] }),
  [SIMIT]: data({ found: true, document_number: "ABC123", is_plate: true, clear: true }),
};

test("a registered, unpledged plate with no fines is a clean asset claim", async () => {
  const result = await createVehicleStandingSource(clientOf(cleanVehicle)).fetch(asset, NOW);
  assert.equal(result.status, "claimed");
  if (result.status !== "claimed" || result.claim.kind !== "assetStanding") throw new Error("shape");
  assert.deepEqual(
    [result.claim.registered, result.claim.encumbered, result.claim.finesOutstanding],
    [true, false, false],
  );
  // The claim is about the car, filed under the plate's salted ref.
  assert.equal(result.claim.subjectRef.hex, asset.assetRef);
});

test("a pledge makes the asset encumbered, and the creditor stays behind", async () => {
  const result = await createVehicleStandingSource(
    clientOf({
      ...cleanVehicle,
      [RUNT]: data({
        found: true,
        plate: "ABC123",
        pledges: [{ creditor: "BANCO DE OCCIDENTE", registered_date: "2024-03-02" }],
        ownership_limitations: [],
      }),
    }),
  ).fetch(asset, NOW);
  assert.equal(
    result.status === "claimed" && result.claim.kind === "assetStanding" && result.claim.encumbered,
    true,
  );
  assert.ok(!JSON.stringify(result).includes("OCCIDENTE"));
});

test("an ownership limitation counts as an encumbrance too", async () => {
  const result = await createVehicleStandingSource(
    clientOf({
      ...cleanVehicle,
      [RUNT]: data({
        found: true,
        plate: "ABC123",
        pledges: [],
        ownership_limitations: [{ limitation_type: "EMBARGO", legal_entity: "JUZGADO 5" }],
      }),
    }),
  ).fetch(asset, NOW);
  assert.equal(
    result.status === "claimed" && result.claim.kind === "assetStanding" && result.claim.encumbered,
    true,
  );
});

test("SIMIT's own paz-y-salvo verdict is what decides fines, not our arithmetic", async () => {
  const result = await createVehicleStandingSource(
    clientOf({
      ...cleanVehicle,
      [SIMIT]: data({ found: true, is_plate: true, clear: false, summary: { payable_total: 812_000 } }),
    }),
  ).fetch(asset, NOW);
  assert.equal(
    result.status === "claimed" && result.claim.kind === "assetStanding" && result.claim.finesOutstanding,
    true,
  );
  assert.ok(!JSON.stringify(result).includes("812000"));
});

test("a plate with no RUNT record is not-found, never a clean car", async () => {
  const result = await createVehicleStandingSource(
    clientOf({ ...cleanVehicle, [RUNT]: data({ found: false, plate: "ABC123" }) }),
  ).fetch(asset, NOW);
  assert.deepEqual(result, { status: "degraded", reason: "not_found" });
});

test("SIMIT being down does not turn into a car with no fines", async () => {
  const result = await createVehicleStandingSource(
    clientOf({ ...cleanVehicle, [SIMIT]: down }),
  ).fetch(asset, NOW);
  assert.deepEqual(result, { status: "degraded", reason: "source_unavailable" });
});
