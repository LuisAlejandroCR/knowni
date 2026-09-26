// consent.spec.ts: el botón de autorizar nombra lo único que falta, en orden.

import { test } from "node:test";
import assert from "node:assert/strict";
import { consentBlocker } from "../../src/domain/consent.ts";

test("nothing chosen asks for a source first", () => {
  assert.equal(consentBlocker({ consented: [], documentNumber: "1020304050", plate: "" }), "Elige al menos una fuente");
});

test("a source without a document asks for the document", () => {
  assert.equal(consentBlocker({ consented: ["registraduria"], documentNumber: "12", plate: "" }), "Escribe tu número de documento");
});

test("the vehicle source also needs a plate", () => {
  assert.equal(consentBlocker({ consented: ["vehiculo"], documentNumber: "1020304050", plate: "AB" }), "Escribe la placa del vehículo");
  assert.equal(consentBlocker({ consented: ["vehiculo"], documentNumber: "1020304050", plate: "ABC123" }), undefined);
});

test("a plate is not required without the vehicle source", () => {
  assert.equal(consentBlocker({ consented: ["listas"], documentNumber: "1020304050", plate: "" }), undefined);
});
