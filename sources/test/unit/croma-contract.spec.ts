// croma-contract.spec.ts: The client against envelopes captured from live Croma calls on
// 2026-09-20, so a change in the real contract shows up here and not in production.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createCromaClient } from "../../src/providers/croma/client.ts";

const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`../fixtures/croma/${name}`, import.meta.url), "utf8")) as Record<string, unknown>;

const respondWith = (status: number, body: unknown) =>
  (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;

test("the real validation envelope maps to invalid_response and nothing else", async () => {
  const captured = fixture("error-invalid-param.json");
  const client = createCromaClient({
    apiKey: "k",
    fetchImpl: respondWith(captured.httpStatus as number, captured.body),
  });
  const result = await client.call(captured.path as string, {});
  assert.deepEqual(result, { status: "degraded", reason: "invalid_response" });
  // The upstream message names the parameter it rejected. Nothing of it crosses.
  assert.ok(!JSON.stringify(result).includes("document_number"));
});

test("the captured 200 envelope is unwrapped at data, the way the contract documents", async () => {
  const captured = fixture("rues-entities-by-name.shape.json");
  const shape = captured.shape as { data: Record<string, unknown> };
  const client = createCromaClient({ apiKey: "k", fetchImpl: respondWith(200, shape) });
  const result = await client.call(captured.path as string, { name: "ECOPETROL" });
  assert.equal(result.status, "data");
  assert.deepEqual(result.status === "data" ? result.data : undefined, shape.data);
});

test("the inventory carries only routing and budget, never a description of a person", async () => {
  const catalog = fixture("catalog-co.json") as {
    endpoints: { id: string; path: string; required: string[]; rateLimit: string | null }[];
  };
  assert.ok(catalog.endpoints.length > 50);
  for (const endpoint of catalog.endpoints) {
    assert.ok(endpoint.path.startsWith("/co/"), endpoint.path);
    assert.deepEqual(
      Object.keys(endpoint).sort(),
      ["docsUrl", "id", "path", "rateLimit", "required", "servedFrom", "source"],
    );
  }
});

test("every route the vehicle-sale profile needs is in the inventory, at the path the adapter will call", async () => {
  const catalog = fixture("catalog-co.json") as { endpoints: { path: string }[] };
  const paths = new Set(catalog.endpoints.map((endpoint) => endpoint.path));
  for (const required of [
    "/co/registraduria/vital-status/v1",
    "/co/sicaac/insolvency-cases/v1",
    "/co/procuraduria/disciplinary-records/v1",
    "/co/contraloria/fiscal-records/v1",
    "/co/runt/vehicle-by-plate/v1",
    "/co/simit/account-status/v1",
  ]) {
    assert.ok(paths.has(required), `missing ${required}`);
  }
});
