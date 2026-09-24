// web-registry.ts: the registry as a signed document served over HTTPS.
// TLS says who answered; it does not say what they answered, so the authority's
// ed25519 signature is what is trusted here and the transport is not. Keeping
// the last good snapshot is what lets a verification survive the registry being
// down — criterio A11.

import type { SignaturePort } from "../signing.ts";
import type { RegistryPort, RegistryResolution, RegistrySnapshot, SignedRegistryDocument } from "../registry.ts";
import { parseRegistryDocument, registryBytes, snapshotOf } from "../registry.ts";
import { fromHex } from "@knowni/core";

export interface WebRegistryOptions {
  readonly url: string;
  // The registry authority's public key, configured out of band. A registry
  // that ships its own key is a registry that anyone who answers can be.
  readonly authorityKey: Uint8Array;
  readonly signatures: SignaturePort;
  readonly fetchImpl?: typeof fetch;
}

export function verifyAuthority(
  signatures: SignaturePort,
  authorityKey: Uint8Array,
  signed: SignedRegistryDocument,
): boolean {
  return signatures.verify(authorityKey, registryBytes(signed.document), fromHex(signed.signature));
}

export function createWebRegistry(options: WebRegistryOptions): RegistryPort {
  const fetchImpl = options.fetchImpl ?? fetch;
  let cached: RegistrySnapshot | undefined;

  return {
    id: "web",
    async resolve(nowUnix): Promise<RegistryResolution> {
      let body: unknown;
      try {
        const response = await fetchImpl(options.url);
        if (!response.ok) return fallback(cached, "unavailable");
        body = await response.json();
      } catch {
        return fallback(cached, "unavailable");
      }

      const signed = parseRegistryDocument(body);
      if (signed === undefined) return { status: "unavailable", reason: "invalid_document" };
      if (!verifyAuthority(options.signatures, options.authorityKey, signed)) {
        return { status: "unavailable", reason: "bad_signature" };
      }
      if (nowUnix >= signed.document.expiresAt) return { status: "unavailable", reason: "expired" };

      cached = snapshotOf(signed, nowUnix, "authority_signature");
      return { status: "resolved", snapshot: cached };
    },
  };
}

// A cached snapshot is offered while it has not expired, and it says so: the
// acceptance policy decides whether material this old still counts, and a
// forged answer never becomes one of these because it never verified.
function fallback(cached: RegistrySnapshot | undefined, reason: "unavailable"): RegistryResolution {
  if (cached === undefined) return { status: "unavailable", reason };
  return { status: "resolved", snapshot: { ...cached, fromCache: true } };
}
