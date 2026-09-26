// journey-copy.spec.ts: lo que la persona lee en el recorrido. Cada fuente tiene
// un nombre legible y no su identificador, quien pregunta se nombra según la
// finalidad, y solo se celebra cuando hubo al menos una respuesta con evidencia.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { AttestedAnswer } from "@knowni/attestation";
import { IDENTITY_CHECK, VEHICLE_SALE, counterpartyLabel } from "../../src/domain/purpose.ts";
import { SOURCE_LABEL, sourceLabel } from "../../src/domain/sources.ts";
import { shouldCelebrate } from "../../src/domain/celebration.ts";

test("every consentable source has a readable name, never its id", () => {
  for (const id of ["registraduria", "sicaac", "listas", "vehiculo"]) {
    assert.ok(SOURCE_LABEL[id] !== undefined);
    assert.notEqual(sourceLabel(id), id);
  }
  assert.equal(sourceLabel("sicaac"), "SICAAC · insolvencia");
});

test("who asks is named by the purpose", () => {
  assert.equal(counterpartyLabel(VEHICLE_SALE), "Comprador");
  assert.equal(counterpartyLabel(IDENTITY_CHECK), "Solicitante");
});

const answer = (value: AttestedAnswer["value"]): AttestedAnswer => ({
  predicate: "personhood",
  value,
  source: "registraduria",
  provenance: "observed",
  doesNotEstimate: "No dice quién es.",
});

test("celebrate only when at least one source answered with evidence", () => {
  assert.equal(shouldCelebrate([answer(true)]), true);
  assert.equal(shouldCelebrate([answer("unavailable"), answer(true)]), true);
  assert.equal(shouldCelebrate([answer("unavailable")]), false);
  assert.equal(shouldCelebrate([]), false);
  assert.equal(shouldCelebrate(undefined), false);
});
