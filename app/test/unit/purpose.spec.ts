// purpose.spec.ts: la finalidad sigue a lo autorizado. Sin RUNT y SIMIT no hay
// compraventa de vehículo; con ellos, sí. Y la solicitud firmada que viaja al
// emisor lleva esa finalidad, no la que traía antes del consentimiento.

import { test } from "node:test";
import assert from "node:assert/strict";
import { IDENTITY_CHECK, VEHICLE_SALE, purposeFor, purposeLabel } from "../../src/domain/purpose.ts";
import { demoRequest } from "../../src/domain/demo-issuer.ts";

test("without the vehicle source the purpose is an identity check", () => {
  assert.equal(purposeFor(["registraduria"]), IDENTITY_CHECK);
  assert.equal(purposeFor(["registraduria", "sicaac", "listas"]), IDENTITY_CHECK);
  assert.equal(purposeLabel(purposeFor(["registraduria"])), "Verificación de identidad");
});

test("with RUNT and SIMIT it is a vehicle sale", () => {
  assert.equal(purposeFor(["registraduria", "vehiculo"]), VEHICLE_SALE);
  assert.equal(purposeLabel(VEHICLE_SALE), "Compraventa de vehículo");
});

test("the signed request carries the purpose it was built with", () => {
  assert.equal(demoRequest(1_760_000_000, IDENTITY_CHECK).request.purpose, IDENTITY_CHECK);
  assert.equal(demoRequest(1_760_000_000, VEHICLE_SALE).request.purpose, VEHICLE_SALE);
});
