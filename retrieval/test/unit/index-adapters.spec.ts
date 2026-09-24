// index-adapters.spec.ts: the in-memory index against the resolution policy.
// The Chroma adapter that used to share this corpus is gone — B3 — and what is
// left is the index the list screening actually runs on.

import { test } from "node:test";
import { poseidonHash } from "@knowni/core/node";
import assert from "node:assert/strict";

import { createMemoryIndex } from "../../src/adapters/memory.ts";
import { resolve, screen } from "../../src/resolve.ts";
import type { PublicRecord } from "../../src/types.ts";

const corpus: PublicRecord[] = [
  { id: "sdn-1", source: "ofac-sdn", jurisdiction: "US", text: "CARLOS ALBERTO MENDOZA RUIZ alias EL FLACO" },
  { id: "proc-1", source: "co-procuraduria", jurisdiction: "CO", text: "MARIA FERNANDA RODRIGUEZ LOPEZ" },
  { id: "proc-2", source: "co-procuraduria", jurisdiction: "CO", text: "MARIA FERNANDA RODRIGUEZ GOMEZ" },
];

test("the memory index finds a distinctive name and clears an unrelated one", async () => {
  const index = createMemoryIndex(poseidonHash);
  await index.upsert(corpus);

  assert.equal(screen(resolve(await index.search({ text: "Carlos Mendoza" }))).listed, true);
  assert.equal(screen(resolve(await index.search({ text: "Diego Salazar" }))).listed, false);
});

test("a common name comes back ambiguous rather than matched", async () => {
  const index = createMemoryIndex(poseidonHash);
  await index.upsert(corpus);
  const resolution = resolve(await index.search({ text: "Maria Fernanda Rodriguez" }));
  assert.equal(resolution.status, "ambiguous");
  assert.deepEqual(screen(resolution), { listed: true, needsReview: true });
});

test("a source filter narrows the corpus", async () => {
  const index = createMemoryIndex(poseidonHash);
  await index.upsert(corpus);
  const hits = await index.search({ text: "Carlos Mendoza", sources: ["co-procuraduria"] });
  assert.deepEqual(hits, []);
});

test("upsert replaces a record rather than duplicating it", async () => {
  const index = createMemoryIndex(poseidonHash);
  await index.upsert(corpus);
  await index.upsert([{ ...corpus[0]!, text: "CARLOS MENDOZA (delisted)" }]);
  const hits = await index.search({ text: "Carlos Mendoza" });
  assert.equal(hits.length, 1);
  assert.match(hits[0]!.record.text, /delisted/);
});

test("the snapshot root is independent of ingestion order", async () => {
  // Two operators ingesting the same published list must publish the same
  // root, or a relying party cannot pin one.
  const a = createMemoryIndex(poseidonHash);
  const b = createMemoryIndex(poseidonHash);
  await a.upsert(corpus);
  await b.upsert([...corpus].reverse());
  assert.equal(await a.snapshotRoot(), await b.snapshotRoot());
});

test("the snapshot root changes when the corpus changes", async () => {
  const index = createMemoryIndex(poseidonHash);
  await index.upsert(corpus);
  const before = await index.snapshotRoot();
  await index.upsert([{ id: "sdn-2", source: "ofac-sdn", jurisdiction: "US", text: "NEW ENTRY" }]);
  assert.notEqual(await index.snapshotRoot(), before);
});
