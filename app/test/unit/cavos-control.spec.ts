// cavos-control.spec.ts: the Cavos control seed sealed to the device key (K1–K4).
// The fake device key unwraps exactly as the kit's NativeDeviceUnwrapKey does,
// so a seal that opens here opens on the phone.

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519";
import { p256 } from "@noble/curves/p256";
import { gcm } from "@noble/ciphers/aes";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";

import { recallControl, rememberControl, type DeviceSealKey, type SealedStore } from "../../src/domain/cavos-control.ts";
import { accountIdOf } from "../../src/domain/stellar-payment.ts";

// @cavos/kit 0.2.5, dist/react-native: ECIES_INFO, NONCE_LEN and NativeDeviceUnwrapKey.unwrap.
const ECIES_INFO = "cavos-stellar-dek-ecies";

function deviceKey(): DeviceSealKey & { opened: number } {
  const secret = p256.utils.randomPrivateKey();
  const key = {
    opened: 0,
    publicKeySec1: () => p256.getPublicKey(secret, false),
    async unwrap(blob: Uint8Array) {
      key.opened += 1;
      const ephemeral = blob.subarray(0, 33);
      const sharedX = p256.getSharedSecret(secret, ephemeral, false).subarray(1, 33);
      const kek = hkdf(sha256, sharedX, ephemeral, ECIES_INFO, 32);
      const wrapped = blob.subarray(33);
      return gcm(kek, wrapped.subarray(0, 12)).decrypt(wrapped.subarray(12));
    },
  };
  return key;
}

function memoryStore(): SealedStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return { values, get: async (key) => values.get(key) ?? null, set: async (key, value) => void values.set(key, value) };
}

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");
const USER = "firebase-uid-1";

function control() {
  const seed = new Uint8Array(randomBytes(32));
  return { seed, address: accountIdOf(ed25519.getPublicKey(seed)) };
}

test("K1: only a sealed envelope is stored, never the seed", async () => {
  const { seed, address } = control();
  const store = memoryStore();
  const remembered = await rememberControl({ userId: USER, address, seeds: [seed] }, { key: deviceKey(), store });
  assert.equal(remembered.status, "ready");
  const saved = [...store.values.values()].join("");
  assert.ok(saved.length > 0);
  assert.equal(saved.includes(hex(seed)), false);
  assert.equal(saved.includes(Buffer.from(seed).toString("base64")), false);
});

test("K2: a new session opens the envelope and signs as the same account", async () => {
  const { seed, address } = control();
  const publicKey = ed25519.getPublicKey(seed);
  const key = deviceKey();
  const store = memoryStore();
  await rememberControl({ userId: USER, address, seeds: [seed] }, { key, store });
  assert.ok(seed.every((byte) => byte === 0), "the caller's seed is zeroed once sealed");

  const recalled = await recallControl({ userId: USER, address }, { key, store });
  assert.equal(recalled.status, "ready");
  if (recalled.status !== "ready") return;
  assert.equal(await recalled.wallet.connect(), address);
  const hash = new Uint8Array(randomBytes(32));
  const signature = await recalled.wallet.signTransaction(hex(hash));
  assert.ok(signature !== undefined);
  assert.equal(ed25519.verify(Buffer.from(signature, "hex"), hash, publicKey), true);
  assert.equal(key.opened, 1);
});

test("K1: of the seeds the kit generated, only the one of this account is kept", async () => {
  const other = control();
  const mine = control();
  const store = memoryStore();
  const remembered = await rememberControl(
    { userId: USER, address: mine.address, seeds: [other.seed, mine.seed] },
    { key: deviceKey(), store },
  );
  assert.equal(remembered.status, "ready");
  if (remembered.status === "ready") assert.equal(await remembered.wallet.connect(), mine.address);
});

test("K3: no envelope, a tampered one, or one of another account signs nothing", async () => {
  const key = deviceKey();
  const { address } = control();

  assert.deepEqual(await recallControl({ userId: USER, address }, { key, store: memoryStore() }), { status: "missing" });

  const first = control();
  const tampered = memoryStore();
  await rememberControl({ userId: USER, address: first.address, seeds: [first.seed] }, { key, store: tampered });
  for (const [name, value] of tampered.values) {
    const record = JSON.parse(value) as { sealed: string };
    const flipped = record.sealed.slice(0, -2) + (record.sealed.endsWith("00") ? "01" : "00");
    tampered.values.set(name, JSON.stringify({ ...record, sealed: flipped }));
  }
  assert.deepEqual(await recallControl({ userId: USER, address: first.address }, { key, store: tampered }), {
    status: "unreadable",
  });

  const second = control();
  const store = memoryStore();
  await rememberControl({ userId: USER, address: second.address, seeds: [second.seed] }, { key, store });
  const elsewhere = control().address;
  assert.deepEqual(await recallControl({ userId: USER, address: elsewhere }, { key, store }), { status: "other_account" });
});

test("K3: a kit that generated no seed of this account remembers nothing", async () => {
  const { address } = control();
  const store = memoryStore();
  const remembered = await rememberControl({ userId: USER, address, seeds: [control().seed] }, { key: deviceKey(), store });
  assert.deepEqual(remembered, { status: "missing" });
  assert.equal(store.values.size, 0);
});

test("K4: the seed never appears in a result", async () => {
  const { seed, address } = control();
  const store = memoryStore();
  const remembered = await rememberControl({ userId: USER, address, seeds: [seed] }, { key: deviceKey(), store });
  const shown = JSON.stringify(remembered, (_k, value) => (value instanceof Uint8Array ? hex(value) : value));
  assert.equal(shown.includes(hex(seed)), false);
});
