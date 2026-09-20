// index.ts: signing and checking an attested credential, offline.
// The issuer signs a root once; the check is signature, Merkle inclusion and
// commitment opening, with no network and no chain.

import type { Claim, FieldHash, Salt } from "@knowni/core";
import { commitClaim, hashLeaf, u64be, utf8, verifyInclusion } from "@knowni/core";
import { createPrivateKey, createPublicKey, randomBytes, sign, verify } from "node:crypto";
import type {
  AttestationResult,
  AttestedCredential,
  AttestedRoot,
  IssuerRegistry,
} from "./types.ts";

const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

const ROOT_DOMAIN = "knowni/issuer-root/v1";

export function signedBytes(root: Omit<AttestedRoot, "signature" | "algorithm">): Buffer {
  const parts = [
    utf8(ROOT_DOMAIN),
    utf8(root.issuerId),
    utf8(root.root),
    u64be(root.issuedAt),
    u64be(root.size),
  ];
  return Buffer.concat(parts.map((part) => Buffer.concat([Buffer.from(u64be(part.length)), Buffer.from(part)])));
}

export interface IssuerKeypair {
  readonly privateKeySeed: Uint8Array;
  readonly publicKey: Uint8Array;
}

export function generateIssuerKeypair(): IssuerKeypair {
  const seed = Uint8Array.from(randomBytes(32));
  return { privateKeySeed: seed, publicKey: publicKeyFromSeed(seed) };
}

export function publicKeyFromSeed(seed: Uint8Array): Uint8Array {
  const spki = createPublicKey(privateKeyOf(seed)).export({ format: "der", type: "spki" });
  return Uint8Array.from(spki.subarray(spki.length - 32));
}

function privateKeyOf(seed: Uint8Array) {
  if (seed.length !== 32) throw new TypeError("an ed25519 seed is 32 bytes");
  return createPrivateKey({
    key: Buffer.concat([PKCS8_PREFIX, Buffer.from(seed)]),
    format: "der",
    type: "pkcs8",
  });
}

export function attestRoot(
  seed: Uint8Array,
  root: Omit<AttestedRoot, "signature" | "algorithm">,
): AttestedRoot {
  const signature = sign(null, signedBytes(root), privateKeyOf(seed));
  return { ...root, algorithm: "ed25519", signature: signature.toString("hex") };
}

export function verifyAttestedRoot(registry: IssuerRegistry, attestation: AttestedRoot): AttestationResult {
  const publicKey = registry.publicKeyOf(attestation.issuerId);
  if (publicKey === undefined) return { status: "invalid", reason: "unknown_issuer" };
  if (registry.isRevoked?.(attestation.issuerId, attestation.root) === true) {
    return { status: "invalid", reason: "revoked" };
  }

  let signature: Buffer;
  try {
    signature = Buffer.from(attestation.signature, "hex");
  } catch {
    return { status: "invalid", reason: "bad_signature" };
  }

  const key = createPublicKey({
    key: Buffer.concat([SPKI_PREFIX, Buffer.from(publicKey)]),
    format: "der",
    type: "spki",
  });
  const ok = verify(null, signedBytes(attestation), key, signature);
  return ok ? { status: "valid" } : { status: "invalid", reason: "bad_signature" };
}

export interface CredentialCheck {
  readonly registry: IssuerRegistry;
  readonly nowUnix: number;
  readonly maxRootAgeSeconds: number;
}

// The whole offline check, in the order that fails cheapest first.
export function verifyCredential(
  h: FieldHash,
  credential: AttestedCredential,
  check: CredentialCheck,
): AttestationResult {
  const rootResult = verifyAttestedRoot(check.registry, credential.attestation);
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

export type { AttestationFailure, AttestationResult, AttestedCredential, AttestedRoot, IssuerRegistry } from "./types.ts";

export type {
  Acceptance,
  AcceptanceFailure,
  AcceptanceInput,
  AcceptanceResult,
  ClaimOutcome,
  NullifierLedger,
  RevocationOracle,
  RevocationPolicy,
  RevocationState,
} from "./acceptance.ts";
export { acceptAnswer, createMemoryNullifierLedger } from "./acceptance.ts";

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
