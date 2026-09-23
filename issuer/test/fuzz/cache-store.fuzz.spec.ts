// cache-store.fuzz.spec.ts: the cache file against a disk that lies.
// The file is append-only and written by a process that can die mid-line, so
// what comes back from it is not controlled by this code. The contract from
// D-39 is that losing the cache costs a repeated call to Croma — never an
// issuer that will not start.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileIssuanceCacheStore } from "../../src/cache-store.ts";
import { createPersistentIssuanceCache } from "../../src/cache.ts";

const FUTURE = Math.floor(Date.now() / 1000) + 3600;

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/// Lines that are valid JSON and are not entries — the damage `JSON.parse`
/// alone cannot see.
const PARSES_BUT_IS_NOT_AN_ENTRY = [
  "null",
  "true",
  "0",
  '"a string"',
  "[]",
  "{}",
  '{"key":null,"expiresAt":1,"value":1}',
  '{"key":"","expiresAt":1,"value":1}',
  '{"key":5,"expiresAt":1,"value":1}',
  '{"key":"a","expiresAt":"9999999999","value":1}',
  '{"key":"a","expiresAt":null,"value":1}',
  '{"key":"a","expiresAt":1.5,"value":1}',
  '{"key":"a","expiresAt":1e999,"value":1}',
  '{"key":"a","value":1}',
  '{"key":"a","expiresAt":1}',
];

/// A real entry carrying a key that means something to JavaScript and nothing
/// to this cache. It is an entry, and it must arrive as one — reduced.
const ENTRY_WITH_A_HOSTILE_EXTRA = '{"__proto__":{"polluted":true},"key":"hostile","expiresAt":9999999999,"value":1}';

/// Lines that are not JSON at all, including the half-written one a crash
/// leaves behind.
const IS_NOT_JSON = ["{", "}", '{"key":"a","expi', "\u0000\u0000\u0000", "[".repeat(300), "NaN", "undefined", "\t \t"];

async function storeWith(contents: string) {
  const directory = await mkdtemp(join(tmpdir(), "knowni-cache-fuzz-"));
  const path = join(directory, "cache.jsonl");
  await writeFile(path, contents, "utf8");
  return createFileIssuanceCacheStore<number>(path);
}

test("a line that is not an entry is skipped, whatever kind of wrong it is", async () => {
  for (const line of [...PARSES_BUT_IS_NOT_AN_ENTRY, ...IS_NOT_JSON]) {
    const store = await storeWith(`${line}\n`);
    const loaded = await store.load();
    assert.deepEqual(loaded, [], `"${line}" came back as an entry`);
  }
});

test("everything that comes back has the shape the port promises", async () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const next = rng(seed);
    const lines: string[] = [];
    let expectedGood = 0;
    for (let i = 0; i < 1 + Math.floor(next() * 8); i += 1) {
      const choice = next();
      if (choice < 0.4) {
        lines.push(JSON.stringify({ key: `k${i}`, expiresAt: FUTURE + i, value: i }));
        expectedGood += 1;
      } else if (choice < 0.7) {
        lines.push(PARSES_BUT_IS_NOT_AN_ENTRY[Math.floor(next() * PARSES_BUT_IS_NOT_AN_ENTRY.length)]!);
      } else {
        lines.push(IS_NOT_JSON[Math.floor(next() * IS_NOT_JSON.length)]!);
      }
    }

    const store = await storeWith(lines.join("\n"));
    const loaded = await store.load();

    assert.equal(loaded.length, expectedGood, `seed ${seed}: ${JSON.stringify(lines)}`);
    for (const entry of loaded) {
      assert.equal(typeof entry.key, "string");
      assert.ok(Number.isSafeInteger(entry.expiresAt));
    }
  }
});

// A corrupted byte in this file used to be fatal: `null` hydrated into
// `entry.key` and the issuer did not start at all. The cache is the one thing
// in this service whose loss is only money.
test("a corrupted cache file never stops the issuer from starting", async () => {
  for (let seed = 1; seed <= 100; seed += 1) {
    const next = rng(seed);
    const lines = Array.from({ length: 1 + Math.floor(next() * 6) }, () =>
      next() < 0.5
        ? PARSES_BUT_IS_NOT_AN_ENTRY[Math.floor(next() * PARSES_BUT_IS_NOT_AN_ENTRY.length)]!
        : IS_NOT_JSON[Math.floor(next() * IS_NOT_JSON.length)]!,
    );
    lines.splice(Math.floor(next() * lines.length), 0, JSON.stringify({ key: "live", expiresAt: FUTURE, value: 7 }));

    const store = await storeWith(lines.join("\n"));
    const cache = await createPersistentIssuanceCache<number>(store);

    // The one good entry survives the company it was keeping.
    const resolved = await cache.resolve("live", Math.floor(Date.now() / 1000), () => {
      throw new Error(`seed ${seed}: the live entry was lost and the source was called again`);
    });
    assert.equal(resolved.value, 7);
  }
});

test("an entry carrying `__proto__` arrives reduced, and pollutes nothing", async () => {
  const store = await storeWith(`${ENTRY_WITH_A_HOSTILE_EXTRA}\n`);
  const loaded = await store.load();

  assert.equal(loaded.length, 1);
  assert.deepEqual(Object.keys(loaded[0]!).sort(), ["expiresAt", "key", "value"]);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test("a key nobody wrote is not in the cache, however the file spells it", async () => {
  const store = await storeWith(PARSES_BUT_IS_NOT_AN_ENTRY.join("\n"));
  const cache = await createPersistentIssuanceCache<number>(store);
  const resolved = await cache.resolve("__proto__", Math.floor(Date.now() / 1000), () =>
    Promise.resolve({ value: 1, expiresAt: FUTURE }),
  );
  assert.equal(resolved.value, 1);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});
