// types.ts: the attested path — an issuer signs a root, a relying party checks the signature
// and the inclusion, and no chain is involved. The chain, when there is one, only publishes a
// receipt of this.

import type { Claim, MerkleProof, Salt } from "@knowni/core";

export interface AttestedRoot {
  readonly issuerId: string;
  readonly root: string; // hex
  readonly issuedAt: number; // unix seconds
  readonly size: number; // leaves in the published tree
  readonly algorithm: "ed25519";
  readonly signature: string; // hex
}

export interface AttestedCredential {
  readonly claim: Claim;
  readonly salt: Salt;
  readonly proof: MerkleProof;
  readonly attestation: AttestedRoot;
}

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

export interface IssuerRegistry {
  publicKeyOf(issuerId: string): Uint8Array | undefined;
  isRevoked?(issuerId: string, root: string): boolean;
}
