// types.ts: the attested path — an issuer signs a root, a relying party
// checks the signature and the inclusion, and no chain is involved.
// The chain, when there is one, only publishes a receipt of this.

import type { Claim, MerkleProof, Salt } from "@knowni/core";

// A published root, signed once by the issuer. Everything a relying party
// needs to trust a credential is here plus the issuer's public key — and
// the key comes from the registry, never from the credential itself, because
// a credential that carries its own key proves only that someone had a key.
export interface AttestedRoot {
  readonly issuerId: string;
  readonly root: string; // hex
  readonly issuedAt: number; // unix seconds
  readonly size: number; // leaves in the published tree
  readonly algorithm: "ed25519";
  readonly signature: string; // hex
}

// What the subject presents for one predicate: the claim, the salt that
// opens its commitment, the path into the root, and the signed root. It
// travels from the wallet to the relying party and stops there.
export interface AttestedCredential {
  readonly claim: Claim;
  readonly salt: Salt;
  readonly proof: MerkleProof;
  readonly attestation: AttestedRoot;
}

// Why a credential was refused. A fixed vocabulary, for the same reason the
// source adapters have one: "the signature is wrong" and "this issuer is not
// one you accept" are different problems with different fixes, and neither
// of them should arrive as a stack trace.
export type AttestationFailure =
  | "unknown_issuer"
  | "bad_signature"
  | "not_included"
  | "commitment_mismatch"
  | "root_expired"
  | "revoked";

export type AttestationResult =
  | { readonly status: "valid" }
  | { readonly status: "invalid"; readonly reason: AttestationFailure };

// Resolves an issuer's key and revocation state. Deliberately not a chain
// and not an HTTP client: an in-memory map, a signed JSON file over HTTPS
// and a ledger all satisfy this, which is what keeps the chain optional.
export interface IssuerRegistry {
  publicKeyOf(issuerId: string): Uint8Array | undefined;
  // A root the issuer withdrew. Absence of an entry means "not revoked",
  // because a registry that cannot be reached must not silently invalidate
  // every credential ever issued.
  isRevoked?(issuerId: string, root: string): boolean;
}
