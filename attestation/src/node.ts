// node.ts: the Node binding of the signature port, over node:crypto.
// Used by tests, tools and any server-side issuer. React Native binds the same
// port to a pure-JS curve implementation instead.

import { createPrivateKey, createPublicKey, randomBytes, sign, verify } from "node:crypto";
import type { SignaturePort } from "./signing.ts";

const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

const privateKeyOf = (seed: Uint8Array) => {
  if (seed.length !== 32) throw new TypeError("an ed25519 seed is 32 bytes");
  return createPrivateKey({
    key: Buffer.concat([PKCS8_PREFIX, Buffer.from(seed)]),
    format: "der",
    type: "pkcs8",
  });
};

const publicKeyOf = (publicKey: Uint8Array) =>
  createPublicKey({
    key: Buffer.concat([SPKI_PREFIX, Buffer.from(publicKey)]),
    format: "der",
    type: "spki",
  });

export const nodeSignatures: SignaturePort = {
  algorithm: "ed25519",
  publicKeyOf(seed) {
    const spki = createPublicKey(privateKeyOf(seed)).export({ format: "der", type: "spki" });
    return Uint8Array.from(spki.subarray(spki.length - 32));
  },
  sign(seed, message) {
    return Uint8Array.from(sign(null, Buffer.from(message), privateKeyOf(seed)));
  },
  verify(publicKey, message, signature) {
    return verify(null, Buffer.from(message), publicKeyOf(publicKey), Buffer.from(signature));
  },
  randomSeed() {
    return Uint8Array.from(randomBytes(32));
  },
};
