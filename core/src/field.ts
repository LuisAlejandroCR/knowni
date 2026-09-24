// field.ts: how a claim's values become field elements.
// A circuit cannot hash a string or a 64-bit integer — it adds and multiplies
// elements of one prime field. Everything a commitment binds has to arrive as
// one of those, and this file is the only place that decides how.

import type { Digest } from "./hash.ts";
import { utf8 } from "./bytes.ts";

/// Reading a value into the field and reducing it is not the same as reading
/// it: two different 256-bit numbers can land on one element. Where the value
/// is supposed to BE an element already — a subject reference, a set root, a
/// salt — reducing would quietly merge two of them, so this refuses instead.
export class NotInFieldError extends RangeError {
  constructor(what: string) {
    super(`${what} is not an element of this field`);
    this.name = "NotInFieldError";
  }
}

/// An open string — a jurisdiction, a currency, a basis — is not an element
/// and cannot be one injectively. It is hashed, and the digest is a parameter
/// because `core/` never learns what platform it is on. The derivation is the
/// one `circuits/tools/domains.ts` uses, so both sides compute it the same way
/// from the same string.
export function fieldFromString(digest: Digest, value: string, prime: bigint): bigint {
  return bytesToFieldReduced(digest(utf8(value)), prime);
}

/// A non-negative integer small enough to be exact in JavaScript and to fit
/// the field with room to spare. A timestamp, a count, an amount in minor
/// units: all of them are this.
export function fieldFromUint(value: number, what: string): bigint {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${what} must be a non-negative safe integer`);
  }
  return BigInt(value);
}

export function fieldFromBoolean(value: boolean): bigint {
  return value ? 1n : 0n;
}

/// A value that is already an element, written as hex. Out of range is an
/// error, never a reduction — see NotInFieldError.
export function fieldFromHex(hex: string, prime: bigint, what: string): bigint {
  const normalised = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (normalised.length === 0 || /[^0-9a-fA-F]/.test(normalised)) {
    throw new RangeError(`${what} is not hexadecimal`);
  }
  const value = BigInt(`0x${normalised}`);
  if (value >= prime) throw new NotInFieldError(what);
  return value;
}

function bytesToFieldReduced(bytes: Uint8Array, prime: bigint): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value % prime;
}
