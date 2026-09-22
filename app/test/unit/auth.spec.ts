// auth.spec.ts: the session that guards the wallet.
// Passkey is the door, the magic link is only the way back in, and a session
// is short and tied to the device it was opened on.

import { test } from "node:test";
import assert from "node:assert/strict";

import { SESSION_SECONDS, boundToDevice, createPrivyAuth, isActive } from "../../src/domain/auth.ts";

const NOW = 1_789_000_000;
const DEVICE = "device-1";

const bridge = {
  loginWithPasskey: async () => ({ userId: "u1" }),
  loginWithEmailCode: async (token: string) => (token === "bueno" ? { userId: "u1" } : undefined),
  logout: async () => {},
};

test("a passkey opens a short session tied to this device", async () => {
  const auth = createPrivyAuth(bridge);
  const session = await auth.signInWithPasskey(DEVICE, NOW);
  assert.ok(session);
  assert.equal(session.factor, "passkey");
  assert.equal(session.expiresAt - session.startedAt, SESSION_SECONDS);
  assert.equal(boundToDevice(session, DEVICE), true);
  assert.equal(boundToDevice(session, "otro-telefono"), false);
});

test("the session expires, and one from the future is not active either", async () => {
  const auth = createPrivyAuth(bridge);
  const session = (await auth.signInWithPasskey(DEVICE, NOW))!;
  assert.equal(isActive(session, NOW + 60), true);
  assert.equal(isActive(session, NOW + SESSION_SECONDS), false);
  assert.equal(isActive(session, NOW - 60), false);
  assert.equal(isActive(undefined, NOW), false);
});

test("the magic link recovers, and says it was a recovery", async () => {
  const auth = createPrivyAuth(bridge);
  const session = await auth.recoverWithMagicLink("bueno", DEVICE, NOW);
  assert.equal(session?.factor, "magic_link");
  // A factor that is recorded can be treated differently later; one that is
  // not recorded cannot.
  assert.equal(await auth.recoverWithMagicLink("robado", DEVICE, NOW), undefined);
});

test("without the provider configured nobody gets a session", async () => {
  const auth = createPrivyAuth(undefined);
  assert.equal(await auth.signInWithPasskey(DEVICE, NOW), undefined);
  assert.equal(await auth.recoverWithMagicLink("bueno", DEVICE, NOW), undefined);
});

test("no source password is anywhere in a session", async () => {
  const auth = createPrivyAuth(bridge);
  const session = await auth.signInWithPasskey(DEVICE, NOW);
  assert.deepEqual(Object.keys(session!).sort(), [
    "deviceId",
    "expiresAt",
    "factor",
    "startedAt",
    "userId",
  ]);
});
