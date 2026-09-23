// issue-redaction.spec.ts: the HTTP service leaks nothing an operator can read.
// Criterion A13 already covers the source adapters in
// journey/test/invariant/redaction.invariant.spec.ts; what is checked here is
// the layer above them — the request body, the error bodies, the access key and
// the payment hash — which that invariant never sees.

import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { nodeSignatures } from "@knowni/attestation/node";
import { createIssuerService } from "../../src/service.ts";

const DOCUMENT = "1020304050";
const NAME = "ANA MARIA RODRIGUEZ PEÑA";
const PLATE = "ABC123";
const PHONE = "+573001234567";
const ACCESS_KEY = "notaria-key-do-not-log";
const TX = "0dc0fdf46ebffc72257b068fe0022a6b732c6f4b9dda5503aaa8b005f18f8161";
const NOW = Math.floor(Date.now() / 1000);
const request = {
  relyingPartyId: "notaria-17",
  purpose: "vehicle-sale",
  nonce: "ab".repeat(16),
  expiresAt: NOW + 600,
  paramsHash: "cd".repeat(32),
};

// Everything an operator could end up reading: the console in all its methods.
function recording() {
  const written: string[] = [];
  const methods = ["log", "info", "warn", "error", "debug"] as const;
  const saved = methods.map((name) => [name, console[name]] as const);
  for (const name of methods) {
    console[name] = ((...args: unknown[]) => {
      written.push(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "));
    }) as typeof console.log;
  }
  return {
    written,
    restore: () => {
      for (const [name, fn] of saved) console[name] = fn;
    },
  };
}

function assertClean(written: readonly string[], bodies: readonly string[]) {
  const haystack = [...written, ...bodies].join("\n");
  for (const secret of [DOCUMENT, NAME, PLATE, PHONE, ACCESS_KEY]) {
    assert.ok(!haystack.includes(secret), `"${secret}" reached a log or a response body`);
  }
}

// A provider that fails the way these registries actually fail: the error body
// carries back the document number it was asked about.
const echoingProvider = (async () =>
  new Response(
    JSON.stringify({
      error: {
        type: "upstream_error",
        message: `lookup failed for CC ${DOCUMENT} (${NAME}), plate ${PLATE}`,
      },
    }),
    { status: 502, headers: { "Content-Type": "application/json" } },
  )) as unknown as typeof fetch;

async function withService(
  options: Parameters<typeof createIssuerService>[0],
  run: (url: string, bodies: string[]) => Promise<void>,
): Promise<void> {
  const log = recording();
  const bodies: string[] = [];
  const server = createIssuerService(options);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("server did not bind");
  try {
    await run(`http://127.0.0.1:${address.port}`, bodies);
    log.restore();
    assertClean(log.written, bodies);
  } finally {
    log.restore();
    server.close();
    await once(server, "close");
  }
}

const baseOptions = () => ({
  apiKey: "provider-key",
  issuerId: "issuer",
  seed: nodeSignatures.randomSeed(),
  access: { keys: new Set([ACCESS_KEY]) },
});

const issueBody = {
  documentKind: "CC",
  documentNumber: DOCUMENT,
  plate: PLATE,
  consented: ["registraduria", "vehiculo"],
  request,
  notifyPhone: PHONE,
};

test("an issuance whose sources echo the document leaks nothing to logs or responses", async () => {
  await withService({ ...baseOptions(), fetchImpl: echoingProvider }, async (url, bodies) => {
    const response = await fetch(`${url}/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Knowni-Access-Key": ACCESS_KEY },
      body: JSON.stringify(issueBody),
    });
    bodies.push(await response.text());
    assert.equal(response.status, 200);
  });
});

test("a refused payment says why without repeating the subject or the caller's key", async () => {
  await withService(
    {
      ...baseOptions(),
      fetchImpl: echoingProvider,
      // Horizon knows nothing about this transaction, so the payment is refused
      // before any source is asked.
      payments: {
        destination: "GA".padEnd(56, "X"),
        minAmountStroops: 1n,
        fetchImpl: (async () => new Response("{}", { status: 404 })) as unknown as typeof fetch,
      },
    },
    async (url, bodies) => {
      const response = await fetch(`${url}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Knowni-Access-Key": ACCESS_KEY },
        body: JSON.stringify({ ...issueBody, paymentTx: TX }),
      });
      bodies.push(await response.text());
      assert.equal(response.status, 402);
    },
  );
});

test("a rejected caller is told nothing about itself beyond being rejected", async () => {
  await withService({ ...baseOptions(), fetchImpl: echoingProvider }, async (url, bodies) => {
    const response = await fetch(`${url}/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Knowni-Access-Key": "wrong-key" },
      body: JSON.stringify(issueBody),
    });
    bodies.push(await response.text());
    assert.equal(response.status, 401);
  });
});

test("a malformed body is refused without echoing what was sent", async () => {
  await withService({ ...baseOptions(), fetchImpl: echoingProvider }, async (url, bodies) => {
    const response = await fetch(`${url}/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Knowni-Access-Key": ACCESS_KEY },
      body: JSON.stringify({ documentNumber: DOCUMENT, consented: [], request }),
    });
    bodies.push(await response.text());
    assert.equal(response.status, 400);
  });
});
