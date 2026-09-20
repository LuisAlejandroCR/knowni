// hash.ts: The one hashing seam in the system. Everything that must agree with a circuit —
// Merkle nodes, claim commitments, nullifiers — goes through FieldHash rather than calling
// node:crypto directly, so the day the circuit-compatible hash lands there is exactly one

import { createHash } from "node:crypto";

export interface FieldHash {
  readonly id: string;
  hash(domain: string, parts: readonly Uint8Array[]): string;
}

export const sha256Hash: FieldHash = {
  id: "sha256",
  hash(domain, parts) {
    const h = createHash("sha256");
    // The domain is length-prefixed, so a domain of "ab" with a first part
    // of "c" cannot hash the same bytes as a domain of "a" with "bc".
    h.update(u32be(domain.length));
    h.update(Buffer.from(domain, "utf8"));
    for (const part of parts) {
      h.update(u32be(part.length));
      h.update(part);
    }
    return h.digest("hex");
  },
};

export function u32be(value: number): Uint8Array {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value);
  return buf;
}

export function u64be(value: number | bigint): Uint8Array {
  const n = typeof value === "bigint" ? value : BigInt(assertSafeNonNegative(value));
  if (n < 0n || n > 0xffff_ffff_ffff_ffffn) {
    throw new RangeError(`value out of range for u64: ${n}`);
  }
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(n);
  return buf;
}

export function utf8(value: string): Uint8Array {
  return Buffer.from(value, "utf8");
}

export function fromHex(value: string): Uint8Array {
  if (!/^[0-9a-f]*$/.test(value) || value.length % 2 !== 0) {
    throw new TypeError(`expected lowercase hex of even length, got ${JSON.stringify(value)}`);
  }
  return Buffer.from(value, "hex");
}

function assertSafeNonNegative(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`expected a non-negative safe integer, got ${value}`);
  }
  return value;
}
