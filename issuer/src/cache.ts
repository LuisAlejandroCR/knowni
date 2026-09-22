// cache.ts: an in-memory, bounded single-flight cache for signed issuance results.
// Keys are HMACs over every input that changes an answer; raw subject data and
// provider payloads are never retained by this module.

import { createHmac } from "node:crypto";

export interface IssuanceCacheIdentity {
  readonly accessKey: string;
  readonly documentKind: string;
  readonly documentNumber: string;
  readonly plate?: string;
  readonly consented: readonly string[];
  readonly paymentRef: string;
  readonly paymentTx?: string;
}

export function issuanceCacheKey(secret: Uint8Array, identity: IssuanceCacheIdentity): string {
  const hash = createHmac("sha256", secret);
  const fields = [
    identity.accessKey,
    identity.documentKind,
    identity.documentNumber,
    identity.plate ?? "",
    [...new Set(identity.consented)].sort().join(","),
    identity.paymentRef,
    identity.paymentTx ?? "free",
  ];
  for (const field of fields) {
    const bytes = Buffer.from(field, "utf8");
    const length = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length);
    hash.update(length).update(bytes);
  }
  return hash.digest("hex");
}

export interface CacheValue<T> {
  readonly value: T;
  readonly expiresAt: number;
}

export interface CacheResolution<T> {
  readonly value: T;
  readonly cached: boolean;
}

export interface IssuanceCache<T> {
  resolve(key: string, nowUnix: number, create: () => Promise<CacheValue<T>>): Promise<CacheResolution<T>>;
}

export const DEFAULT_CACHE_MAX_ENTRIES = 1_000;

interface Entry<T> {
  readonly promise: Promise<CacheValue<T>>;
  readonly settled: boolean;
}

export function createMemoryIssuanceCache<T>(maxEntries = DEFAULT_CACHE_MAX_ENTRIES): IssuanceCache<T> {
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) throw new TypeError("maxEntries must be a positive integer");
  const entries = new Map<string, Entry<T>>();

  const trimSettledEntries = () => {
    while (entries.size > maxEntries) {
      const oldestSettled = [...entries].find(([, entry]) => entry.settled)?.[0];
      if (oldestSettled === undefined) break;
      entries.delete(oldestSettled);
    }
  };

  return {
    async resolve(key, nowUnix, create) {
      const current = entries.get(key);
      if (current !== undefined) {
        try {
          const cached = await current.promise;
          if (cached.expiresAt > nowUnix) {
            entries.delete(key);
            entries.set(key, current);
            return { value: cached.value, cached: true };
          }
          entries.delete(key);
        } catch (error) {
          if (entries.get(key) === current) entries.delete(key);
          throw error;
        }
      }

      let settled = false;
      const entry: Entry<T> = {
        promise: Promise.resolve().then(create).finally(() => {
          settled = true;
          trimSettledEntries();
        }),
        get settled() { return settled; },
      };
      entries.set(key, entry);
      trimSettledEntries();
      try {
        const created = await entry.promise;
        if (created.expiresAt <= nowUnix) entries.delete(key);
        return { value: created.value, cached: false };
      } catch (error) {
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      }
    },
  };
}
