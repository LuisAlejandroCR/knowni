// expiry.spec.ts: el vencimiento se cuenta desde la solicitud firmada.

import { test } from "node:test";
import assert from "node:assert/strict";
import { expiryText } from "../../src/domain/expiry.ts";

test("minutes left round up so a request never looks shorter than it is", () => {
  assert.equal(expiryText(1_600, 1_000), "Vence en 10 min");
  assert.equal(expiryText(1_061, 1_000), "Vence en 2 min");
  assert.equal(expiryText(1_060, 1_000), "Vence en 1 min");
});

test("the last minute and the past say so plainly", () => {
  assert.equal(expiryText(1_059, 1_000), "Vence en menos de 1 min");
  assert.equal(expiryText(1_000, 1_000), "Venció");
  assert.equal(expiryText(900, 1_000), "Venció");
});
