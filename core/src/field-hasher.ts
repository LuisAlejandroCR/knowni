// field-hasher.ts: hashing the way a circuit hashes.
// `FieldHash` takes bytes and a domain string, which is what SHA-256 wants.
// A circuit's hash takes field elements, and squeezing one into the other is
// how a domain stops meaning anything. So this is its own port.

import { DOMAINS, type DomainName } from "./domains.ts";
import type { Digest } from "./hash.ts";
import { fieldFromHex, fieldFromString } from "./field.ts";
import { poseidon } from "./poseidon.ts";
import { circomlibSpec, parameters, type GrainSpec } from "./poseidon-params.ts";

export interface FieldHasher {
  readonly id: string;
  /// The prime every element it accepts and returns belongs to.
  readonly prime: bigint;
  hashFields(domain: DomainName, elements: readonly bigint[]): bigint;
  /// An open string as an element. On the port because the derivation has to
  /// be the same one the domains use, and a caller should not get to pick.
  element(text: string): bigint;
  /// An element written the way a claim, a leaf and a root are written: 32
  /// bytes of hex, which is what every interface in the product already
  /// passes around.
  toHex(value: bigint): string;
  fromHex(hex: string, what: string): bigint;
}

/// Poseidon over the given field, with the domain as the first element — the
/// same arrangement `circuits/merkle.circom` uses, which is why a root computed
/// here and a root computed there can be the same number.
///
/// The parameters are derived once per width and kept. Deriving them runs a
/// Grain LFSR over hundreds of field elements, and a Merkle tree asks for
/// thousands of hashes: doing it per call turns a tree into minutes.
export function createPoseidonHasher(digest: Digest, prime: bigint, bits: number): FieldHasher {
  const domainElements = new Map<DomainName, bigint>();
  const specs = new Map<number, GrainSpec>();

  const specFor = (inputs: number): GrainSpec => {
    const cached = specs.get(inputs);
    if (cached !== undefined) return cached;
    const spec = circomlibSpec(prime, bits, inputs + 1);
    // Deriving now, and throwing away the result, is what fills the parameter
    // cache inside `parameters` before the first hash asks for it.
    parameters(spec);
    specs.set(inputs, spec);
    return spec;
  };

  return {
    id: `poseidon/${prime.toString(16).slice(0, 8)}`,
    prime,
    element(text) {
      return fieldFromString(digest, text, prime);
    },
    toHex(value) {
      return value.toString(16).padStart(64, "0");
    },
    fromHex(hex, what) {
      return fieldFromHex(hex, prime, what);
    },
    hashFields(domain, elements) {
      const separator = domainElements.get(domain) ?? fieldFromString(digest, DOMAINS[domain], prime);
      domainElements.set(domain, separator);

      const inputs = [separator, ...elements];
      for (const value of inputs) {
        if (value < 0n || value >= prime) throw new RangeError("an input is not an element of this field");
      }
      return poseidon(inputs, specFor(inputs.length));
    },
  };
}
