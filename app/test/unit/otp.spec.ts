// otp.spec.ts: el código del correo se limpia al pegarlo y, completo, basta
// para entrar. Menos de seis dígitos nunca dispara el ingreso.

import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanOtp, otpComplete, resendWaitSeconds } from "../../src/domain/otp.ts";

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

test("a new code waits 30 s after the last send, counting down in whole seconds", () => {
  assert.equal(resendWaitSeconds(undefined, 1_000), 0);
  assert.equal(resendWaitSeconds(0, 0), 30);
  assert.equal(resendWaitSeconds(0, 29_001), 1);
  assert.equal(resendWaitSeconds(0, 30_000), 0);
  assert.equal(resendWaitSeconds(0, 90_000), 0);
});
