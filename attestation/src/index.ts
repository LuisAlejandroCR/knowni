// index.ts: signing and checking an attested credential, offline.
// The issuer signs a root once; the check is signature, Merkle inclusion and
// commitment opening, with no network and no chain.

import type { Claim, FieldHasher, Salt } from "@knowni/core";
import { commitClaim, fromHex, hashLeaf, lengthPrefixed, toHex, u64be, utf8, verifyInclusion } from "@knowni/core";
import type { SignaturePort } from "./signing.ts";
import type {
  AttestationResult,
  AttestedCredential,
  AttestedRoot,
  IssuerRegistry,
} from "./types.ts";


const ROOT_DOMAIN = "knowni/issuer-root/v1";

export function signedBytes(root: Omit<AttestedRoot, "signature" | "algorithm">): Uint8Array {
  return lengthPrefixed([
    utf8(ROOT_DOMAIN),
    utf8(root.issuerId),
    utf8(root.root),
    u64be(root.issuedAt),
    u64be(root.size),
  ]);
}

export interface IssuerKeypair {
  readonly privateKeySeed: Uint8Array;
  readonly publicKey: Uint8Array;
}

export function generateIssuerKeypair(signatures: SignaturePort): IssuerKeypair {
  const seed = signatures.randomSeed();
  return { privateKeySeed: seed, publicKey: signatures.publicKeyOf(seed) };
}

export function attestRoot(
  signatures: SignaturePort,
  seed: Uint8Array,
  root: Omit<AttestedRoot, "signature" | "algorithm">,
): AttestedRoot {
  return {
    ...root,
    algorithm: "ed25519",
    signature: toHex(signatures.sign(seed, signedBytes(root))),
  };
}

export function verifyAttestedRoot(
  signatures: SignaturePort,
  registry: IssuerRegistry,
  attestation: AttestedRoot,
): AttestationResult {
  const publicKey = registry.publicKeyOf(attestation.issuerId);
  if (publicKey === undefined) return { status: "invalid", reason: "unknown_issuer" };
  if (registry.isRevoked?.(attestation.issuerId, attestation.root) === true) {
    return { status: "invalid", reason: "revoked" };
  }

  let signature: Uint8Array;
  try {
    signature = fromHex(attestation.signature);
  } catch {
    return { status: "invalid", reason: "bad_signature" };
  }

  const ok = signatures.verify(publicKey, signedBytes(attestation), signature);
  return ok ? { status: "valid" } : { status: "invalid", reason: "bad_signature" };
}

export interface CredentialCheck {
  readonly signatures: SignaturePort;
  readonly registry: IssuerRegistry;
  readonly nowUnix: number;
  readonly maxRootAgeSeconds: number;
}

// The whole offline check, in the order that fails cheapest first.
export function verifyCredential(
  h: FieldHasher,
  credential: AttestedCredential,
  check: CredentialCheck,
): AttestationResult {
  const rootResult = verifyAttestedRoot(check.signatures, check.registry, credential.attestation);
  if (rootResult.status === "invalid") return rootResult;

  const age = check.nowUnix - credential.attestation.issuedAt;
  // A root stamped in the future is a clock problem or a forgery; either way
  // it is not fresher than fresh.
  if (age < 0 || age > check.maxRootAgeSeconds) return { status: "invalid", reason: "root_expired" };

  if (credential.proof.root !== credential.attestation.root) {
    return { status: "invalid", reason: "not_included" };
  }
  if (!verifyInclusion(h, credential.proof)) return { status: "invalid", reason: "not_included" };

  // And the leaf must be the commitment to THIS claim under THIS salt. Skip
  // it and the credential proves that some claim was issued, not this one.
  const expected = hashLeaf(h, commitClaim(h, credential.claim, credential.salt));
  if (expected !== credential.proof.leaf) return { status: "invalid", reason: "commitment_mismatch" };

  return { status: "valid" };
}

export function createMemoryRegistry(
  keys: Record<string, Uint8Array>,
  revoked: readonly string[] = [],
): IssuerRegistry {
  const revokedSet = new Set(revoked);
  return {
    publicKeyOf: (issuerId) => keys[issuerId],
    isRevoked: (issuerId, root) => revokedSet.has(`${issuerId}:${root}`),
  };
}

export type { SignaturePort } from "./signing.ts";
export type { AttestationFailure, AttestationResult, AttestedCredential, AttestedRoot, IssuerRegistry } from "./types.ts";

export type {
  Acceptance,
  AcceptanceFailure,
  AcceptanceInput,
  AcceptanceResult,
  ClaimOutcome,
  NullifierEntry,
  NullifierLedger,
  NullifierStore,
  PersistentLedgerOptions,
  RevocationOracle,
  RevocationPolicy,
  RevocationState,
} from "./acceptance.ts";
export {
  acceptAnswer,
  createMemoryNullifierLedger,
  createMemoryNullifierStore,
  createPersistentNullifierLedger,
} from "./acceptance.ts";

export type {
  AttestResultsRequest,
  AttestedAnswer,
  AttestedResults,
  ResultsCheck,
  ResultsFailure,
  ResultsVerification,
} from "./results.ts";
export { attestResults, containsHeldSecrets, resultsBytes, verifyResults } from "./results.ts";

export type {
  AcceptOptions,
  PresentationFailure,
  PresentationResult,
  SignedRequest,
  SpentNullifiers,
} from "./presentation.ts";
export {
  acceptPresentation,
  createMemorySpentSet,
  signRequest,
  verifyRequest,
} from "./presentation.ts";
export type { Claim, Salt };

export type {
  RegistryDocument,
  RegistryFailure,
  RegistryIssuer,
  RegistryPort,
  RegistryResolution,
  RegistrySnapshot,
  RevokedRoot,
  SignedRegistryDocument,
} from "./registry.ts";
export { parseRegistryDocument, registryBytes, registryDigest, signRegistry, snapshotOf } from "./registry.ts";

export type { WebRegistryOptions } from "./adapters/web-registry.ts";
export { createWebRegistry } from "./adapters/web-registry.ts";
export type {
  AnchoredRegistryDigest,
  ChainRegistryOptions,
  ChainRegistryReader,
} from "./adapters/chain-registry.ts";
export { createChainRegistry } from "./adapters/chain-registry.ts";

export type { StellarRegistryReaderOptions } from "./adapters/stellar-registry-reader.ts";
export { createStellarRegistryReader } from "./adapters/stellar-registry-reader.ts";

export type {
  Delegation,
  DelegationBody,
  DelegationCheck,
  DelegationContext,
  DelegationFailure,
} from "./delegation.ts";
export { checkDelegation, delegationBytes, signDelegation } from "./delegation.ts";
