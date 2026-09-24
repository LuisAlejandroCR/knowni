// chain-registry.ts: the same registry document, trusted because a chain
// anchored its digest instead of because an authority signed it.
//
// The chain publishes a digest and a time, never the document: a registry that
// lives on a chain is a registry that stops existing when the chain does. What
// a chain is good at is saying that this exact document was the current one at
// this height, which is the replay window an authority signature leaves open.

import type { FieldHash } from "@knowni/core";
import type { RegistryPort, RegistryResolution, RegistrySnapshot } from "../registry.ts";
import { parseRegistryDocument, registryDigest, snapshotOf } from "../registry.ts";

// What the chain adapter is allowed to know: a digest and when it was anchored.
// Whatever reads it — Horizon, an RPC node, a Soroban contract — is injected,
// so this file never learns what a chain is.
export interface AnchoredRegistryDigest {
  readonly digest: string; // hex
  readonly anchoredAt: number; // unix seconds
}

export interface ChainRegistryReader {
  readonly chain: string;
  current(): Promise<AnchoredRegistryDigest | undefined>;
}

export interface ChainRegistryOptions {
  readonly h: FieldHash;
  readonly reader: ChainRegistryReader;
  // Where the bytes come from. The document is public material and its
  // integrity comes from the anchored digest, so an untrusted mirror is fine.
  readonly documentUrl: string;
  readonly fetchImpl?: typeof fetch;
}

export function createChainRegistry(options: ChainRegistryOptions): RegistryPort {
  const fetchImpl = options.fetchImpl ?? fetch;
  let cached: RegistrySnapshot | undefined;

  return {
    id: `chain:${options.reader.chain}`,
    async resolve(nowUnix): Promise<RegistryResolution> {
      let anchored: AnchoredRegistryDigest | undefined;
      let body: unknown;
      try {
        anchored = await options.reader.current();
        if (anchored === undefined) return fallback(cached);
        const response = await fetchImpl(options.documentUrl);
        if (!response.ok) return fallback(cached);
        body = await response.json();
      } catch {
        return fallback(cached);
      }

      const signed = parseRegistryDocument(body);
      if (signed === undefined) return { status: "unavailable", reason: "invalid_document" };
      // The whole trust of this path, in one comparison.
      if (registryDigest(options.h, signed) !== anchored.digest) {
        return { status: "unavailable", reason: "digest_mismatch" };
      }
      if (nowUnix >= signed.document.expiresAt) return { status: "unavailable", reason: "expired" };

      cached = snapshotOf(signed, nowUnix, "chain_anchor");
      return { status: "resolved", snapshot: cached };
    },
  };
}

function fallback(cached: RegistrySnapshot | undefined): RegistryResolution {
  if (cached === undefined) return { status: "unavailable", reason: "unavailable" };
  return { status: "resolved", snapshot: { ...cached, fromCache: true } };
}
