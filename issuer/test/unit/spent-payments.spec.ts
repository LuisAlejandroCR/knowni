// spent-payments.spec.ts: a redeemed transaction stays redeemed across a restart.
// The port is checked with a fake store, and then the file adapter is exercised
// against the real filesystem — it crosses a process boundary, so it is not
// allowed to be only a stub. See payments.spec.ts for the Horizon side.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createPersistentSpentPayments,
  verifyPayment,
  type SpentPaymentStore,
} from "../../src/payments.ts";
import { createFileSpentPaymentStore } from "../../src/spent-store.ts";

const TX = "0dc0fdf46ebffc72257b068fe0022a6b732c6f4b9dda5503aaa8b005f18f8161";
const OTHER_TX = "f".repeat(64);

function sharedStore(): { store: SpentPaymentStore; written: string[] } {
  const written: string[] = [];
  const store: SpentPaymentStore = {
    async load() {
      return [...written];
    },
    async append(txHash) {
      written.push(txHash);
    },
  };
  return { store, written };
}

test("a transaction redeemed before the restart cannot pay again after it", async () => {
  const { store } = sharedStore();

  const before = await createPersistentSpentPayments(store);
  assert.equal(before.claim(TX), true);

  // The process ends here. Only the store survives it.
  const after = await createPersistentSpentPayments(store);
  assert.equal(after.claim(TX), false);
});

test("a transaction nobody redeemed still pays after a restart", async () => {
  const { store } = sharedStore();
  const before = await createPersistentSpentPayments(store);
  before.claim(TX);

  const after = await createPersistentSpentPayments(store);
  assert.equal(after.claim(OTHER_TX), true);
});

test("a claim is written once; claiming again writes nothing", async () => {
  const { store, written } = sharedStore();
  const spent = await createPersistentSpentPayments(store);

  spent.claim(TX);
  spent.claim(TX);
  await Promise.resolve();

  assert.deepEqual(written, [TX]);
});

test("a write that fails is reported, and the claim still holds in this process", async () => {
  const failures: string[] = [];
  const store: SpentPaymentStore = {
    async load() {
      return [];
    },
    async append() {
      throw new Error("disk full");
    },
  };
  const spent = await createPersistentSpentPayments(store, {
    onWriteError: (_error, txHash) => failures.push(txHash),
  });

  assert.equal(spent.claim(TX), true);
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(failures, [TX]);
  // The double spend is still caught here; what was lost is the next restart.
  assert.equal(spent.claim(TX), false);
});

test("the decision does not wait for the write to land", async () => {
  let release = () => {};
  const store: SpentPaymentStore = {
    async load() {
      return [];
    },
    append: () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  };
  const spent = await createPersistentSpentPayments(store);

  // The write never resolves until this test says so.
  assert.equal(spent.claim(TX), true);
  assert.equal(spent.claim(TX), false);
  release();
});

test("a refused payment is never written, so it stays spendable", async () => {
  const { store, written } = sharedStore();
  const spent = await createPersistentSpentPayments(store);

  const horizon = (async (url: string) => {
    if (String(url).endsWith("/payments")) {
      return new Response(JSON.stringify({ _embedded: { records: [] } }), { status: 200 });
    }
    return new Response(JSON.stringify({ successful: true, memo_type: "text", memo: "hola" }), { status: 200 });
  }) as unknown as typeof fetch;

  const refused = await verifyPayment(
    TX,
    "a".repeat(64),
    { destination: "GTREASURY", minAmountStroops: 1n, fetchImpl: horizon },
    spent,
  );
  assert.equal(refused.status, "refused");
  await Promise.resolve();
  assert.deepEqual(written, []);
});

// --- the real filesystem, because this one crosses a process boundary ---

// Dormir un número fijo de milisegundos esperando una escritura que se lanza y
// no se espera es una carrera: bajo carga no llega. La prueba se queda con la
// promesa del append y la espera.
function recording(store: SpentPaymentStore): { store: SpentPaymentStore; writes: Promise<void>[] } {
  const writes: Promise<void>[] = [];
  return {
    store: {
      load: () => store.load(),
      append: (txHash) => {
        const write = store.append(txHash);
        writes.push(write);
        return write;
      },
    },
    writes,
  };
}

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "knowni-spent-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("on a real disk, a spend written by one process is read by the next", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "spent.log");

    const disk = recording(createFileSpentPaymentStore(path));
    const first = await createPersistentSpentPayments(disk.store);
    assert.equal(first.claim(TX), true);
    await Promise.all(disk.writes);

    const second = await createPersistentSpentPayments(createFileSpentPaymentStore(path));
    assert.equal(second.claim(TX), false);
    assert.equal(second.claim(OTHER_TX), true);
  });
});

test("a file that does not exist yet is an empty set, not a failure", async () => {
  await withTempDir(async (dir) => {
    // Nested on purpose: the first start-up should not need the directory to
    // exist either.
    const path = join(dir, "state", "spent.log");
    const disk = recording(createFileSpentPaymentStore(path));
    const spent = await createPersistentSpentPayments(disk.store);
    assert.equal(spent.claim(TX), true);
    await Promise.all(disk.writes);
    assert.match(await readFile(path, "utf8"), new RegExp(TX));
  });
});

test("blank lines and stray whitespace in the file are not transactions", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "spent.log");
    await writeFile(path, `\n  ${TX}  \n\n`, "utf8");
    const spent = await createPersistentSpentPayments(createFileSpentPaymentStore(path));
    assert.equal(spent.claim(TX), false);
    assert.equal(spent.claim(""), true);
  });
});

test("a file that cannot be read stops start-up instead of reopening every spend", async () => {
  await withTempDir(async (dir) => {
    // A directory where a file is expected: reading it fails with EISDIR, which
    // is not "no spends yet" and must not be treated as one.
    const store = createFileSpentPaymentStore(dir);
    await assert.rejects(() => createPersistentSpentPayments(store));
  });
});
