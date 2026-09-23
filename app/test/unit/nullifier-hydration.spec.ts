// nullifier-hydration.spec.ts: the verifier's spent set across a restart.
// The device store itself is not here — it imports a native module — so what
// is checked is the wiring: no acceptance before hydration, and a replay caught
// from entries that were on disk before this process started.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createMemoryNullifierStore, type AttestedAnswer, type NullifierStore } from "@knowni/attestation";
import { deriveNullifier, sessionId } from "@knowni/core";
import { demoRequest, demoResults } from "../../src/domain/demo-issuer.ts";
import { appHash } from "../../src/domain/crypto.ts";

const NOW = 1_760_000_000;

const answers: AttestedAnswer[] = [
  {
    predicate: "personhood",
    value: true,
    source: "registraduria",
    provenance: "observed",
    doesNotEstimate: "No dice quién es.",
  },
  {
    predicate: "capacity",
    value: true,
    source: "sicaac",
    provenance: "observed",
    doesNotEstimate: "No afirma capacidad jurídica universal.",
  },
];

// A fresh module per test: the ledger is module state, and these tests are
// about what it looks like before and after hydration.
async function freshVerifier(): Promise<typeof import("../../src/domain/verifier.ts")> {
  return import(`../../src/domain/verifier.ts?case=${Math.random()}`);
}

function presentation(id: string) {
  const signed = demoRequest(NOW);
  return { signed, results: demoResults(signed.request, answers, NOW), id };
}

test("before hydration the verifier refuses instead of accepting", async () => {
  const verifier = await freshVerifier();
  assert.equal(verifier.ledgerReady(), false);

  const { signed, results, id } = presentation("p1");
  const view = verifier.verifyOnDevice(signed, results, id, "live", "strict", NOW);

  assert.equal(view.accepted, false);
  assert.match(view.headline, /todavía/);
});

test("after hydration the same presentation is accepted", async () => {
  const verifier = await freshVerifier();
  await verifier.hydrateLedger(createMemoryNullifierStore());
  assert.equal(verifier.ledgerReady(), true);

  const { signed, results, id } = presentation("p1");
  assert.equal(verifier.verifyOnDevice(signed, results, id, "live", "strict", NOW).accepted, true);
});

test("a nullifier spent in a previous run is caught as a replay in this one", async () => {
  // What the device would have on disk: the same answer, spent by someone else.
  const signed = demoRequest(NOW);
  const spent = deriveNullifier(appHash, { hex: "5".repeat(64) }, sessionId(appHash, signed.request));
  const store = createMemoryNullifierStore([{ nullifier: spent, presentationId: "run-anterior" }]);

  const verifier = await freshVerifier();
  await verifier.hydrateLedger(store);

  const results = demoResults(signed.request, answers, NOW);
  const view = verifier.verifyOnDevice(signed, results, "run-nuevo", "live", "strict", NOW);
  assert.equal(view.accepted, false);
  // Refused as a replay, not for some other reason that also refuses.
  assert.match(view.explanation, /ya se usó/);
});

test("what this run spends is written to the store, so the next run sees it", async () => {
  const written: { nullifier: string; presentationId: string }[] = [];
  const store: NullifierStore = {
    async load() {
      return [];
    },
    async append(entry) {
      written.push({ ...entry });
    },
  };

  const verifier = await freshVerifier();
  await verifier.hydrateLedger(store);

  const { signed, results, id } = presentation("p1");
  assert.equal(verifier.verifyOnDevice(signed, results, id, "live", "strict", NOW).accepted, true);
  await Promise.resolve();

  assert.equal(written.length, 1);
  assert.equal(written[0]!.presentationId, id);
});
