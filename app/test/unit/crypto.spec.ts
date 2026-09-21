// crypto.spec.ts: the phone's crypto must agree with the server's, byte for byte.
// If @noble and node:crypto disagree, a credential issued on one side stops
// verifying on the other — silently, and only in production.

import { test } from "node:test";
import assert from "node:assert/strict";

import { sha256Hash } from "../../../core/src/node.ts";
import { nodeSignatures } from "../../../attestation/src/node.ts";
import { utf8 } from "../../../core/src/bytes.ts";
import { appHash, appSignatures } from "../../src/domain/crypto.ts";

test("both hashes produce the same digest for the same input", () => {
  for (const [domain, parts] of [
    ["knowni/claim/v1", []],
    ["knowni/claim/v1", [utf8("ana"), utf8("peña")]],
    ["", [new Uint8Array(0)]],
    ["a".repeat(100), [new Uint8Array(1000).fill(7)]],
  ] as const) {
    assert.equal(appHash.hash(domain, parts), sha256Hash.hash(domain, parts));
  }
  assert.equal(appHash.id, sha256Hash.id);
});

test("a signature made on the phone verifies on the server, and the reverse", () => {
  const seed = nodeSignatures.randomSeed();
  const message = utf8("una respuesta firmada");

  assert.deepEqual(
    Array.from(appSignatures.publicKeyOf(seed)),
    Array.from(nodeSignatures.publicKeyOf(seed)),
  );

  const fromPhone = appSignatures.sign(seed, message);
  const fromServer = nodeSignatures.sign(seed, message);
  assert.deepEqual(Array.from(fromPhone), Array.from(fromServer));

  const publicKey = nodeSignatures.publicKeyOf(seed);
  assert.equal(nodeSignatures.verify(publicKey, message, fromPhone), true);
  assert.equal(appSignatures.verify(publicKey, message, fromServer), true);
});

test("a tampered message fails on both sides", () => {
  const seed = nodeSignatures.randomSeed();
  const publicKey = appSignatures.publicKeyOf(seed);
  const signature = appSignatures.sign(seed, utf8("original"));
  assert.equal(appSignatures.verify(publicKey, utf8("alterado"), signature), false);
  assert.equal(nodeSignatures.verify(publicKey, utf8("alterado"), signature), false);
});

test("the phone's seed is 32 bytes and never repeats", () => {
  const a = appSignatures.randomSeed();
  const b = appSignatures.randomSeed();
  assert.equal(a.length, 32);
  assert.notDeepEqual(Array.from(a), Array.from(b));
});
