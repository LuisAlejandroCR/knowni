// crypto.ts: the phone's binding of the domain ports, in pure JS.
// sha256 and ed25519 come from @noble — synchronous and with no native module —
// so the same bytes come out here as on the server.

import { sha256 } from "@noble/hashes/sha2";
import { ed25519 } from "@noble/curves/ed25519";
import { createFieldHash, randomBytes, toHex, type FieldHash } from "@knowni/core";
import type { SignaturePort } from "@knowni/attestation";

export const appHash: FieldHash = createFieldHash("sha256", (bytes) => sha256(bytes), toHex);

export const appSignatures: SignaturePort = {
  algorithm: "ed25519",
  publicKeyOf: (seed) => ed25519.getPublicKey(seed),
  sign: (seed, message) => ed25519.sign(message, seed),
  verify: (publicKey, message, signature) => ed25519.verify(signature, message, publicKey),
  randomSeed: () => randomBytes(32),
};
