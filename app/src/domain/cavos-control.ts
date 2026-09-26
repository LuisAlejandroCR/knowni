// cavos-control.ts: keeps the Cavos Stellar control seed across app restarts.
// The kit stores it only in IndexedDB, which React Native lacks, so it is sealed
// here with ECIES to the device's P-256 key and signs the transaction hash — D-88.

import { ed25519 } from "@noble/curves/ed25519";
import { p256 } from "@noble/curves/p256";
import { gcm } from "@noble/ciphers/aes";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";
import { randomBytes } from "@noble/hashes/utils";
import { accountIdOf } from "./stellar-payment.ts";
import { createKeypairWallet } from "./wallet-keypair.ts";
import type { PayerWalletPort } from "./wallet-port.ts";

// The Secure Enclave / Keystore key Cavos's native module already creates
// (NativeDeviceUnwrapKey): its public half seals, only the device can open.
export interface DeviceSealKey {
  publicKeySec1(): Uint8Array;
  unwrap(blob: Uint8Array): Promise<Uint8Array>;
}

export interface SealedStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export type ControlResult =
  | { readonly status: "ready"; readonly wallet: PayerWalletPort }
  | { readonly status: "missing" | "unreadable" | "other_account" };

interface Deps {
  readonly key: DeviceSealKey;
  readonly store: SealedStore;
}

// Byte-for-byte the kit's envelope, so NativeDeviceUnwrapKey.unwrap opens it:
// ephemeral compressed point (33) || nonce (12) || AES-256-GCM ciphertext.
const ECIES_INFO = "cavos-stellar-dek-ecies";
const NONCE_LEN = 12;

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string): Uint8Array =>
  Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));

const storeKey = (userId: string) => `knowni.cavos.control.${userId}`;

function seal(seed: Uint8Array, recipient: Uint8Array): Uint8Array {
  const ephemeralSecret = p256.utils.randomPrivateKey();
  const ephemeral = p256.getPublicKey(ephemeralSecret, true);
  const sharedX = p256.getSharedSecret(ephemeralSecret, recipient, false).subarray(1, 33);
  const kek = hkdf(sha256, sharedX, ephemeral, ECIES_INFO, 32);
  const nonce = randomBytes(NONCE_LEN);
  const ciphertext = gcm(kek, nonce).encrypt(seed);
  const blob = new Uint8Array(ephemeral.length + nonce.length + ciphertext.length);
  blob.set(ephemeral, 0);
  blob.set(nonce, ephemeral.length);
  blob.set(ciphertext, ephemeral.length + nonce.length);
  return blob;
}

// The port a restored seed signs through: the transaction hash only, and the
// seed stays inside createKeypairWallet's closure.
function controlWallet(seed: Uint8Array): PayerWalletPort {
  const wallet = createKeypairWallet(seed);
  seed.fill(0);
  return { ...wallet, id: "cavos", label: "Cavos (llave sellada en este dispositivo)" };
}

// After the kit generated a control key this session: keep the seed of this
// account, sealed, and zero every seed that is not it.
export async function rememberControl(
  input: { readonly userId: string; readonly address: string; readonly seeds: readonly Uint8Array[] },
  deps: Deps,
): Promise<ControlResult> {
  const seed = input.seeds.find((candidate) => accountIdOf(ed25519.getPublicKey(candidate)) === input.address);
  for (const other of input.seeds) if (other !== seed) other.fill(0);
  if (seed === undefined) return { status: "missing" };
  const sealed = seal(seed, deps.key.publicKeySec1());
  await deps.store.set(storeKey(input.userId), JSON.stringify({ address: input.address, sealed: toHex(sealed) }));
  return { status: "ready", wallet: controlWallet(seed) };
}

// A later session: the kit returns the registered account but no key for it.
export async function recallControl(
  input: { readonly userId: string; readonly address: string },
  deps: Deps,
): Promise<ControlResult> {
  const saved = await deps.store.get(storeKey(input.userId));
  if (saved === null) return { status: "missing" };
  let record: { address?: unknown; sealed?: unknown };
  try {
    record = JSON.parse(saved) as typeof record;
  } catch {
    return { status: "unreadable" };
  }
  if (record.address !== input.address) return { status: "other_account" };
  if (typeof record.sealed !== "string") return { status: "unreadable" };
  let seed: Uint8Array;
  try {
    seed = await deps.key.unwrap(fromHex(record.sealed));
  } catch {
    return { status: "unreadable" };
  }
  if (seed.length !== 32 || accountIdOf(ed25519.getPublicKey(seed)) !== input.address) {
    seed.fill(0);
    return { status: "other_account" };
  }
  return { status: "ready", wallet: controlWallet(seed) };
}
