// retrieval/test/index-adapters.test.ts
// Both adapters against the same corpus and the same questions, because the
// port's whole claim is that the resolution policy means the same thing
// whichever index is underneath.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createMemoryIndex } from "../src/adapters/memory.ts";
import { createChromaIndex, toSimilarity, type ChromaCollection } from "../src/adapters/chroma.ts";
import { resolve, screen } from "../src/resolve.ts";
import type { PublicRecord } from "../src/types.ts";

const corpus: PublicRecord[] = [
  { id: "sdn-1", source: "ofac-sdn", jurisdiction: "US", text: "CARLOS ALBERTO MENDOZA RUIZ alias EL FLACO" },
  { id: "proc-1", source: "co-procuraduria", jurisdiction: "CO", text: "MARIA FERNANDA RODRIGUEZ LOPEZ" },
  { id: "proc-2", source: "co-procuraduria", jurisdiction: "CO", text: "MARIA FERNANDA RODRIGUEZ GOMEZ" },
];

test("the memory index finds a distinctive name and clears an unrelated one", async () => {
  const index = createMemoryIndex();
  await index.upsert(corpus);

  assert.equal(screen(resolve(await index.search({ text: "Carlos Mendoza" }))).listed, true);
  assert.equal(screen(resolve(await index.search({ text: "Diego Salazar" }))).listed, false);
});

test("a common name comes back ambiguous rather than matched", async () => {
  const index = createMemoryIndex();
  await index.upsert(corpus);
  const resolution = resolve(await index.search({ text: "Maria Fernanda Rodriguez" }));
  assert.equal(resolution.status, "ambiguous");
  assert.deepEqual(screen(resolution), { listed: true, needsReview: true });
});

test("a source filter narrows the corpus", async () => {
  const index = createMemoryIndex();
  await index.upsert(corpus);
  const hits = await index.search({ text: "Carlos Mendoza", sources: ["co-procuraduria"] });
  assert.deepEqual(hits, []);
});

test("upsert replaces a record rather than duplicating it", async () => {
  const index = createMemoryIndex();
  await index.upsert(corpus);
  await index.upsert([{ ...corpus[0]!, text: "CARLOS MENDOZA (delisted)" }]);
  const hits = await index.search({ text: "Carlos Mendoza" });
  assert.equal(hits.length, 1);
  assert.match(hits[0]!.record.text, /delisted/);
});

test("the snapshot root is independent of ingestion order", async () => {
  // Two operators ingesting the same published list must publish the same
  // root, or a relying party cannot pin one.
  const a = createMemoryIndex();
  const b = createMemoryIndex();
  await a.upsert(corpus);
  await b.upsert([...corpus].reverse());
  assert.equal(await a.snapshotRoot(), await b.snapshotRoot());
});

test("the snapshot root changes when the corpus changes", async () => {
  const index = createMemoryIndex();
  await index.upsert(corpus);
  const before = await index.snapshotRoot();
  await index.upsert([{ id: "sdn-2", source: "ofac-sdn", jurisdiction: "US", text: "NEW ENTRY" }]);
  assert.notEqual(await index.snapshotRoot(), before);
});

// A Chroma collection reduced to what the adapter calls.
function fakeCollection(rows: { id: string; text: string; distance: number | null }[]): ChromaCollection {
  return {
    async add() {},
    async query() {
      return {
        ids: [rows.map((r) => r.id)],
        documents: [rows.map((r) => r.text)],
        metadatas: [rows.map(() => ({ source: "ofac-sdn", jurisdiction: "US" }))],
        distances: [rows.map((r) => r.distance)],
      };
    },
  };
}

test("the chroma adapter maps distances onto the same 0..1 scale the policy reads", async () => {
  const index = createChromaIndex(
    fakeCollection([
      { id: "sdn-1", text: "CARLOS MENDOZA", distance: 0.1 }, // cosine → 0.95
      { id: "sdn-9", text: "OTHER PERSON", distance: 1.6 }, // cosine → 0.20
    ]),
    { space: "cosine", snapshotRoot: "f".repeat(64) },
  );
  const resolution = resolve(await index.search({ text: "Carlos Mendoza" }));
  assert.equal(resolution.status, "matched");
  assert.equal(resolution.status === "matched" && resolution.candidate.record.id, "sdn-1");
});

test("a row with no usable distance is dropped, not scored as a perfect match", async () => {
  const index = createChromaIndex(
    fakeCollection([{ id: "sdn-1", text: "X", distance: null }]),
    { space: "cosine", snapshotRoot: "f".repeat(64) },
  );
  assert.deepEqual(await index.search({ text: "anything" }), []);
});

test("every space maps into 0..1, including values outside its nominal range", () => {
  // Floating point returns -1e-17 for an identical vector, and inner product
  // is unbounded in both directions.
  for (const space of ["cosine", "l2", "ip"] as const) {
    for (const distance of [-1e-17, -5, 0, 0.5, 2, 1e9, Number.NaN, Number.POSITIVE_INFINITY]) {
      const score = toSimilarity(distance, space);
      assert.ok(score >= 0 && score <= 1, `${space}/${distance} produced ${score}`);
    }
  }
  assert.equal(toSimilarity(0, "cosine"), 1);
  assert.equal(toSimilarity(2, "cosine"), 0);
  assert.equal(toSimilarity(0, "l2"), 1);
});
