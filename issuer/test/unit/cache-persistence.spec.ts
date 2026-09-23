// cache-persistence.spec.ts: an answer already signed survives the restart.
// Distinct from cache.spec.ts, which checks single-flight and the bound in a
// single process: here the process ends and only the store survives it. The
// file adapter crosses a process boundary, so it is exercised against the real
// filesystem. See docs/memoria.md D-39.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createPersistentIssuanceCache,
  type IssuanceCacheStore,
  type StoredCacheEntry,
} from "../../src/cache.ts";
import { createFileIssuanceCacheStore } from "../../src/cache-store.ts";

const NOW = Math.floor(Date.now() / 1000);
const KEY = "ab".repeat(32);
const OTHER_KEY = "cd".repeat(32);

function sharedStore(): { store: IssuanceCacheStore<string>; lines: StoredCacheEntry<string>[] } {
  let lines: StoredCacheEntry<string>[] = [];
  const store: IssuanceCacheStore<string> = {
    async load() {
      return [...lines];
    },
    async append(entry) {
      lines.push(entry);
    },
    async replace(entries) {
      lines = [...entries];
    },
  };
  return { store, get lines() { return lines; } };
}

// Counts how many times the expensive work actually ran.
function producer(value: string, expiresAt: number) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    create: async () => {
      calls += 1;
      return { value, expiresAt };
    },
  };
}

test("an answer signed before the restart is served after it without asking the sources", async () => {
  const { store } = sharedStore();
  const first = producer("signed-envelope", NOW + 600);

  const before = await createPersistentIssuanceCache<string>(store);
  await before.resolve(KEY, NOW, first.create);
  await before.settled!();
  assert.equal(first.calls, 1);

  // The process ends here. Only the store survives it.
  const second = producer("should-not-run", NOW + 600);
  const after = await createPersistentIssuanceCache<string>(store);
  const resolution = await after.resolve(KEY, NOW, second.create);

  assert.deepEqual(resolution, { value: "signed-envelope", cached: true });
  assert.equal(second.calls, 0);
});

test("an answer past its expiry is neither served nor kept on disk", async () => {
  const { store } = sharedStore();
  const stale = producer("stale", NOW - 1);

  const before = await createPersistentIssuanceCache<string>(store);
  await before.resolve(KEY, NOW - 600, stale.create);
  await before.settled!();

  const fresh = producer("fresh", NOW + 600);
  const after = await createPersistentIssuanceCache<string>(store);
  const resolution = await after.resolve(KEY, NOW, fresh.create);

  assert.deepEqual(resolution, { value: "fresh", cached: false });
  assert.equal(fresh.calls, 1);
  await after.settled!();
  assert.deepEqual(await store.load(), [{ key: KEY, expiresAt: NOW + 600, value: "fresh" }]);
});

test("a key nobody answered still costs one call after a restart", async () => {
  const { store } = sharedStore();
  const before = await createPersistentIssuanceCache<string>(store);
  await before.resolve(KEY, NOW, producer("one", NOW + 600).create);
  await before.settled!();

  const other = producer("two", NOW + 600);
  const after = await createPersistentIssuanceCache<string>(store);
  assert.deepEqual(await after.resolve(OTHER_KEY, NOW, other.create), { value: "two", cached: false });
  assert.equal(other.calls, 1);
});

test("a write that fails still answers the buyer, and is reported", async () => {
  const failures: string[] = [];
  const store: IssuanceCacheStore<string> = {
    async load() {
      return [];
    },
    async append() {
      throw new Error("disk is gone");
    },
    async replace() {},
  };
  const cache = await createPersistentIssuanceCache<string>(store, {
    onWriteError: (_error, key) => failures.push(key),
  });

  // The answer is what the buyer paid for; the bookkeeping is ours.
  const resolution = await cache.resolve(KEY, NOW, producer("signed", NOW + 600).create);
  assert.deepEqual(resolution, { value: "signed", cached: false });
  await cache.settled!();
  assert.deepEqual(failures, [KEY]);
});

test("the bound survives the restart: the oldest expiries are the ones dropped", async () => {
  const { store } = sharedStore();
  const before = await createPersistentIssuanceCache<string>(store, { maxEntries: 3 });
  await before.resolve("k1", NOW, async () => ({ value: "v1", expiresAt: NOW + 100 }));
  await before.resolve("k2", NOW, async () => ({ value: "v2", expiresAt: NOW + 200 }));
  await before.resolve("k3", NOW, async () => ({ value: "v3", expiresAt: NOW + 300 }));
  await before.settled!();

  const after = await createPersistentIssuanceCache<string>(store, { maxEntries: 2 });
  assert.deepEqual(
    (await store.load()).map((entry) => entry.key),
    ["k2", "k3"],
  );
  const revived = producer("v1-again", NOW + 100);
  assert.equal((await after.resolve("k1", NOW, revived.create)).cached, false);
  assert.equal((await after.resolve("k3", NOW, producer("no", NOW + 300).create)).cached, true);
});

test("the file adapter keeps an answer across a restart, on the real filesystem", async () => {
  const directory = await mkdtemp(join(tmpdir(), "knowni-cache-"));
  const path = join(directory, "nested", "issuance-cache.jsonl");
  try {
    const before = await createPersistentIssuanceCache<string>(createFileIssuanceCacheStore<string>(path));
    await before.resolve(KEY, NOW, async () => ({ value: "signed-on-disk", expiresAt: NOW + 600 }));
    await before.settled!();

    const contents = await readFile(path, "utf8");
    assert.equal(contents.trim().split("\n").length, 1);

    const shouldNotRun = producer("never", NOW + 600);
    const after = await createPersistentIssuanceCache<string>(createFileIssuanceCacheStore<string>(path));
    const resolution = await after.resolve(KEY, NOW, shouldNotRun.create);
    assert.deepEqual(resolution, { value: "signed-on-disk", cached: true });
    assert.equal(shouldNotRun.calls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a half-written last line costs one answer, not the whole cache", async () => {
  const directory = await mkdtemp(join(tmpdir(), "knowni-cache-"));
  const path = join(directory, "issuance-cache.jsonl");
  try {
    const good = JSON.stringify({ key: KEY, expiresAt: NOW + 600, value: "good" });
    await writeFile(path, `${good}\n{"key":"trunc`, "utf8");

    const cache = await createPersistentIssuanceCache<string>(createFileIssuanceCacheStore<string>(path));
    assert.deepEqual(await cache.resolve(KEY, NOW, producer("no", NOW + 600).create), {
      value: "good",
      cached: true,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
