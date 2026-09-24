// croma-budget.spec.ts: el presupuesto del llamador para y el cliente para.
// Sin esto, el plazo de D-41 cortaba la espera y no el trabajo: la emisión
// devolvía `unavailable` y el cliente seguía reintentando y encuestando contra
// una API que se cobra, por una respuesta que ya nadie iba a leer — D-69.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createCromaClient } from "../../src/providers/croma/client.ts";

const PATH = "/co/registraduria/vital-status/v1";

// No real waiting: the client's sleep is injected, so a backoff is a resolved
// promise and the test measures calls rather than seconds.
const instant = async () => {};

test("a budget already spent means no call at all", async () => {
  let calls = 0;
  const budget = new AbortController();
  budget.abort();
  const client = createCromaClient({
    apiKey: "k",
    sleep: instant,
    signal: budget.signal,
    fetchImpl: async () => {
      calls += 1;
      return new Response("{}", { status: 500 });
    },
  });
  assert.deepEqual(await client.call(PATH, {}), { status: "degraded", reason: "source_unavailable" });
  assert.equal(calls, 0);
});

test("a budget spent mid-flight stops the retries instead of finishing them", async () => {
  let calls = 0;
  const budget = new AbortController();
  const client = createCromaClient({
    apiKey: "k",
    sleep: instant,
    signal: budget.signal,
    fetchImpl: async () => {
      calls += 1;
      // The caller gives up while the first attempt is being answered.
      budget.abort();
      return new Response("{}", { status: 503 });
    },
  });
  assert.deepEqual(await client.call(PATH, {}), { status: "degraded", reason: "source_unavailable" });
  assert.equal(calls, 1);
});

test("without a budget the retries are exactly the ones they always were", async () => {
  let calls = 0;
  const client = createCromaClient({
    apiKey: "k",
    sleep: instant,
    fetchImpl: async () => {
      calls += 1;
      return new Response("{}", { status: 503 });
    },
  });
  assert.deepEqual(await client.call(PATH, {}), { status: "degraded", reason: "source_unavailable" });
  assert.equal(calls, 3);
});

test("a budget that is never spent changes nothing", async () => {
  const budget = new AbortController();
  const client = createCromaClient({
    apiKey: "k",
    sleep: instant,
    signal: budget.signal,
    fetchImpl: async () => new Response(JSON.stringify({ data: { found: true } }), { status: 200 }),
  });
  assert.deepEqual(await client.call(PATH, {}), { status: "data", data: { found: true } });
});

test("polling stops on the budget too, and does not wait out its cap", async () => {
  let polls = 0;
  const budget = new AbortController();
  const client = createCromaClient({
    apiKey: "k",
    sleep: instant,
    signal: budget.signal,
    fetchImpl: async (url) => {
      const target = url instanceof Request ? url.url : url.toString();
      if (!target.includes("/jobs/")) {
        return new Response(JSON.stringify({ job: { status_url: "https://api.example/jobs/1" } }), { status: 202 });
      }
      polls += 1;
      budget.abort();
      return new Response(JSON.stringify({ job: { status: "running" } }), { status: 200 });
    },
  });
  assert.deepEqual(await client.call(PATH, {}), { status: "degraded", reason: "source_unavailable" });
  assert.equal(polls, 1);
});

test("the request in flight is cancelled, not just ignored", async () => {
  const budget = new AbortController();
  let sawAbort = false;
  const client = createCromaClient({
    apiKey: "k",
    sleep: instant,
    signal: budget.signal,
    fetchImpl: async (_url, init) =>
      await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          sawAbort = true;
          reject(new DOMException("aborted", "AbortError"));
        });
        setTimeout(() => budget.abort(), 0);
      }),
  });
  assert.deepEqual(await client.call(PATH, {}), { status: "degraded", reason: "source_unavailable" });
  assert.equal(sawAbort, true);
});
