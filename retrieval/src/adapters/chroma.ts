// chroma.ts: Chroma behind the port, written against the smallest slice of its API this system
// uses rather than against the chromadb package. The point of the indirection is not to avoid
// a dependency for its own sake.

import type { Candidate, PublicRecord, RecordIndexPort, RecordQuery } from "../types.ts";

// The slice of a Chroma collection this adapter calls. `chromadb`'s own
// Collection satisfies it structurally.
export interface ChromaCollection {
  add(args: {
    ids: string[];
    documents: string[];
    metadatas: Record<string, string>[];
  }): Promise<unknown>;
  query(args: {
    queryTexts: string[];
    nResults: number;
    where?: Record<string, unknown>;
  }): Promise<{
    ids: string[][];
    documents: (string | null)[][];
    metadatas: (Record<string, unknown> | null)[][];
    distances?: (number | null)[][];
  }>;
}

export type ChromaSpace = "cosine" | "l2" | "ip";

export interface ChromaIndexOptions {
  readonly id?: string;
  readonly space: ChromaSpace;
  // The snapshot this collection was built from. Chroma does not know it;
  // whoever ingested the source does, and it must travel with the claim.
  readonly snapshotRoot: string;
}

export function createChromaIndex(
  collection: ChromaCollection,
  options: ChromaIndexOptions,
): RecordIndexPort {
  const id = options.id ?? "chroma";

  return {
    id,
    async upsert(records) {
      if (records.length === 0) return;
      await collection.add({
        ids: records.map((r) => r.id),
        documents: records.map((r) => r.text),
        metadatas: records.map((r) => ({
          source: r.source,
          jurisdiction: r.jurisdiction,
          ...(r.fields ?? {}),
        })),
      });
    },

    async search(query: RecordQuery) {
      const response = await collection.query({
        queryTexts: [query.text],
        nResults: query.limit ?? 10,
        ...(query.sources ? { where: { source: { $in: [...query.sources] } } } : {}),
      });

      const ids = response.ids?.[0] ?? [];
      const documents = response.documents?.[0] ?? [];
      const metadatas = response.metadatas?.[0] ?? [];
      const distances = response.distances?.[0] ?? [];

      const candidates: Candidate[] = [];
      for (let i = 0; i < ids.length; i += 1) {
        const distance = distances[i];
        if (typeof distance !== "number" || !Number.isFinite(distance)) continue;

        const metadata = metadatas[i] ?? {};
        const record: PublicRecord = {
          id: ids[i]!,
          source: typeof metadata.source === "string" ? metadata.source : "unknown",
          jurisdiction: typeof metadata.jurisdiction === "string" ? metadata.jurisdiction : "",
          text: documents[i] ?? "",
        };
        candidates.push({ record, score: toSimilarity(distance, options.space) });
      }
      return candidates;
    },

    async snapshotRoot() {
      return options.snapshotRoot;
    },
  };
}

export function toSimilarity(distance: number, space: ChromaSpace): number {
  switch (space) {
    // Chroma's cosine distance is 1 - cosine_similarity, in [0, 2].
    case "cosine":
      return clamp01(1 - distance / 2);
    case "l2":
      return clamp01(1 / (1 + Math.max(0, distance)));
    // Inner product: Chroma returns 1 - ip, and ip is unbounded, so this can
    // exceed the range in both directions.
    case "ip":
      return clamp01(1 - distance);
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
