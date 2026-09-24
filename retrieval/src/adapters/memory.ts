// memory.ts: A lexical index with no dependencies, no network and no vendor. It is not a
// stand-in for the real thing in the way a stub usually is.

import type { FieldHasher } from "@knowni/core";
import type { Candidate, PublicRecord, RecordIndexPort, RecordQuery } from "../types.ts";
import { normalizeName, tokenOverlap } from "../normalize.ts";

/// The snapshot root ends up inside a standing claim, and a claim is committed
/// in a field: a 256-bit digest does not fit one. So the index is handed the
/// field hash rather than reaching for a byte hash of its own.
export function createMemoryIndex(h: FieldHasher, id = "memory"): RecordIndexPort {
  const records = new Map<string, PublicRecord>();

  return {
    id,
    async upsert(incoming) {
      for (const record of incoming) records.set(record.id, record);
    },
    async search(query: RecordQuery) {
      const limit = query.limit ?? 10;
      const sources = query.sources;
      const scored: Candidate[] = [];

      for (const record of records.values()) {
        if (sources && !sources.includes(record.source)) continue;
        const score = tokenOverlap(query.text, record.text);
        if (score > 0) scored.push({ record, score });
      }

      scored.sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id));
      return scored.slice(0, limit);
    },
    snapshotRoot() {
      const leaves = [...records.values()]
        .map((record) => h.element([record.id, record.source, normalizeName(record.text)].join("\u0000")))
        .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
      // Folded rather than hashed in one go: a field hash takes a fixed number
      // of inputs, and a snapshot has as many records as it has.
      let root = h.hashFields("snapshot", [BigInt(leaves.length)]);
      for (const leaf of leaves) root = h.hashFields("snapshot", [root, leaf]);
      return Promise.resolve(h.toHex(root));
    },
  };
}
