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
  // Waits for the writes the answers launched. Optional: a cache that lives in
  // memory has nothing to settle. Unlike `SpentPayments.settled` in D-38 this
  // never rejects — a lost write costs a repeated call, not a wrong answer.
  settled?(): Promise<void>;
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

// Where the answered questions outlive the process. A port, not a dependency:
// this module never learns what a file or a database is. Same shape as
// `SpentPaymentStore` in `payments.ts` — same hole, same answer. See D-39.
export interface StoredCacheEntry<T> {
  readonly key: string;
  readonly expiresAt: number;
  readonly value: T;
}

export interface IssuanceCacheStore<T> {
  load(): Promise<readonly StoredCacheEntry<T>[]>;
  append(entry: StoredCacheEntry<T>): Promise<void>;
  // Rewrites the whole set. Used only to drop what already expired, which is
  // retention the service has no reason to keep.
  replace(entries: readonly StoredCacheEntry<T>[]): Promise<void>;
}

export interface PersistentCacheOptions {
  readonly maxEntries?: number;
  // A write that never lands costs a repeated provider call after a restart.
  // That is money, not a wrong answer, so it is reported and never thrown.
  readonly onWriteError?: (error: unknown, key: string) => void;
}

// Hydrated once at start-up, then answered from memory. Single-flight stays in
// this process — two replicas cannot await each other's in-flight work — but a
// question already answered and signed is served from disk instead of paying
// Croma for it again.
export async function createPersistentIssuanceCache<T>(
  store: IssuanceCacheStore<T>,
  options: PersistentCacheOptions = {},
): Promise<IssuanceCache<T>> {
  const maxEntries = options.maxEntries ?? DEFAULT_CACHE_MAX_ENTRIES;
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) throw new TypeError("maxEntries must be a positive integer");
  const onWriteError = options.onWriteError ?? (() => {});

  const loaded = await store.load();
  // Later wins: the store is append-only, so the last line for a key is the
  // current one.
  const durable = new Map<string, StoredCacheEntry<T>>();
  for (const entry of loaded) durable.set(entry.key, entry);

  const nowAtStart = Math.floor(Date.now() / 1000);
  const live = [...durable.values()]
    .filter((entry) => entry.expiresAt > nowAtStart)
    .sort((left, right) => left.expiresAt - right.expiresAt)
    .slice(-maxEntries);
  if (live.length !== loaded.length) {
    // An answer nobody can use any more is retention with no purpose.
    durable.clear();
    for (const entry of live) durable.set(entry.key, entry);
    await store.replace(live);
  }

  const inner = createMemoryIssuanceCache<T>(maxEntries);
  let inFlight: Promise<void>[] = [];

  const forget = (key: string) => {
    durable.delete(key);
  };

  return {
    async resolve(key, nowUnix, create) {
      const stored = durable.get(key);
      if (stored !== undefined) {
        if (stored.expiresAt > nowUnix) return { value: stored.value, cached: true };
        forget(key);
      }
      return inner.resolve(key, nowUnix, async () => {
        const created = await create();
        if (created.expiresAt > nowUnix) {
          const entry: StoredCacheEntry<T> = { key, expiresAt: created.expiresAt, value: created.value };
          durable.set(key, entry);
          // Trailing, like the spend write of D-37: a buyer waits for an
          // answer, not for our bookkeeping.
          inFlight.push(
            store.append(entry).catch((error: unknown) => {
              durable.delete(key);
              onWriteError(error, key);
            }),
          );
        }
        return created;
      });
    },
    async settled() {
      const pending = inFlight;
      inFlight = [];
      await Promise.all(pending);
    },
  };
}
