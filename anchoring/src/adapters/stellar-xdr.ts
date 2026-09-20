// stellar-xdr.ts: the smallest slice of Stellar's wire format this project needs — StrKey, a
// payment transaction carrying MEMO_HASH, and its signature payload. Written out because the
// repository ships no dependencies.

import { createHash, createPrivateKey, createPublicKey, sign as cryptoSign } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const VERSION_ACCOUNT = 6 << 3; // 'G'
const VERSION_SEED = 18 << 3; // 'S'

// CRC16-XModem, the checksum StrKey appends. Two bytes, little-endian.
function crc16(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data) {
    let code = (crc >>> 8) & 0xff;
    code ^= byte;
    code ^= code >>> 4;
    crc = ((crc << 8) & 0xffff) ^ ((code << 12) & 0xffff) ^ ((code << 5) & 0xffff) ^ code;
  }
  return crc & 0xffff;
}

function base32Encode(data: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  while (out.length % 8 !== 0) out += "=";
  return out;
}

function base32Decode(text: string): Uint8Array {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text.replace(/=+$/, "")) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new TypeError("not base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

function strkeyEncode(version: number, payload: Uint8Array): string {
  const body = Uint8Array.from([version, ...payload]);
  const checksum = crc16(body);
  return base32Encode(Uint8Array.from([...body, checksum & 0xff, (checksum >> 8) & 0xff]));
}

function strkeyDecode(version: number, text: string): Uint8Array {
  const raw = base32Decode(text);
  if (raw.length !== 35 || raw[0] !== version) throw new TypeError("wrong strkey version or length");
  const body = raw.subarray(0, 33);
  const expected = crc16(body);
  const found = raw[33]! | (raw[34]! << 8);
  if (expected !== found) throw new TypeError("strkey checksum mismatch");
  return raw.subarray(1, 33);
}

export const encodeAccountId = (publicKey: Uint8Array): string => strkeyEncode(VERSION_ACCOUNT, publicKey);
export const decodeAccountId = (accountId: string): Uint8Array => strkeyDecode(VERSION_ACCOUNT, accountId);
export const encodeSeed = (seed: Uint8Array): string => strkeyEncode(VERSION_SEED, seed);
export const decodeSeed = (secret: string): Uint8Array => strkeyDecode(VERSION_SEED, secret);

// Node can do ed25519, but only through DER-wrapped keys. These are the two
// fixed prefixes for a raw 32-byte seed and a raw 32-byte public key.
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export interface Keypair {
  readonly publicKey: Uint8Array;
  readonly accountId: string;
  sign(message: Uint8Array): Uint8Array;
}

export function keypairFromSeed(seed: Uint8Array): Keypair {
  if (seed.length !== 32) throw new TypeError("an ed25519 seed is 32 bytes");
  const privateKey = createPrivateKey({
    key: Buffer.concat([PKCS8_PREFIX, Buffer.from(seed)]),
    format: "der",
    type: "pkcs8",
  });
  // The last 32 bytes of the SPKI encoding are the raw public key.
  const spki = createPublicKey(privateKey).export({ format: "der", type: "spki" });
  const publicKey = Uint8Array.from(spki.subarray(spki.length - 32));
  return {
    publicKey,
    accountId: encodeAccountId(publicKey),
    sign: (message) => Uint8Array.from(cryptoSign(null, Buffer.from(message), privateKey)),
  };
}

// ─── XDR primitives ───────────────────────────────────────────────────────

const u32 = (value: number): Buffer => {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value);
  return buf;
};

const i64 = (value: bigint): Buffer => {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(value);
  return buf;
};

// A MuxedAccount of the plain ed25519 kind: discriminant 0 then 32 bytes.
const muxedAccount = (publicKey: Uint8Array): Buffer => Buffer.concat([u32(0), Buffer.from(publicKey)]);

export interface MemoHashPayment {
  readonly source: Uint8Array; // ed25519 public key
  readonly destination: Uint8Array;
  readonly sequence: bigint; // the account's current sequence + 1
  readonly feeStroops: number;
  readonly amountStroops: bigint;
  readonly memoHash32: Uint8Array;
}

// One transaction shape, encoded field by field in the order the protocol
// fixes: source, fee, seqNum, preconditions (none), memo, operations, ext.
export function encodeTransaction(tx: MemoHashPayment): Buffer {
  if (tx.memoHash32.length !== 32) throw new TypeError("MEMO_HASH is exactly 32 bytes");
  return Buffer.concat([
    muxedAccount(tx.source),
    u32(tx.feeStroops),
    i64(tx.sequence),
    u32(0), // PRECOND_NONE
    u32(3), // MEMO_HASH
    Buffer.from(tx.memoHash32),
    u32(1), // one operation
    u32(0), // no per-operation source account
    u32(1), // PAYMENT
    muxedAccount(tx.destination),
    u32(0), // ASSET_TYPE_NATIVE
    i64(tx.amountStroops),
    u32(0), // transaction ext v0
  ]);
}

const ENVELOPE_TYPE_TX = 2;

export function signaturePayload(networkPassphrase: string, transaction: Buffer): Buffer {
  const networkId = createHash("sha256").update(networkPassphrase, "utf8").digest();
  return Buffer.concat([networkId, u32(ENVELOPE_TYPE_TX), transaction]);
}

export function transactionHash(networkPassphrase: string, transaction: Buffer): string {
  return createHash("sha256").update(signaturePayload(networkPassphrase, transaction)).digest("hex");
}

export function encodeEnvelope(transaction: Buffer, publicKey: Uint8Array, signature: Uint8Array): string {
  return Buffer.concat([
    u32(ENVELOPE_TYPE_TX),
    transaction,
    u32(1),
    Buffer.from(publicKey.subarray(28)),
    u32(signature.length),
    Buffer.from(signature),
  ]).toString("base64");
}
