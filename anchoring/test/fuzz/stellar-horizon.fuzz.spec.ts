// stellar-horizon.fuzz.spec.ts: the anchor against a Horizon that answers
// something else. Anchoring is the one step the product survives without, so
// its failures must be legible: an error that names Horizon, never a message
// about JavaScript from inside `BigInt`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createHorizonMemoSubmitter } from "../../src/adapters/stellar-horizon.ts";

const SEED = Uint8Array.from(createHash("sha256").update("knowni-fuzz", "utf8").digest());
const COMMITMENT = Uint8Array.from(Buffer.from("ab".repeat(32), "hex"));

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/// None of these is a sequence, and every one of them used to reach `BigInt`.
const NOT_A_SEQUENCE: unknown[] = [
  "abc",
  "",
  "-1",
  "1.5",
  "1e9",
  " 12 ",
  "0x10",
  "١٢٣",
  null,
  12,
  true,
  {},
  [],
  undefined,
];

/// Bodies a proxy in front of Horizon answers with, and Horizon never does.
const NOT_JSON = ["<html>502 Bad Gateway</html>", "", "{", "null", "[]", "42", '"a string"'];

function horizon(account: string, transaction: string, transactionStatus = 200): typeof fetch {
  return (async (url: string | URL) => {
    const path = String(url);
    return path.endsWith("/transactions")
      ? new Response(transaction, { status: transactionStatus })
      : new Response(account, { status: 200 });
  }) as unknown as typeof fetch;
}

async function anchorAgainst(fetchImpl: typeof fetch): Promise<Error | undefined> {
  const submitter = createHorizonMemoSubmitter(SEED, { fetchImpl });
  try {
    await submitter.sendMemoHash(COMMITMENT);
    return undefined;
  } catch (error) {
    assert.ok(error instanceof Error);
    return error;
  }
}

test("a sequence Horizon could not have written is named as such, not as a BigInt", async () => {
  for (const sequence of NOT_A_SEQUENCE) {
    const error = await anchorAgainst(horizon(JSON.stringify({ sequence }), "{}"));
    assert.ok(error !== undefined, `sequence ${JSON.stringify(sequence)} was accepted`);
    assert.match(error.message, /^horizon /, `sequence ${JSON.stringify(sequence)}: ${error.message}`);
  }
});

test("an account body that is not JSON fails as a missing sequence", async () => {
  for (const body of NOT_JSON) {
    const error = await anchorAgainst(horizon(body, "{}"));
    assert.ok(error !== undefined);
    assert.match(error.message, /^horizon /, `${body}: ${error.message}`);
  }
});

// A 502 of HTML from a proxy used to surface as a JSON parse error, which
// sends whoever reads the log to the wrong place entirely.
test("a rejected submission reports the status Horizon answered", async () => {
  for (const body of NOT_JSON) {
    const error = await anchorAgainst(horizon(JSON.stringify({ sequence: "12345" }), body, 502));
    assert.ok(error !== undefined);
    assert.match(error.message, /^horizon rejected the transaction: 502/, `${body}: ${error.message}`);
  }
});

test("no answer at all makes this adapter throw something that is not an Error", async () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const next = rng(seed);
    const account = next() < 0.5 ? JSON.stringify({ sequence: "12345" }) : NOT_JSON[Math.floor(next() * NOT_JSON.length)]!;
    const submission = NOT_JSON[Math.floor(next() * NOT_JSON.length)]!;
    const status = next() < 0.5 ? 200 : 400 + Math.floor(next() * 200);

    const error = await anchorAgainst(horizon(account, submission, status));
    if (error !== undefined) assert.match(error.message, /^horizon /, `seed ${seed}: ${error.message}`);
  }
});

test("the answer Horizon actually sends still anchors", async () => {
  const submitter = createHorizonMemoSubmitter(SEED, {
    fetchImpl: horizon(JSON.stringify({ sequence: "12345" }), JSON.stringify({ hash: "ff".repeat(32) })),
  });
  assert.deepEqual(await submitter.sendMemoHash(COMMITMENT), { hash: "ff".repeat(32) });
});
