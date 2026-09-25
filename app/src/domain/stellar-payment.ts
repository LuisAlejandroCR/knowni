// stellar-payment.ts: the portable Stellar payment path used by payer wallets.
// It builds only PAYMENT + MEMO_HASH, delegates signing, and submits to Horizon;
// no seed, provider response or full envelope is retained or logged.

import { sha256 } from "@noble/hashes/sha2";
import type { PayerWalletPort } from "./wallet-port.ts";
import { HORIZON_URL } from "./wallet-port.ts";

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ENVELOPE_TYPE_TX = 2;

export type PaymentAsset =
  | { readonly type: "native" }
  | { readonly type: "credit"; readonly code: string; readonly issuer: string };

export interface PaymentTerms {
  readonly network: "testnet";
  readonly destination: string;
  readonly asset: PaymentAsset;
  readonly amountStroops: string;
  readonly paymentRef: string;
}

export interface PayQuoteInput {
  readonly terms: PaymentTerms;
  readonly expiresAt: number;
  readonly wallet: PayerWalletPort;
  readonly nowUnix?: number;
  readonly horizonUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

export type PaymentResult =
  | { readonly status: "paid"; readonly txHash: string }
  | {
      readonly status: "failed";
      readonly reason:
        | "quote_expired"
        | "invalid_terms"
        | "wallet_not_connected"
        | "account_not_found"
        | "wallet_rejected"
        | "horizon_rejected"
        | "unreachable";
    };

const concat = (...parts: readonly Uint8Array[]): Uint8Array => {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
};

const u32 = (value: number): Uint8Array => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
};

const i64 = (value: bigint): Uint8Array => {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigInt64(0, value, false);
  return bytes;
};

const fromHex = (hex: string): Uint8Array => {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) throw new TypeError("invalid hex");
  return Uint8Array.from(hex.match(/../g)!.map((pair) => Number.parseInt(pair, 16)));
};

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string): Uint8Array => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

function base32Decode(text: string): Uint8Array {
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of text.replace(/=+$/, "")) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new TypeError("invalid base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(output);
}

function crc16(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data) {
    let code = ((crc >>> 8) & 0xff) ^ byte;
    code ^= code >>> 4;
    crc = ((crc << 8) & 0xffff) ^ ((code << 12) & 0xffff) ^ ((code << 5) & 0xffff) ^ code;
  }
  return crc & 0xffff;
}

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

// The `G…` account id of an ed25519 public key: version byte, key, CRC16.
export function accountIdOf(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) throw new TypeError("invalid public key");
  const body = concat(Uint8Array.of(6 << 3), publicKey);
  const crc = crc16(body);
  return base32Encode(concat(body, Uint8Array.of(crc & 0xff, crc >>> 8)));
}

function accountKey(accountId: string): Uint8Array {
  const raw = base32Decode(accountId);
  if (raw.length !== 35 || raw[0] !== 6 << 3) throw new TypeError("invalid account");
  const body = raw.subarray(0, 33);
  if ((raw[33]! | (raw[34]! << 8)) !== crc16(body)) throw new TypeError("invalid account checksum");
  return raw.subarray(1, 33);
}

const muxedAccount = (key: Uint8Array): Uint8Array => concat(u32(0), key);

function assetXdr(asset: PaymentAsset): Uint8Array {
  if (asset.type === "native") return u32(0);
  const size = asset.code.length <= 4 ? 4 : 12;
  if (!/^[A-Z0-9]{1,12}$/.test(asset.code)) throw new TypeError("invalid asset code");
  const code = new Uint8Array(size);
  code.set(new TextEncoder().encode(asset.code));
  return concat(u32(size === 4 ? 1 : 2), code, u32(0), accountKey(asset.issuer));
}

function transactionXdr(source: Uint8Array, sequence: bigint, terms: PaymentTerms): Uint8Array {
  const amount = BigInt(terms.amountStroops);
  if (amount <= 0n) throw new TypeError("invalid amount");
  const memo = fromHex(terms.paymentRef);
  if (memo.length !== 32) throw new TypeError("invalid memo hash");
  return concat(
    muxedAccount(source),
    u32(100),
    i64(sequence),
    u32(0),
    u32(3),
    memo,
    u32(1),
    u32(0),
    u32(1),
    muxedAccount(accountKey(terms.destination)),
    assetXdr(terms.asset),
    i64(amount),
    u32(0),
  );
}

function transactionHash(transaction: Uint8Array): Uint8Array {
  return sha256(concat(sha256(new TextEncoder().encode(TESTNET_PASSPHRASE)), u32(ENVELOPE_TYPE_TX), transaction));
}

function unsignedEnvelope(transaction: Uint8Array): Uint8Array {
  return concat(u32(ENVELOPE_TYPE_TX), transaction, u32(0));
}

function signedEnvelope(transaction: Uint8Array, publicKey: Uint8Array, signature: Uint8Array): Uint8Array {
  if (signature.length !== 64) throw new TypeError("invalid signature");
  return concat(u32(ENVELOPE_TYPE_TX), transaction, u32(1), publicKey.subarray(28), u32(64), signature);
}

function signsSameTransaction(signed: Uint8Array, transaction: Uint8Array): boolean {
  const prefix = concat(u32(ENVELOPE_TYPE_TX), transaction);
  if (signed.length <= prefix.length + 4) return false;
  return prefix.every((byte, index) => signed[index] === byte) && new DataView(signed.buffer, signed.byteOffset + prefix.length, 4).getUint32(0, false) > 0;
}

export async function payQuote(input: PayQuoteInput): Promise<PaymentResult> {
  const nowUnix = input.nowUnix ?? Math.floor(Date.now() / 1000);
  if (nowUnix >= input.expiresAt) return { status: "failed", reason: "quote_expired" };
  if (input.terms.network !== "testnet") return { status: "failed", reason: "invalid_terms" };

  const accountId = await input.wallet.accountId();
  if (accountId === undefined || input.wallet.signingMethod === "unsupported") {
    return { status: "failed", reason: "wallet_not_connected" };
  }

  const horizon = input.horizonUrl ?? HORIZON_URL;
  const fetchImpl = input.fetchImpl ?? fetch;
  let sequence: bigint;
  try {
    const account = await fetchImpl(`${horizon}/accounts/${accountId}`);
    if (account.status === 404) return { status: "failed", reason: "account_not_found" };
    if (!account.ok) return { status: "failed", reason: "unreachable" };
    const body = (await account.json()) as { sequence?: string };
    if (typeof body.sequence !== "string") return { status: "failed", reason: "unreachable" };
    sequence = BigInt(body.sequence) + 1n;
  } catch {
    return { status: "failed", reason: "unreachable" };
  }

  // Building the transaction and signing it fail for different reasons, so they
  // are caught apart: terms the module refuses to encode are `invalid_terms`,
  // and anything the wallet does — refusing, crashing, answering nonsense — is
  // `wallet_rejected`. One try around both would call a broken signer bad terms.
  let source: Uint8Array;
  let transaction: Uint8Array;
  try {
    source = accountKey(accountId);
    transaction = transactionXdr(source, sequence, input.terms);
  } catch {
    return { status: "failed", reason: "invalid_terms" };
  }

  let envelope: string;
  try {
    if (input.wallet.signingMethod === "raw_hash") {
      const signatureHex = await input.wallet.signTransaction(toHex(transactionHash(transaction)));
      if (signatureHex === undefined) return { status: "failed", reason: "wallet_rejected" };
      envelope = toBase64(signedEnvelope(transaction, source, fromHex(signatureHex)));
    } else {
      const signed = await input.wallet.signTransaction(toBase64(unsignedEnvelope(transaction)));
      if (signed === undefined) return { status: "failed", reason: "wallet_rejected" };
      const signedBytes = fromBase64(signed);
      if (!signsSameTransaction(signedBytes, transaction)) return { status: "failed", reason: "wallet_rejected" };
      envelope = signed;
    }
  } catch {
    return { status: "failed", reason: "wallet_rejected" };
  }

  try {
    const response = await fetchImpl(`${horizon}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `tx=${encodeURIComponent(envelope)}`,
    });
    if (!response.ok) return { status: "failed", reason: "horizon_rejected" };
    const body = (await response.json()) as { hash?: string };
    return typeof body.hash === "string"
      ? { status: "paid", txHash: body.hash }
      : { status: "failed", reason: "horizon_rejected" };
  } catch {
    return { status: "failed", reason: "unreachable" };
  }
}
