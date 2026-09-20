// retrieval/src/adapters/chroma.ts
// Chroma behind the port, written against the smallest slice of its API
// this system uses rather than against the chromadb package.
//
// The point of the indirection is not to avoid a dependency for its own
// sake. It is that the choice between Chroma, Qdrant, pgvector and Weaviate
// is an operational one a deployment makes — a bank will insist on the
// database it already runs — and it must not be a change to the screening
// logic. Everything above this file sees RecordIndexPort.
//
// The one substantive adaptation is the score mapping. Chroma returns
// DISTANCES, and what that distance means depends on the collection's
// configured space (l2, cosine, ip). The resolution policy in resolve.ts is
// written against a 0..1 similarity, so the conversion belongs here, named
// and tested, instead of being a `1 - distance` somewhere in a call site.

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

// Which distance the collection was created with. Getting this wrong does
// not fail loudly — it silently reorders candidates — so it is required
// rather than defaulted.
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
        // A missing distance is not a perfect match. Dropping the row is the
        // safe direction here: including it at score 1 would make it win the
        // resolution outright.
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

// Distance to a 0..1 similarity, per space. Clamped at both ends: floating
// point makes an identical vector come back as -1e-17, and a score outside
// 0..1 would walk straight past the resolution policy's floor check.
export function toSimilarity(distance: number, space: ChromaSpace): number {
  switch (space) {
    // Chroma's cosine distance is 1 - cosine_similarity, in [0, 2].
    case "cosine":
      return clamp01(1 - distance / 2);
    // Squared L2, unbounded above. 1/(1+d) is monotone decreasing and lands
    // in (0, 1]; it is a ranking, not a calibrated probability, which is why
    // the floor in SCREENING_POLICY must be tuned per corpus.
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
