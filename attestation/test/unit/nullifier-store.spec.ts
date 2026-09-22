// nullifier-store.spec.ts: the spent set that outlives the process.
// What matters here is that a restart does not hand back a presentation that
// was already spent, and that a store that fails says so instead of pretending.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createMemoryNullifierStore,
  createPersistentNullifierLedger,
  type NullifierEntry,
  type NullifierStore,
} from "../../src/acceptance.ts";

const NULLIFIER = "ab".repeat(32);
const OTHER = "cd".repeat(32);
const PRESENTATION = "presentation-1";

// Survives a restart because both ledgers read the same entries, which is what
// a device's storage does across launches.
function sharedStore(): { store: NullifierStore; written: NullifierEntry[] } {
  const written: NullifierEntry[] = [];
  const store: NullifierStore = {
    async load() {
      return [...written];
    },
    async append(entry) {
      written.push(entry);
    },
  };
  return { store, written };
}

test("a nullifier spent before the restart is still spent after it", async () => {
  const { store } = sharedStore();

  const before = await createPersistentNullifierLedger(store);
  assert.equal(before.claim(NULLIFIER, PRESENTATION), "claimed");

  // The process ends here; nothing of the first ledger survives but the store.
  const after = await createPersistentNullifierLedger(store);
  assert.equal(after.claim(NULLIFIER, "presentation-2"), "replayed");
});

test("the same presentation after a restart is idempotent, not a replay", async () => {
  const { store } = sharedStore();

  const before = await createPersistentNullifierLedger(store);
  assert.equal(before.claim(NULLIFIER, PRESENTATION), "claimed");

  const after = await createPersistentNullifierLedger(store);
  assert.equal(after.claim(NULLIFIER, PRESENTATION), "idempotent");
});

test("a fresh claim is written once, and a repeat writes nothing", async () => {
  const { store, written } = sharedStore();
  const ledger = await createPersistentNullifierLedger(store);

  ledger.claim(NULLIFIER, PRESENTATION);
  ledger.claim(NULLIFIER, PRESENTATION);
  ledger.claim(NULLIFIER, "presentation-2");
  await Promise.resolve();

  assert.deepEqual(written, [{ nullifier: NULLIFIER, presentationId: PRESENTATION }]);
});

test("two different nullifiers do not shadow each other", async () => {
  const ledger = await createPersistentNullifierLedger(createMemoryNullifierStore());
  assert.equal(ledger.claim(NULLIFIER, PRESENTATION), "claimed");
  assert.equal(ledger.claim(OTHER, PRESENTATION), "claimed");
  assert.equal(ledger.claim(NULLIFIER, PRESENTATION), "idempotent");
});

test("a store that already holds the nullifier twice keeps the first owner", async () => {
  const store = createMemoryNullifierStore([
    { nullifier: NULLIFIER, presentationId: PRESENTATION },
    { nullifier: NULLIFIER, presentationId: "presentation-2" },
  ]);
  const ledger = await createPersistentNullifierLedger(store);
  assert.equal(ledger.claim(NULLIFIER, PRESENTATION), "idempotent");
  assert.equal(ledger.claim(NULLIFIER, "presentation-2"), "replayed");
});

test("a write that fails is reported, and the claim still holds in this process", async () => {
  const failures: NullifierEntry[] = [];
  const store: NullifierStore = {
    async load() {
      return [];
    },
    async append() {
      throw new Error("disk full");
    },
  };
  const ledger = await createPersistentNullifierLedger(store, {
    onWriteError: (_error, entry) => failures.push(entry),
  });

  assert.equal(ledger.claim(NULLIFIER, PRESENTATION), "claimed");
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(failures, [{ nullifier: NULLIFIER, presentationId: PRESENTATION }]);
  // The window this ledger closes is within the process: the replay is still
  // caught here, even though the restart will have lost it.
  assert.equal(ledger.claim(NULLIFIER, "presentation-2"), "replayed");
});

test("a claim decided before its write lands is not delayed by the store", async () => {
  let release = () => {};
  const store: NullifierStore = {
    async load() {
      return [];
    },
    append: () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  };
  const ledger = await createPersistentNullifierLedger(store);

  // The write never resolves until the test says so; the decision must not wait.
  assert.equal(ledger.claim(NULLIFIER, PRESENTATION), "claimed");
  assert.equal(ledger.claim(NULLIFIER, "presentation-2"), "replayed");
  release();
});
