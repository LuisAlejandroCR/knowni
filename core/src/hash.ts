// hash.ts: the hashing seam every agreeing implementation goes through.
// Merkle nodes, claim commitments and nullifiers hash here, so swapping sha256
// for a circuit-friendly hash is one implementation and one audit.

import { concatBytes, u32be, utf8 } from "./bytes.ts";

export interface FieldHash {
  readonly id: string;
  hash(domain: string, parts: readonly Uint8Array[]): string;
}

export type Digest = (bytes: Uint8Array) => Uint8Array;

// The domain is length-prefixed, so a domain of "ab" with a first part of "c"
// cannot hash the same bytes as a domain of "a" with "bc".
export function createFieldHash(id: string, digest: Digest, toHexValue: (b: Uint8Array) => string): FieldHash {
  return {
    id,
    hash(domain, parts) {
      const encoded: Uint8Array[] = [u32be(domain.length), utf8(domain)];
      for (const part of parts) {
        encoded.push(u32be(part.length), part);
      }
      return toHexValue(digest(concatBytes(encoded)));
    },
  };
}

export { fromHex, toHex, u32be, u64be, utf8 } from "./bytes.ts";
