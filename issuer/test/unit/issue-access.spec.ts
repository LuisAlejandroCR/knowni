// issue-access.spec.ts: /issue over real HTTP, checking the access gate that
// sits in front of consent, payment and every call to Croma. See access.spec.ts
// for the pure rules this wraps.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";

import { createIssuerService } from "../../src/service.ts";
import { createMemoryRequestQuota } from "../../src/access.ts";
import { nodeSignatures } from "@knowni/attestation/node";

const request = {
  relyingPartyId: "notaria-17",
  purpose: "vehicle-sale",
  nonce: "ab".repeat(16),
  expiresAt: 2_000_000_000,
  paramsHash: "cd".repeat(32),
};

async function withServer(
  options: Parameters<typeof createIssuerService>[0],
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createIssuerService(options);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const baseOptions = { apiKey: "k", issuerId: "co-operador-demo", seed: nodeSignatures.randomSeed() };

test("with no access policy configured, /issue refuses every call", async () => {
  await withServer(baseOptions, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentKind: "CC", documentNumber: "1", consented: ["registraduria"], request }),
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "missing_key" });
  });
});

test("a call with no key header is refused before the body is even validated", async () => {
  const options = { ...baseOptions, access: { keys: new Set(["notaria-17-key"]) } };
  await withServer(options, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not even json",
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "missing_key" });
  });
});

test("a key nobody issued is refused", async () => {
  const options = { ...baseOptions, access: { keys: new Set(["notaria-17-key"]) } };
  await withServer(options, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Knowni-Access-Key": "guessed" },
      body: JSON.stringify({ documentKind: "CC", documentNumber: "1", consented: [], request }),
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unknown_key" });
  });
});

test("a recognized key reaches the existing body validation", async () => {
  const options = { ...baseOptions, access: { keys: new Set(["notaria-17-key"]) } };
  await withServer(options, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Knowni-Access-Key": "notaria-17-key" },
      // No consented sources: refused by the existing rule, past the gate.
      body: JSON.stringify({ documentKind: "CC", documentNumber: "1", consented: [], request }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "consent_missing" });
  });
});

test("a key over its budget is throttled with 429, not answered", async () => {
  const options = {
    ...baseOptions,
    access: { keys: new Set(["notaria-17-key"]) },
    requestQuota: createMemoryRequestQuota(1),
  };
  await withServer(options, async (baseUrl) => {
    const call = () =>
      fetch(`${baseUrl}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Knowni-Access-Key": "notaria-17-key" },
        body: JSON.stringify({ documentKind: "CC", documentNumber: "1", consented: [], request }),
      });
    const first = await call();
    assert.equal(first.status, 400); // past the gate, refused by consent_missing
    const second = await call();
    assert.equal(second.status, 429);
    assert.deepEqual(await second.json(), { error: "rate_limited" });
  });
});
