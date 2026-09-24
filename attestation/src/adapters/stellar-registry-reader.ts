// stellar-registry-reader.ts: reads the anchored registry digest from Stellar.
// The authority pays one stroop to itself carrying the digest as MEMO_HASH, so
// the anchor is a transaction on its own account and needs no contract. What
// this file knows about Stellar is one REST path and one memo field; the trust
// comes from the account, which is configured out of band.
//
// It stays free of node builtins and of a Stellar SDK on purpose: the verifier
// that resolves a registry may be the phone.

import type { AnchoredRegistryDigest, ChainRegistryReader } from "./chain-registry.ts";

export const TESTNET_HORIZON = "https://horizon-testnet.stellar.org";

export interface StellarRegistryReaderOptions {
  // The account whose memos are believed. Anyone can pay this account; only it
  // can send from it, which is what makes the source of the memo meaningful.
  readonly authorityAccountId: string;
  readonly chain?: string;
  readonly horizonUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  // How many recent transactions to look through before giving up. The digest
  // is in the most recent memo the authority sent; a handful covers an
  // authority that also uses the account for something else.
  readonly window?: number;
}

const BASE64_32 = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/;

function hexOfBase64(value: string): string | undefined {
  if (!BASE64_32.test(value)) return undefined;
  try {
    const binary = atob(value);
    if (binary.length !== 32) return undefined;
    let hex = "";
    for (let i = 0; i < binary.length; i += 1) hex += binary.charCodeAt(i).toString(16).padStart(2, "0");
    return hex;
  } catch {
    return undefined;
  }
}

function secondsOf(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : undefined;
}

// Validate and reduce, like any other adapter: what answers on this URL may be
// a captive portal, a proxy serving HTML, or Horizon with a field renamed.
function digestOf(record: unknown): AnchoredRegistryDigest | undefined {
  if (typeof record !== "object" || record === null) return undefined;
  const fields = record as Record<string, unknown>;
  if (fields["memo_type"] !== "hash" || typeof fields["memo"] !== "string") return undefined;
  if (fields["successful"] === false) return undefined;
  const digest = hexOfBase64(fields["memo"]);
  const anchoredAt = secondsOf(fields["created_at"]);
  if (digest === undefined || anchoredAt === undefined) return undefined;
  return { digest, anchoredAt };
}

export function createStellarRegistryReader(options: StellarRegistryReaderOptions): ChainRegistryReader {
  const horizonUrl = (options.horizonUrl ?? TESTNET_HORIZON).replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const window = options.window ?? 10;

  return {
    chain: options.chain ?? "stellar:testnet",
    async current(): Promise<AnchoredRegistryDigest | undefined> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let body: unknown;
      try {
        const response = await fetchImpl(
          `${horizonUrl}/accounts/${options.authorityAccountId}/transactions` +
            `?order=desc&limit=${window}&include_failed=false`,
          { signal: controller.signal },
        );
        // An account with no transactions and an account Horizon cannot serve
        // are both "no digest": the caller falls back to what it cached, and
        // never to an empty registry.
        if (!response.ok) return undefined;
        body = await response.json();
      } catch {
        return undefined;
      } finally {
        clearTimeout(timer);
      }

      if (typeof body !== "object" || body === null) return undefined;
      const embedded = (body as { _embedded?: unknown })._embedded;
      if (typeof embedded !== "object" || embedded === null) return undefined;
      const records = (embedded as { records?: unknown }).records;
      if (!Array.isArray(records)) return undefined;

      // Newest first, which is what `order=desc` asked for: a digest anchored
      // later replaces one anchored earlier, and an older memo never wins.
      for (const record of records) {
        const anchored = digestOf(record);
        if (anchored !== undefined) return anchored;
      }
      return undefined;
    },
  };
}
