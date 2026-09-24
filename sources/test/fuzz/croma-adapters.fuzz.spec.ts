// croma-adapters.fuzz.spec.ts: the four adapters of the vehicle-sale profile
// against payloads Croma would never send. An adapter is the only place a
// provider's answer is allowed to exist, so the property is the one the port
// declares: a claim or a typed degradation, and nothing of the payload in
// either. Never an exception, and never a claim built on a guess.

import { test } from "node:test";
import assert from "node:assert/strict";
import { poseidonHash } from "@knowni/core/node";
import type { CromaClient, CromaOutcome } from "../../src/providers/croma/client.ts";
import type { SourceResult } from "../../src/types.ts";
import { createRegistraduriaPersonhoodSource } from "../../src/country/colombia/registraduria.ts";
import { createSicaacCapacitySource } from "../../src/country/colombia/sicaac.ts";
import { createSanctionsSource } from "../../src/country/colombia/sanctions.ts";
import { createVehicleStandingSource } from "../../src/country/colombia/vehicle.ts";

const NOW = 1_760_000_000;
const SUBJECT = { documentKind: "CC", documentNumber: "1020304050", subjectRef: "0a".repeat(32) };
const ASSET = { plate: "ABC123", ownerDocumentNumber: "1020304050", assetRef: "0b".repeat(32) };
const REASONS = new Set(["source_unavailable", "not_found", "consent_missing", "needs_human_review", "invalid_response"]);

/// Planted in every generated payload. Anything of the provider's answer that
/// survives into a result carries it.
const MARKER = "PROVIDER-PAYLOAD-MARKER";

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/// The field names these adapters read, so a generated payload lands on them
/// often enough to matter, with values that are the wrong kind of thing.
const FIELDS = [
  "found",
  "status",
  "cases",
  "has_records",
  "is_fiscal_responsible",
  "reported",
  "pledges",
  "ownership_limitations",
  "clear",
  "verification_code",
  "certified_at",
  "checked_at",
  "__proto__",
  "constructor",
];

function anyValue(next: () => number, depth = 0): unknown {
  const choice = Math.floor(next() * (depth > 2 ? 9 : 12));
  switch (choice) {
    case 0:
      return null;
    case 1:
      return next() < 0.5;
    case 2:
      return Math.floor((next() - 0.5) * 1e9);
    case 3:
      return `${MARKER}-${Math.floor(next() * 1000)}`;
    case 4:
      return "";
    case 5:
      return "ALIVE";
    case 6:
      return "DECEASED";
    case 7:
      return [];
    case 8:
      return Array.from({ length: Math.floor(next() * 4) }, () => anyValue(next, depth + 1));
    default: {
      const record: Record<string, unknown> = {};
      for (let i = 0; i < Math.floor(next() * 6); i += 1) {
        record[FIELDS[Math.floor(next() * FIELDS.length)]!] = anyValue(next, depth + 1);
      }
      return record;
    }
  }
}

/// Answers every path with a fresh arbitrary payload, or with a degradation.
function fuzzedClient(next: () => number): CromaClient {
  return {
    call(): Promise<CromaOutcome> {
      if (next() < 0.15) return Promise.resolve({ status: "degraded", reason: "source_unavailable" });
      return Promise.resolve({ status: "data", data: anyValue(next) });
    },
  };
}

function assertWellFormed(result: SourceResult, where: string): void {
  assert.ok(result.status === "claimed" || result.status === "degraded", `${where}: ${JSON.stringify(result)}`);
  if (result.status === "degraded") {
    assert.ok(REASONS.has(result.reason), `${where}: unknown reason "${result.reason}"`);
    return;
  }
  // A claim carries its own subject reference and a time this process chose —
  // never a stamp, a name or a code the provider wrote.
  assert.equal(typeof result.claim.kind, "string");
  assert.equal(result.claim.jurisdiction, "CO");
  assert.equal(result.claim.attestedAt, NOW);
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes(MARKER), `${where}: the provider's payload reached the result — ${serialized}`);
}

test("no payload makes an adapter throw, and none of it reaches the result", async () => {
  let claimed = 0;
  for (let seed = 1; seed <= 400; seed += 1) {
    const next = rng(seed);
    const client = fuzzedClient(next);

    const results = [
      [`personhood seed ${seed}`, await createRegistraduriaPersonhoodSource(client).fetch(SUBJECT, NOW)],
      [`capacity seed ${seed}`, await createSicaacCapacitySource(client).fetch(SUBJECT, NOW)],
      [`sanctions seed ${seed}`, await createSanctionsSource(client, poseidonHash).fetch(SUBJECT, NOW)],
      [`standing seed ${seed}`, await createVehicleStandingSource(client).fetch(ASSET, NOW)],
    ] as const;
    for (const [where, result] of results) {
      assertWellFormed(result, where);
      if (result.status === "claimed") claimed += 1;
    }
  }
  // Without this the test could pass by degrading on everything, which proves
  // nothing about what a claim is allowed to carry.
  assert.ok(claimed > 0, "no generated payload ever produced a claim: the run is vacuous");
});

// The shapes that are not objects at all, which is what a registry answering
// an error page through a JSON wrapper produces.
test("a payload that is not an object is an invalid response, not a claim", async () => {
  const notObjects = [null, 0, 1, "", "text", true, false, [], [1, 2, 3]];
  for (const data of notObjects) {
    const client: CromaClient = { call: () => Promise.resolve({ status: "data", data } as CromaOutcome) };
    for (const [name, result] of [
      ["personhood", await createRegistraduriaPersonhoodSource(client).fetch(SUBJECT, NOW)],
      ["capacity", await createSicaacCapacitySource(client).fetch(SUBJECT, NOW)],
      ["sanctions", await createSanctionsSource(client, poseidonHash).fetch(SUBJECT, NOW)],
      ["standing", await createVehicleStandingSource(client).fetch(ASSET, NOW)],
    ] as const) {
      assert.equal(result.status, "degraded", `${name} claimed something from ${JSON.stringify(data)}`);
    }
  }
});

// `degraded` and `false` are different answers and the whole product depends
// on not confusing them: a payload nobody can read must never become a "no".
test("an unreadable payload never becomes a negative answer", async () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const next = rng(seed);
    const client: CromaClient = {
      call: () => Promise.resolve({ status: "data", data: { [FIELDS[Math.floor(next() * FIELDS.length)]!]: MARKER } }),
    };
    const results = [
      await createSicaacCapacitySource(client).fetch(SUBJECT, NOW),
      await createSanctionsSource(client, poseidonHash).fetch(SUBJECT, NOW),
      await createVehicleStandingSource(client).fetch(ASSET, NOW),
    ];
    for (const result of results) assert.equal(result.status, "degraded", `seed ${seed}`);
  }
});
