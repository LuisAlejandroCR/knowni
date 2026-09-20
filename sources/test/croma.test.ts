// sources/test/croma.test.ts
// The Croma HTTP contract, exercised without a network: 202 polling, the
// retryable band, and the two rules — never throw, never echo upstream text.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createCromaClient, type CromaTelemetry } from "../src/providers/croma/client.ts";

const PATH = "/co/registraduria/vital-status/v1";
const KEY = "test-key";

// A queued fetch: each call answers with the next scripted response and
// records what it was asked for, so the assertions can look at both.
type Scripted = { status: number; body?: unknown; headers?: Record<string, string> };

function scriptedFetch(responses: Scripted[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (next === undefined) throw new Error("unexpected extra request");
    return new Response(next.body === undefined ? null : JSON.stringify(next.body), {
      status: next.status,
      headers: { "Content-Type": "application/json", ...(next.headers ?? {}) },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

// Sleeps are recorded, never taken: a backoff test that actually waits is a
// slow test that stops being run.
function recordedSleep() {
  const waits: number[] = [];
  return { waits, sleep: async (ms: number) => void waits.push(ms) };
}

test("a 200 hands the caller the data and nothing else", async () => {
  const { impl, calls } = scriptedFetch([{ status: 200, body: { data: { alive: true } } }]);
  const client = createCromaClient({ apiKey: KEY, fetchImpl: impl });
  const result = await client.call(PATH, { document_number: "1020304050" });
  assert.deepEqual(result, { status: "data", data: { alive: true } });
  assert.equal(calls[0]?.url, `https://api.croma.run${PATH}`);
});

test("data: null is not-found, because a registry with no record is not a failure", async () => {
  const { impl } = scriptedFetch([{ status: 200, body: { data: null } }]);
  const client = createCromaClient({ apiKey: KEY, fetchImpl: impl });
  assert.deepEqual(await client.call(PATH, {}), { status: "degraded", reason: "not_found" });
});

test("a body with no data field is invalid, not empty", async () => {
  const { impl } = scriptedFetch([{ status: 200, body: { unexpected: 1 } }]);
  const client = createCromaClient({ apiKey: KEY, fetchImpl: impl });
  assert.deepEqual(await client.call(PATH, {}), { status: "degraded", reason: "invalid_response" });
});

test("a 202 is polled at its status_url until the job completes", async () => {
  const statusUrl = "https://api.croma.run/jobs/abc";
  const { impl, calls } = scriptedFetch([
    { status: 202, body: { job: { id: "abc", status: "queued", status_url: statusUrl } } },
    { status: 200, body: { job: { id: "abc", status: "running" } } },
    { status: 200, body: { job: { id: "abc", status: "completed" }, data: { alive: true } } },
  ]);
  const { sleep } = recordedSleep();
  const client = createCromaClient({ apiKey: KEY, fetchImpl: impl, sleep, pollIntervalMs: 10 });
  assert.deepEqual(await client.call(PATH, {}), { status: "data", data: { alive: true } });
  assert.equal(calls.length, 3);
  assert.equal(calls[1]?.url, statusUrl);
  assert.equal(calls[1]?.init.method, "GET");
});

test("a job that fails degrades, and its upstream reason does not come along", async () => {
  const statusUrl = "https://api.croma.run/jobs/abc";
  const { impl } = scriptedFetch([
    { status: 202, body: { job: { id: "abc", status: "queued", status_url: statusUrl } } },
    {
      status: 200,
      body: { job: { id: "abc", status: "failed" }, error: "lookup failed for CC 1020304050" },
    },
  ]);
  const { sleep } = recordedSleep();
  const client = createCromaClient({ apiKey: KEY, fetchImpl: impl, sleep, pollIntervalMs: 10 });
  const result = await client.call(PATH, {});
  assert.deepEqual(result, { status: "degraded", reason: "source_unavailable" });
  assert.ok(!JSON.stringify(result).includes("1020304050"));
});

test("polling stops at the cap, so a job that never settles cannot hang the caller", async () => {
  const statusUrl = "https://api.croma.run/jobs/abc";
  const running = { status: 200, body: { job: { id: "abc", status: "running" } } };
  const { impl, calls } = scriptedFetch([
    { status: 202, body: { job: { id: "abc", status: "queued", status_url: statusUrl } } },
    ...Array.from({ length: 3 }, () => ({ ...running })),
  ]);
  const { sleep } = recordedSleep();
  const client = createCromaClient({ apiKey: KEY, fetchImpl: impl, sleep, maxPolls: 3, pollIntervalMs: 10 });
  assert.deepEqual(await client.call(PATH, {}), { status: "degraded", reason: "source_unavailable" });
  assert.equal(calls.length, 4);
});

test("a 202 with no status_url is invalid rather than an endless wait", async () => {
  const { impl } = scriptedFetch([{ status: 202, body: { job: { id: "abc", status: "queued" } } }]);
  const client = createCromaClient({ apiKey: KEY, fetchImpl: impl });
  assert.deepEqual(await client.call(PATH, {}), { status: "degraded", reason: "invalid_response" });
});

test("a 502 is retried with exponential backoff, because Rama Judicial is a live upstream", async () => {
  const { impl, calls } = scriptedFetch([
    { status: 502, body: { error: "upstream_error" } },
    { status: 502, body: { error: "upstream_error" } },
    { status: 200, body: { data: { cases: 0 } } },
  ]);
  const { waits, sleep } = recordedSleep();
  const client = createCromaClient({ apiKey: KEY, fetchImpl: impl, sleep, backoffMs: 100 });
  assert.deepEqual(await client.call(PATH, {}), { status: "data", data: { cases: 0 } });
  assert.equal(calls.length, 3);
  assert.deepEqual(waits, [100, 200]);
});

test("Retry-After overrides our own interval", async () => {
  const { impl } = scriptedFetch([
    { status: 429, body: {}, headers: { "Retry-After": "7" } },
    { status: 200, body: { data: 1 } },
  ]);
  const { waits, sleep } = recordedSleep();
  const client = createCromaClient({ apiKey: KEY, fetchImpl: impl, sleep, backoffMs: 100 });
  assert.deepEqual(await client.call(PATH, {}), { status: "data", data: 1 });
  assert.deepEqual(waits, [7_000]);
});

test("retries run out and degrade instead of hammering a registry that is down", async () => {
  const { impl, calls } = scriptedFetch(
    Array.from({ length: 3 }, () => ({ status: 503, body: {} })),
  );
  const { sleep } = recordedSleep();
  const client = createCromaClient({ apiKey: KEY, fetchImpl: impl, sleep, maxRetries: 3, backoffMs: 1 });
  assert.deepEqual(await client.call(PATH, {}), { status: "degraded", reason: "source_unavailable" });
  assert.equal(calls.length, 3);
});

test("a 404 is not-found and a 400 is invalid; neither is retried", async () => {
  const notFound = scriptedFetch([{ status: 404, body: {} }]);
  const bad = scriptedFetch([{ status: 400, body: { error: "bad document_number 1020304050" } }]);
  const client = (impl: typeof fetch) => createCromaClient({ apiKey: KEY, fetchImpl: impl });
  assert.deepEqual(await client(notFound.impl).call(PATH, {}), {
    status: "degraded",
    reason: "not_found",
  });
  assert.deepEqual(await client(bad.impl).call(PATH, {}), {
    status: "degraded",
    reason: "invalid_response",
  });
  assert.equal(notFound.calls.length, 1);
  assert.equal(bad.calls.length, 1);
});

test("rejected credentials are the operator's fault, and are not retried against the registry", async () => {
  const { impl, calls } = scriptedFetch([{ status: 401, body: {} }]);
  const client = createCromaClient({ apiKey: KEY, fetchImpl: impl });
  assert.deepEqual(await client.call(PATH, {}), { status: "degraded", reason: "source_unavailable" });
  assert.equal(calls.length, 1);
});

test("a fetch that throws never reaches the caller as an exception", async () => {
  const impl = (async () => {
    throw new Error("ENOTFOUND api.croma.run");
  }) as unknown as typeof fetch;
  const { sleep } = recordedSleep();
  const client = createCromaClient({ apiKey: KEY, fetchImpl: impl, sleep, backoffMs: 1 });
  assert.deepEqual(await client.call(PATH, {}), { status: "degraded", reason: "source_unavailable" });
});

test("no key means no call at all", async () => {
  const { impl, calls } = scriptedFetch([{ status: 200, body: { data: 1 } }]);
  const client = createCromaClient({ fetchImpl: impl });
  assert.deepEqual(await client.call(PATH, {}), { status: "degraded", reason: "consent_missing" });
  assert.equal(calls.length, 0);
});

test("the request carries the documented auth, content type and wait preference", async () => {
  const { impl, calls } = scriptedFetch([{ status: 200, body: { data: 1 } }]);
  const client = createCromaClient({ apiKey: KEY, fetchImpl: impl });
  await client.call(PATH, { document_number: "1020304050" });
  const headers = calls[0]?.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Bearer ${KEY}`);
  assert.equal(headers["Content-Type"], "application/json");
  assert.equal(headers.Prefer, "wait=55");
  assert.equal(calls[0]?.init.body, JSON.stringify({ document_number: "1020304050" }));
});

test("telemetry carries the rate-limit budget and never the request", async () => {
  const { impl } = scriptedFetch([
    {
      status: 200,
      body: { data: 1 },
      headers: { "X-RateLimit-Limit": "100", "X-RateLimit-Remaining": "98", "X-RateLimit-Reset": "60" },
    },
  ]);
  const seen: CromaTelemetry[] = [];
  const client = createCromaClient({ apiKey: KEY, fetchImpl: impl, observe: (e) => seen.push(e) });
  await client.call(PATH, { document_number: "1020304050" });
  assert.deepEqual(seen, [
    { path: PATH, status: 200, attempt: 1, rateLimit: { limit: "100", remaining: "98", reset: "60" } },
  ]);
  assert.ok(!JSON.stringify(seen).includes("1020304050"));
});

test("a body that is not JSON degrades instead of throwing", async () => {
  const impl = (async () =>
    new Response("<html>gateway</html>", { status: 200 })) as unknown as typeof fetch;
  const client = createCromaClient({ apiKey: KEY, fetchImpl: impl });
  assert.deepEqual(await client.call(PATH, {}), { status: "degraded", reason: "invalid_response" });
});
