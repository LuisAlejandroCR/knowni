// bytes.ts: byte helpers over Uint8Array, with no Buffer and no node:crypto.
// React Native has neither, and the domain has to run on a phone, so every
// encoding the protocol depends on lives here.

const HEX = "0123456789abcdef";

export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += HEX[byte >> 4]! + HEX[byte & 15]!;
  return out;
}

export function fromHex(value: string): Uint8Array {
  if (!/^[0-9a-f]*$/.test(value) || value.length % 2 !== 0) {
    throw new TypeError(`expected lowercase hex of even length, got ${JSON.stringify(value)}`);
  }
  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function u32be(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, false);
  return out;
}

// Fixed-width big-endian, never decimal text: two integers concatenated as
// strings are ambiguous (1‖23 and 12‖3 are the same bytes).
export function u64be(value: number | bigint): Uint8Array {
  const n = typeof value === "bigint" ? value : BigInt(assertSafeNonNegative(value));
  if (n < 0n || n > 0xffff_ffff_ffff_ffffn) {
    throw new RangeError(`value out of range for u64: ${n}`);
  }
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, n, false);
  return out;
}

export function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// Length-prefixing, in one place, because every domain-separated structure in
// this codebase needs it and re-implementing it per file is how two of them
// drift apart.
export function lengthPrefixed(parts: readonly Uint8Array[]): Uint8Array {
  return concatBytes(parts.flatMap((part) => [u32be(part.length), part]));
}

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function assertSafeNonNegative(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`expected a non-negative safe integer, got ${value}`);
  }
  return value;
}
