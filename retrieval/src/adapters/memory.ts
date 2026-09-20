// retrieval/src/adapters/memory.ts
// A lexical index with no dependencies, no network and no vendor.
//
// It is not a stand-in for the real thing in the way a stub usually is. On
// sanctions screening — short name strings, no surrounding prose — token
// overlap is competitive with embeddings, and it is deterministic, which
// means an auditor can reproduce a screening decision exactly. The vector
// index earns its place on the harder sources (RUES descriptions, notarial
// PDFs), not here.
//
// It is also what every test in this repository runs against, so the
// resolution policy is exercised without a Chroma server.

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

      // Ties broken by record id, so the same corpus and the same query
      // always produce the same ordering. A screening decision that depends
      // on Map iteration order is not reproducible, and an unreproducible
      // decision cannot be appealed.
      scored.sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id));
      return scored.slice(0, limit);
    },
    async snapshotRoot() {
      // Order-independent by construction: each record is hashed, the
      // digests are sorted, and the sorted list is hashed. Two indexes that
      // ingested the same records in different orders publish the same root.
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
