// wallet-keypair.ts: a payer wallet whose key lives on this device.
// It signs the transaction hash like Privy does, so the payment path is the
// same one a passkey wallet will take; the seed never leaves this closure.

import { ed25519 } from "@noble/curves/ed25519";
import { accountIdOf } from "./stellar-payment.ts";
import type { PayerWalletPort } from "./wallet-port.ts";

const HASH_HEX = /^[0-9a-f]{64}$/;

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string): Uint8Array =>
  Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));

export function createKeypairWallet(seed: Uint8Array): PayerWalletPort {
  if (seed.length !== 32) throw new TypeError("invalid seed");
  const key = Uint8Array.from(seed);
  const account = accountIdOf(ed25519.getPublicKey(key));
  let connected: string | undefined;
  return {
    id: "device",
    label: "Llave de este dispositivo",
    signingMethod: "raw_hash",
    accountId: async () => connected,
    connect: async () => {
      connected = account;
      return connected;
    },
    // Only a 32-byte hash is signed: anything else is not a transaction this
    // wallet was asked to pay, and signing it would sign an arbitrary message.
    signTransaction: async (hashHex) => {
      if (connected === undefined || !HASH_HEX.test(hashHex)) return undefined;
      return toHex(ed25519.sign(fromHex(hashHex), key));
    },
    disconnect: async () => {
      connected = undefined;
    },
  };
}
