// registry.ts: where a counterparty gets the public material it verifies with —
// issuer keys and revoked roots — without asking the issuer, and without asking
// a chain to be the authority over it.
//
// One document, two trust roots. A web registry is trusted because an authority
// signed it; a chain registry is trusted because the digest of that same
// document was anchored. Both reduce to the `IssuerRegistry` and
// `RevocationOracle` that `acceptAnswer` already takes, so a presentation is
// verified by identical code either way — criterio A3.

import type { FieldHash } from "@knowni/core";
import { fromHex, lengthPrefixed, toHex, u64be, utf8 } from "@knowni/core";
import type { SignaturePort } from "./signing.ts";
import type { IssuerRegistry } from "./types.ts";
import type { RevocationOracle, RevocationState } from "./acceptance.ts";

const REGISTRY_DOMAIN = "knowni/registry-document/v1";
const REGISTRY_DIGEST_DOMAIN = "knowni/registry-digest/v1";

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const HEX_64 = /^[0-9a-f]{64}$/;

export interface RegistryIssuer {
  readonly issuerId: string;
  readonly publicKey: string; // hex
}

// A revoked root names the issuer that published it: two issuers may publish
// the same root bytes and only one of them revoked it.
export interface RevokedRoot {
  readonly issuerId: string;
  readonly root: string; // hex
}

export interface RegistryDocument {
  readonly registryId: string;
  readonly issuedAt: number; // unix seconds
  readonly expiresAt: number; // unix seconds
  readonly issuers: readonly RegistryIssuer[];
  readonly revoked: readonly RevokedRoot[];
}

export interface SignedRegistryDocument {
  readonly document: RegistryDocument;
  readonly algorithm: "ed25519";
  readonly signature: string; // hex
}

export type RegistryFailure =
  | "unavailable" // the source did not answer
  | "invalid_document" // it answered something that is not a registry
  | "bad_signature" // the authority did not sign it
  | "digest_mismatch" // the chain anchored a different document
  | "expired"; // it is a registry, correctly signed, and too old to use

export interface RegistrySnapshot {
  readonly registryId: string;
  readonly registry: IssuerRegistry;
  readonly revocation: RevocationOracle;
  // When this material was learned, not when it was published: a cached
  // document that the network can no longer confirm keeps its original
  // `checkedAt`, so the acceptance policy can call it stale.
  readonly checkedAt: number;
  readonly expiresAt: number;
  // Where the trust came from: an authority signature or a chain anchor.
  readonly trustedVia: "authority_signature" | "chain_anchor";
  // True when the snapshot came from cache because the source was unreachable.
  readonly fromCache: boolean;
}

export type RegistryResolution =
  | { readonly status: "resolved"; readonly snapshot: RegistrySnapshot }
  | { readonly status: "unavailable"; readonly reason: RegistryFailure };

// The port a verifier depends on. Resolving is async because fetching is;
// verifying with the snapshot is not, which is what keeps A11 true.
export interface RegistryPort {
  readonly id: string;
  resolve(nowUnix: number): Promise<RegistryResolution>;
}

export function registryBytes(document: RegistryDocument): Uint8Array {
  const parts: Uint8Array[] = [
    utf8(REGISTRY_DOMAIN),
    utf8(document.registryId),
    u64be(document.issuedAt),
    u64be(document.expiresAt),
    u64be(document.issuers.length),
  ];
  for (const issuer of document.issuers) parts.push(utf8(issuer.issuerId), fromHex(issuer.publicKey));
  parts.push(u64be(document.revoked.length));
  for (const entry of document.revoked) parts.push(utf8(entry.issuerId), fromHex(entry.root));
  return lengthPrefixed(parts);
}

// What a chain anchors: the digest of the bytes the authority signed, never the
// document. A registry is public material, but publishing it on a chain would
// make the chain the place it lives, and that is the dependency A3 refuses.
export function registryDigest(h: FieldHash, signed: SignedRegistryDocument): string {
  return h.hash(REGISTRY_DIGEST_DOMAIN, [registryBytes(signed.document), fromHex(signed.signature)]);
}

export function signRegistry(
  signatures: SignaturePort,
  seed: Uint8Array,
  document: RegistryDocument,
): SignedRegistryDocument {
  return {
    document,
    algorithm: "ed25519",
    signature: toHex(signatures.sign(seed, registryBytes(document))),
  };
}

// Validate and reduce what arrived, exactly as a source adapter does: whatever
// answered may be a proxy, a captive portal or an older version of ourselves.
export function parseRegistryDocument(value: unknown): SignedRegistryDocument | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const signed = value as Record<string, unknown>;
  const document = signed["document"];
  if (signed["algorithm"] !== "ed25519") return undefined;
  if (typeof signed["signature"] !== "string" || !/^[0-9a-f]{128}$/.test(signed["signature"])) return undefined;
  if (typeof document !== "object" || document === null) return undefined;
  const fields = document as Record<string, unknown>;
  const registryId = fields["registryId"];
  const issuedAt = fields["issuedAt"];
  const expiresAt = fields["expiresAt"];
  if (typeof registryId !== "string" || !ID.test(registryId)) return undefined;
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt)) return undefined;
  if ((issuedAt as number) < 0 || (expiresAt as number) < (issuedAt as number)) return undefined;
  if (!Array.isArray(fields["issuers"]) || !Array.isArray(fields["revoked"])) return undefined;

  const issuers: RegistryIssuer[] = [];
  const seen = new Set<string>();
  for (const entry of fields["issuers"]) {
    if (typeof entry !== "object" || entry === null) return undefined;
    const issuer = entry as Record<string, unknown>;
    const issuerId = issuer["issuerId"];
    const publicKey = issuer["publicKey"];
    if (typeof issuerId !== "string" || !ID.test(issuerId)) return undefined;
    if (typeof publicKey !== "string" || !HEX_64.test(publicKey)) return undefined;
    // A registry that names an issuer twice has no single answer for its key.
    if (seen.has(issuerId)) return undefined;
    seen.add(issuerId);
    issuers.push({ issuerId, publicKey });
  }

  const revoked: RevokedRoot[] = [];
  for (const entry of fields["revoked"]) {
    if (typeof entry !== "object" || entry === null) return undefined;
    const item = entry as Record<string, unknown>;
    const issuerId = item["issuerId"];
    const root = item["root"];
    if (typeof issuerId !== "string" || !ID.test(issuerId)) return undefined;
    if (typeof root !== "string" || !HEX_64.test(root)) return undefined;
    revoked.push({ issuerId, root });
  }

  return {
    document: { registryId, issuedAt: issuedAt as number, expiresAt: expiresAt as number, issuers, revoked },
    algorithm: "ed25519",
    signature: signed["signature"],
  };
}

export function snapshotOf(
  signed: SignedRegistryDocument,
  checkedAt: number,
  trustedVia: RegistrySnapshot["trustedVia"],
  fromCache = false,
): RegistrySnapshot {
  const keys = new Map(signed.document.issuers.map((issuer) => [issuer.issuerId, fromHex(issuer.publicKey)]));
  const revoked = new Set(signed.document.revoked.map((entry) => `${entry.issuerId}:${entry.root}`));
  const isRevoked = (issuerId: string, root: string) => revoked.has(`${issuerId}:${root}`);
  const revocation: RevocationOracle = {
    stateOf(issuerId, root): RevocationState {
      // A registry that does not know the issuer cannot speak about its roots.
      if (!keys.has(issuerId)) return { status: "unknown" };
      return isRevoked(issuerId, root)
        ? { status: "revoked", checkedAt }
        : { status: "live", checkedAt };
    },
  };
  return {
    registryId: signed.document.registryId,
    registry: { publicKeyOf: (issuerId) => keys.get(issuerId), isRevoked },
    revocation,
    checkedAt,
    expiresAt: signed.document.expiresAt,
    trustedVia,
    fromCache,
  };
}
