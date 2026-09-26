// otp.spec.ts: el código del correo se limpia al pegarlo y, completo, basta
// para entrar. Menos de seis dígitos nunca dispara el ingreso.

import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanOtp, otpComplete } from "../../src/domain/otp.ts";

test("a pasted code keeps only its six digits", () => {
  assert.equal(cleanOtp(" 037 847 "), "037847");
  assert.equal(cleanOtp("037-847"), "037847");
  assert.equal(cleanOtp("0378471234"), "037847");
});

test("only a complete code signs in", () => {
  assert.equal(otpComplete("037847"), true);
  assert.equal(otpComplete("03784"), false);
  assert.equal(otpComplete(""), false);
});
