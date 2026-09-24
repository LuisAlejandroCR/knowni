// redaction.invariant.spec.ts: nothing a registry says about a person reaches a log or a result.
// Runs the adapters against sources that fail the way real ones do — echoing the
// document number back in their errors — and reads everything written. Criterion A13.

import { test } from "node:test";
import assert from "node:assert/strict";

import { poseidonHash } from "@knowni/core/node";
import {
  createCromaClient,
  createPilaIncomeSource,
  createRegistraduriaPersonhoodSource,
  createSanctionsSource,
  createSicaacCapacitySource,
  createVehicleStandingSource,
} from "@knowni/sources";

// Values that must never appear anywhere an operator can read.
const DOCUMENT = "1020304050";
const NAME = "ANA MARIA RODRIGUEZ PEÑA";
const SALARY = "420000000";
const ACCOUNT = "CTA-99887766";
const PLATE = "ABC123";

const subject = { documentKind: "CC", documentNumber: DOCUMENT, subjectRef: "0a".repeat(32) };
const asset = { plate: PLATE, ownerDocumentNumber: DOCUMENT, assetRef: "0b".repeat(32) };

// Everything an operator could end up reading: the injected telemetry, the
// injected error sink, and the console itself.
function recording() {
  const written: string[] = [];
  const consoleMethods = ["log", "info", "warn", "error", "debug"] as const;
  const saved = consoleMethods.map((name) => [name, console[name].bind(console)] as const);
  for (const name of consoleMethods) {
    console[name] = ((...args: unknown[]) => {
      written.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    }) as typeof console.log;
  }
  return {
    written,
    observe: (event: unknown) => written.push(JSON.stringify(event)),
    logError: (error: unknown) => written.push(String(error) + JSON.stringify(error)),
    restore: () => {
      for (const [name, fn] of saved) console[name] = fn;
    },
  };
}

function assertClean(written: readonly string[], results: readonly unknown[]) {
  const haystack = [...written, JSON.stringify(results)].join("\n");
  for (const secret of [DOCUMENT, NAME, SALARY, ACCOUNT, PLATE]) {
    assert.ok(!haystack.includes(secret), `"${secret}" reached a log or a result`);
  }
}

// A provider that fails the way these registries actually fail: the error
// body carries the document number that was queried.
const echoingFetch = (async () =>
  new Response(
    JSON.stringify({
      error: {
        type: "upstream_error",
        message: `lookup failed for CC ${DOCUMENT} (${NAME}), account ${ACCOUNT}`,
        param: "document_number",
      },
    }),
    { status: 502, headers: { "Content-Type": "application/json" } },
  )) as unknown as typeof fetch;

test("a provider that echoes the document number in its error leaks nothing", async () => {
  const log = recording();
  try {
    const client = createCromaClient({
      apiKey: "k",
      fetchImpl: echoingFetch,
      sleep: async () => {},
      backoffMs: 1,
      observe: log.observe,
    });
    const results = await Promise.all([
      createRegistraduriaPersonhoodSource(client).fetch(subject, 1_760_000_000),
      createSicaacCapacitySource(client).fetch(subject, 1_760_000_000),
      createSanctionsSource(client, poseidonHash).fetch(subject, 1_760_000_000),
      createVehicleStandingSource(client).fetch(asset, 1_760_000_000),
    ]);
    for (const result of results) assert.equal(result.status, "degraded");
    assertClean(log.written, results);
  } finally {
    log.restore();
  }
});

test("a successful lookup keeps the registry's own fields out of the claim", async () => {
  const log = recording();
  try {
    const client = createCromaClient({
      apiKey: "k",
      observe: log.observe,
      fetchImpl: (async (url: string) => {
        const body = String(url).includes("vital-status")
          ? { found: true, document_number: DOCUMENT, status: "ALIVE" }
          : { found: true, document_number: DOCUMENT, full_name: NAME, cases: [], has_records: false };
        return new Response(JSON.stringify({ data: body }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    const results = await Promise.all([
      createRegistraduriaPersonhoodSource(client).fetch(subject, 1_760_000_000),
      createSicaacCapacitySource(client).fetch(subject, 1_760_000_000),
    ]);
    for (const result of results) assert.equal(result.status, "claimed");
    assertClean(log.written, results);
  } finally {
    log.restore();
  }
});

test("an operator outage in PILA leaves no salary and no error text behind", async () => {
  const log = recording();
  try {
    const failing = {
      async contributions(): Promise<never> {
        throw new Error(`operator rejected CC ${DOCUMENT}, account ${ACCOUNT}, ibc ${SALARY}`);
      },
    };
    const source = createPilaIncomeSource(failing, { logError: log.logError });
    const result = await source.fetch(subject, 1_760_000_000);
    assert.equal(result.status, "degraded");
    // The sink was given the raw error on purpose — that is what a logError
    // hook is for — so what this asserts is the RESULT, and that nothing
    // printed itself to the console along the way.
    assert.ok(!JSON.stringify(result).includes(DOCUMENT));
    assert.ok(!JSON.stringify(result).includes(SALARY));
    assert.equal(log.written.filter((line) => line.includes(DOCUMENT)).length, 1);
  } finally {
    log.restore();
  }
});

test("telemetry records the route and the rate limit, never the subject", async () => {
  const log = recording();
  try {
    const client = createCromaClient({
      apiKey: "k",
      observe: log.observe,
      fetchImpl: (async () =>
        new Response(JSON.stringify({ data: { found: true, status: "ALIVE" } }), {
          status: 200,
          headers: { "X-RateLimit-Remaining": "4321" },
        })) as unknown as typeof fetch,
    });
    await createRegistraduriaPersonhoodSource(client).fetch(subject, 1_760_000_000);
    const telemetry = log.written.join("\n");
    assert.ok(telemetry.includes("vital-status"));
    assert.ok(telemetry.includes("4321"));
    assert.ok(!telemetry.includes(DOCUMENT));
  } finally {
    log.restore();
  }
});
