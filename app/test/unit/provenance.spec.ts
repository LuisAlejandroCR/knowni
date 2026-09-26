// provenance.spec.ts: las etiquetas dicen qué es real. Con la llave del emisor
// fijada, ninguna llama "demostración" al emisor; sin ella, ninguna lo llama real.
// La contraparte sigue siendo de prueba en ambos casos.

import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptanceStamp, issuerIsReal, receiptStamp, sessionStamp } from "../../src/domain/provenance.ts";

test("a pinned key makes the issuer real, an empty one does not", () => {
  assert.equal(issuerIsReal("ab".repeat(32)), true);
  assert.equal(issuerIsReal(""), false);
  assert.equal(issuerIsReal(undefined), false);
});

test("with a real issuer no stamp says demo, test, example or simulated", () => {
  for (const stamp of [sessionStamp(true), acceptanceStamp(true), receiptStamp(true)]) {
    assert.doesNotMatch(stamp, /EMISOR Y CONTRAPARTE DE DEMOSTRACIÓN|DATOS DE DEMOSTRACIÓN/);
  }
  for (const stamp of [sessionStamp(true), acceptanceStamp(true), receiptStamp(true)]) {
    assert.doesNotMatch(stamp, /DEMO|PRUEBA|EJEMPLO|SIMULAD/);
  }
});

test("without a pinned key nothing claims the issuer is real", () => {
  for (const stamp of [sessionStamp(false), acceptanceStamp(false), receiptStamp(false)]) {
    assert.doesNotMatch(stamp, /EMISOR REAL|RESPUESTA REAL/);
  }
});
