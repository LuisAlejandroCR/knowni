// cache-store.ts: the answered questions, on disk and append-only.
// One JSON line per entry, so recording an answer is a single append and never
// a read-modify-write two issuances in flight could lose. Distinct from
// spent-store.ts, which holds redeemed transactions. See docs/memoria.md D-39.

import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { IssuanceCacheStore, StoredCacheEntry } from "./cache.ts";

function asEntry<T>(value: unknown): StoredCacheEntry<T> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.key !== "string" || record.key === "") return undefined;
  if (typeof record.expiresAt !== "number" || !Number.isSafeInteger(record.expiresAt)) return undefined;
  if (!("value" in record)) return undefined;
  return { key: record.key, expiresAt: record.expiresAt, value: record.value as T };
}

export function createFileIssuanceCacheStore<T>(path: string): IssuanceCacheStore<T> {
  const write = async (contents: string) => {
    await mkdir(dirname(path), { recursive: true });
    // Rewritten through a temporary file: a crash mid-write must not leave the
    // cache half a file. Losing it entirely is only a repeated provider call.
    const temporary = `${path}.tmp`;
    await writeFile(temporary, contents, "utf8");
    await rename(temporary, path);
  };

  return {
    async load() {
      let contents: string;
      try {
        contents = await readFile(path, "utf8");
      } catch (error) {
        // A file that does not exist yet is an empty cache, which is what the
        // first ever start-up has.
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
      }
      const entries: StoredCacheEntry<T>[] = [];
      for (const line of contents.split("\n")) {
        const trimmed = line.trim();
        if (trimmed === "") continue;
        // A truncated last line is the crash we expect from an append-only
        // file. It costs one repeated answer, so it is skipped, not fatal.
        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          continue;
        }
        // A line that parses into something that is not an entry is the same
        // damage as one that does not parse at all, and costs the same: one
        // repeated answer. Handing it up unchecked is what turned a single
        // corrupted byte into an issuer that would not start.
        const entry = asEntry<T>(parsed);
        if (entry !== undefined) entries.push(entry);
      }
      return entries;
    },
    async append(entry) {
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, `${JSON.stringify(entry)}\n`, "utf8");
    },
    async replace(entries) {
      await write(entries.map((entry) => `${JSON.stringify(entry)}\n`).join(""));
    },
  };
}
