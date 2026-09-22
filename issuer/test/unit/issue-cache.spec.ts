// issue-cache.spec.ts: an HTTP retry reuses only the reduced signed response.
// It still crosses access control, but never calls Croma or sends the notice a
// second time.

import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { nodeSignatures } from "@knowni/attestation/node";
import { createIssuerService } from "../../src/service.ts";

const ACCESS_KEY = "notaria-key";
const NOW = Math.floor(Date.now() / 1000);
const request = {
  relyingPartyId: "notaria-17",
  purpose: "vehicle-sale",
  nonce: "ab".repeat(16),
  expiresAt: NOW + 600,
  paramsHash: "cd".repeat(32),
};

async function withServer(
  expected: { readonly providerCalls: number; readonly notices: number },
  run: (url: string) => Promise<void>,
): Promise<void> {
  let providerCalls = 0;
  let notices = 0;
  const provider = (async () => {
    providerCalls += 1;
    return new Response(JSON.stringify({ data: { found: true, status: "ALIVE" } }), { status: 200 });
  }) as typeof fetch;
  const server = createIssuerService({
    apiKey: "provider-key",
    issuerId: "issuer",
    seed: nodeSignatures.randomSeed(),
    fetchImpl: provider,
    access: { keys: new Set([ACCESS_KEY]) },
    notifier: {
      channel: "test",
      notify: async () => { notices += 1; return true; },
    },
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("server did not bind");
  try {
    await run(`http://127.0.0.1:${address.port}`);
    assert.equal(providerCalls, expected.providerCalls);
    assert.equal(notices, expected.notices);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("an identical authorized retry returns the same envelope without repeating side effects", async () => {
  await withServer({ providerCalls: 1, notices: 1 }, async (url) => {
    const body = {
      documentKind: "CC",
      documentNumber: "1020304050",
      consented: ["registraduria"],
      request,
      notifyPhone: "+570000000000",
    };
    const issue = () => fetch(`${url}/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Knowni-Access-Key": ACCESS_KEY },
      body: JSON.stringify(body),
    });
    const first = await issue();
    const second = await issue();
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.deepEqual(await second.json(), await first.json());
  });
});

test("two subjects under the same request never share a cached answer", async () => {
  await withServer({ providerCalls: 2, notices: 0 }, async (url) => {
    const issue = (documentNumber: string) => fetch(`${url}/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Knowni-Access-Key": ACCESS_KEY },
      body: JSON.stringify({
        documentKind: "CC",
        documentNumber,
        consented: ["registraduria"],
        request,
      }),
    });
    assert.equal((await issue("1020304050")).status, 200);
    assert.equal((await issue("1020304051")).status, 200);
  });
});
