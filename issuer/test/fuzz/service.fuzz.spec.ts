// service.fuzz.spec.ts: the HTTP boundary against bodies nobody would send.
// The issuer is the only process holding a provider key and it listens on a
// socket, so what arrives there is arbitrary bytes. The property: every request
// gets a JSON answer with a status this service chose, and none of them reaches
// a source.

import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { nodeSignatures } from "@knowni/attestation/node";
import { createIssuerService, predicatesOf } from "../../src/service.ts";

const ACCESS_KEY = "fuzz-key";
const KNOWN_PREDICATES = new Set(["personhood", "capacity", "sanctions", "assetStanding"]);
const EXPECTED_STATUS = new Set([400, 401, 402, 404, 429, 502, 503]);

/// Deterministic, so a failure is reproducible from the seed printed with it.
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/// Keys that mean something to a JavaScript object and nothing to this API.
const HOSTILE_KEYS = ["__proto__", "constructor", "prototype", "toString", "valueOf", "hasOwnProperty"];

function anyValue(next: () => number, depth = 0): unknown {
  const choice = Math.floor(next() * (depth > 2 ? 8 : 12));
  switch (choice) {
    case 0:
      return null;
    case 1:
      return next() < 0.5;
    case 2:
      return Math.floor((next() - 0.5) * 1e12);
    case 3:
      return next() * 1e-8;
    case 4:
      return "";
    case 5:
      return "\u0000�‮".repeat(1 + Math.floor(next() * 4));
    case 6:
      return HOSTILE_KEYS[Math.floor(next() * HOSTILE_KEYS.length)];
    case 7:
      return "A".repeat(1 + Math.floor(next() * 2048));
    case 8:
      return Array.from({ length: Math.floor(next() * 5) }, () => anyValue(next, depth + 1));
    default: {
      const object: Record<string, unknown> = {};
      for (let i = 0; i < Math.floor(next() * 5); i += 1) {
        const key =
          next() < 0.4
            ? HOSTILE_KEYS[Math.floor(next() * HOSTILE_KEYS.length)]!
            : ["request", "predicates", "consented", "documentNumber", "documentKind", "plate", "paymentTx"][
                Math.floor(next() * 7)
              ]!;
        object[key] = anyValue(next, depth + 1);
      }
      return object;
    }
  }
}

/// Raw bodies: not every one of them is JSON, which is the point.
function anyBody(next: () => number): string {
  const choice = Math.floor(next() * 10);
  if (choice === 0) return "";
  if (choice === 1) return "{";
  if (choice === 2) return "[".repeat(200);
  if (choice === 3) return "null";
  if (choice === 4) return String(Math.floor(next() * 1e9));
  return JSON.stringify(anyValue(next)) ?? "undefined";
}

/// A provider that fails if it is ever reached: no malformed request should
/// buy a call to Croma.
const forbiddenProvider = (async () => {
  throw new Error("a fuzzed request reached a source");
}) as unknown as typeof fetch;

async function withService(run: (url: string) => Promise<void>): Promise<void> {
  const server = createIssuerService({
    apiKey: "provider-key",
    issuerId: "issuer",
    seed: nodeSignatures.randomSeed(),
    access: { keys: new Set([ACCESS_KEY]) },
    fetchImpl: forbiddenProvider,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("server did not bind");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

async function assertRefused(url: string, path: string, body: string, seed: number): Promise<void> {
  const response = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Knowni-Access-Key": ACCESS_KEY },
    body,
  });
  const text = await response.text();
  assert.ok(
    EXPECTED_STATUS.has(response.status),
    `seed ${seed}: ${path} answered ${response.status}, which is not a status this service chose`,
  );
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.doesNotThrow(() => JSON.parse(text), `seed ${seed}: ${path} answered something that is not JSON`);
}

test("no body reaches a source or gets an answer this service did not choose", async () => {
  await withService(async (url) => {
    for (let seed = 1; seed <= 120; seed += 1) {
      const body = anyBody(rng(seed));
      await assertRefused(url, "/quote", body, seed);
      await assertRefused(url, "/issue", body, seed);
    }
  });
});

test("an unknown path is a 404 whatever it carries", async () => {
  await withService(async (url) => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const response = await fetch(`${url}/${anyBody(rng(seed)).slice(0, 40)}`, { method: "POST" });
      await response.text();
      assert.equal(response.status, 404);
    }
  });
});

// A consented source is a key the caller supplies, and the map it indexes is a
// plain object: `constructor` resolves to a function, not to a predicate.
test("only the four known predicates ever come out of a consent list", () => {
  for (let seed = 1; seed <= 500; seed += 1) {
    const next = rng(seed);
    const consented = Array.from({ length: Math.floor(next() * 6) }, () =>
      next() < 0.5 ? HOSTILE_KEYS[Math.floor(next() * HOSTILE_KEYS.length)]! : String(anyValue(next, 3)),
    );
    for (const predicate of predicatesOf(consented)) {
      assert.ok(
        KNOWN_PREDICATES.has(predicate),
        `seed ${seed}: "${String(predicate)}" came out of ${JSON.stringify(consented)}`,
      );
    }
  }
});
