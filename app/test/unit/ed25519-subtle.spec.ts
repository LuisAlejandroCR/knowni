// ed25519-subtle.spec.ts: el sustituto de WebCrypto que usa Cavos en React Native.
// Las firmas del sustituto se comprueban con el WebCrypto real de Node, así que
// "firma" significa lo mismo en los dos lados; y solo se instala donde falta.

import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createEd25519Subtle, installEd25519Subtle } from "../../src/domain/ed25519-subtle.ts";

const real = webcrypto.subtle;
const shim = createEd25519Subtle();
const message = new TextEncoder().encode("knowni/cavos/control");

async function verifyWithNode(publicRaw: ArrayBuffer, signature: ArrayBuffer): Promise<boolean> {
  const key = await real.importKey("raw", publicRaw, { name: "Ed25519" }, true, ["verify"]);
  return real.verify({ name: "Ed25519" }, key, signature, message);
}

test("a generated key signs what Node's WebCrypto verifies", async () => {
  const pair = await shim.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
  const publicRaw = await shim.exportKey("raw", pair.publicKey);
  assert.equal(new Uint8Array(publicRaw).length, 32);
  const signature = await shim.sign({ name: "Ed25519" }, pair.privateKey, message);
  assert.equal(await verifyWithNode(publicRaw, signature), true);
});

test("a PKCS#8 key imported from a seed signs like Node's import of the same key", async () => {
  const nodePair = (await real.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const pkcs8 = await real.exportKey("pkcs8", nodePair.privateKey);
  const publicRaw = await real.exportKey("raw", nodePair.publicKey);
  const imported = await shim.importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);
  const signature = await shim.sign({ name: "Ed25519" }, imported, message);
  assert.equal(await verifyWithNode(publicRaw, signature), true);
});

test("the private seed is never exportable, and other algorithms are refused", async () => {
  const pair = await shim.generateKey({ name: "Ed25519" }, false, ["sign"]);
  await assert.rejects(shim.exportKey("raw", pair.privateKey));
  await assert.rejects(shim.generateKey({ name: "ECDSA" }, false, ["sign"]));
});

test("installed only where crypto.subtle is missing", () => {
  const bare: { crypto?: { subtle?: unknown } } = {};
  installEd25519Subtle(bare);
  assert.ok(bare.crypto?.subtle !== undefined);
  const existing = { crypto: { subtle: real } };
  installEd25519Subtle(existing);
  assert.equal(existing.crypto.subtle, real);
});
