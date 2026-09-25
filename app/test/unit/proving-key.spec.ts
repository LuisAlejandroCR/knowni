// proving-key.spec.ts: the key is fetched once, a build without a source says
// so, a failed download leaves nothing behind, and a key that fails its digest
// is thrown away and fetched again exactly once.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureProvingKey, proveWithDeviceKey, ZKEY_SHA256, type KeyFiles } from "../../src/domain/proving-key.ts";
import type { ProveOutcome, ProverPort } from "../../src/domain/prover.ts";

function memoryFiles(present = false, failDownload = false) {
  const log: string[] = [];
  let exists = present;
  const files: KeyFiles = {
    path: "/data/eligibility.zkey",
    exists: () => exists,
    async download(url) {
      log.push(`download ${url}`);
      exists = true;
      if (failDownload) throw new Error("socket closed");
    },
    remove: () => {
      log.push("remove");
      exists = false;
    },
  };
  return { files, log };
}

const answering = (...outcomes: ProveOutcome[]): ProverPort => ({ prove: async () => outcomes.shift()! });
const PROVED: ProveOutcome = { kind: "proved", proof: {} as never, publicSignals: [] };

test("a key already on the device is used as it is, with the pinned digest", async () => {
  const { files, log } = memoryFiles(true);
  assert.deepEqual(await ensureProvingKey(files, "https://k"), {
    kind: "ready",
    key: { path: "/data/eligibility.zkey", sha256: ZKEY_SHA256 },
  });
  assert.deepEqual(log, []);
});

test("without a source the build says so instead of trying", async () => {
  assert.deepEqual(await ensureProvingKey(memoryFiles().files, undefined), { kind: "no_source" });
});

test("a download that fails leaves no partial file behind", async () => {
  const { files, log } = memoryFiles(false, true);
  assert.deepEqual(await ensureProvingKey(files, "https://k"), { kind: "download_failed" });
  assert.equal(files.exists(), false);
  assert.deepEqual(log, ["download https://k", "remove"]);
});

test("a key that fails its digest is replaced once, and the second proof stands", async () => {
  const { files, log } = memoryFiles(true);
  const outcome = await proveWithDeviceKey(answering({ kind: "failed", reason: "zkey_mismatch" }, PROVED), files, {}, "https://k");
  assert.equal(outcome.kind, "proved");
  assert.deepEqual(log, ["remove", "download https://k"]);
});

test("a source that keeps serving the wrong key is a mismatch, not a loop", async () => {
  const mismatch: ProveOutcome = { kind: "failed", reason: "zkey_mismatch" };
  const { files } = memoryFiles(true);
  assert.deepEqual(await proveWithDeviceKey(answering(mismatch, mismatch), files, {}, "https://k"), mismatch);
});

test("the digest is a SHA-256 in lowercase hex", () => {
  assert.match(ZKEY_SHA256, /^[0-9a-f]{64}$/);
});

// The file the web deploy serves is the file the prover will accept. A new
// setup that updates one and not the other fails here, not on a phone.
test("the published key has exactly the pinned digest", async () => {
  const { createHash } = await import("node:crypto");
  const { readFileSync } = await import("node:fs");
  const published = new URL("../../../web/public/keys/eligibility-dev.zkey", import.meta.url);
  assert.equal(createHash("sha256").update(readFileSync(published)).digest("hex"), ZKEY_SHA256);
});
