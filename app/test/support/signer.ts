// signer.ts: a real ed25519 payer for the payment tests.
// Payments now verify the wallet's signature before Horizon sees it, so a test
// wallet has to sign for real — with a fixed seed, so every run is identical.

import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha2";
import { accountIdOf } from "../../src/domain/stellar-payment.ts";

const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString("hex");

export const SIGNER_SEED = new Uint8Array(32).fill(7);
export const SIGNER_ACCOUNT = accountIdOf(ed25519.getPublicKey(SIGNER_SEED));

// What Privy's raw_hash returns: the bare signature of the transaction hash.
export const signHash = (hashHex: string, seed: Uint8Array = SIGNER_SEED): string =>
  toHex(ed25519.sign(Buffer.from(hashHex, "hex"), seed));

// The testnet hash of an unsigned envelope: network id, envelope type, body.
export function hashOfUnsigned(unsignedBase64: string): string {
  const unsigned = Buffer.from(unsignedBase64, "base64");
  const networkId = sha256(new TextEncoder().encode("Test SDF Network ; September 2015"));
  return toHex(sha256(Buffer.concat([networkId, unsigned.subarray(0, -4)])));
}

// What Freighter returns: the same envelope with one decorated signature. The
// hint is the last four bytes of the signer's public key.
export function signEnvelope(unsignedBase64: string, seed: Uint8Array = SIGNER_SEED): string {
  const unsigned = Buffer.from(unsignedBase64, "base64");
  const hashHex = hashOfUnsigned(unsignedBase64);
  const hint = Buffer.from(ed25519.getPublicKey(seed)).subarray(28);
  const signature = Buffer.from(ed25519.sign(Buffer.from(hashHex, "hex"), seed));
  return Buffer.concat([unsigned.subarray(0, -4), Buffer.from([0, 0, 0, 1]), hint, Buffer.from([0, 0, 0, 64]), signature]).toString("base64");
}
