// memory.ts: A lexical index with no dependencies, no network and no vendor. It is not a
// stand-in for the real thing in the way a stub usually is.

import { createHash } from "node:crypto";
import type { Candidate, PublicRecord, RecordIndexPort, RecordQuery } from "../types.ts";
import { normalizeName, tokenOverlap } from "../normalize.ts";

export function createMemoryIndex(id = "memory"): RecordIndexPort {
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
    async snapshotRoot() {
      const leaves = [...records.values()]
        .map((record) =>
          createHash("sha256")
            .update(record.id)
            .update("\u0000")
            .update(record.source)
            .update("\u0000")
            .update(normalizeName(record.text))
            .digest("hex"),
        )
        .sort();
      const root = createHash("sha256").update("knowni:snapshot:v1");
      for (const leaf of leaves) root.update(leaf);
      return root.digest("hex");
    },
  };
}
