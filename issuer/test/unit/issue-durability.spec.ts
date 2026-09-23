// issue-durability.spec.ts: the spend lands on disk before Croma is touched.
// Distinct from spent-payments.spec.ts, which checks the store survives a
// restart: here the store fails and the question must not be answered at all.
// See docs/memoria.md D-38.

import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { nodeSignatures } from "@knowni/attestation/node";
import { createIssuerService, predicatesOf } from "../../src/service.ts";
import { paymentRef } from "../../src/pricing.ts";
import { createPersistentSpentPayments, type SpentPaymentStore } from "../../src/payments.ts";

const ACCESS_KEY = "notaria-key";
const DESTINATION = "GA".padEnd(56, "X");
const TX = "0dc0fdf46ebffc72257b068fe0022a6b732c6f4b9dda5503aaa8b005f18f8161";
const NOW = Math.floor(Date.now() / 1000);
const request = {
  relyingPartyId: "notaria-17",
  purpose: "vehicle-sale",
  nonce: "ab".repeat(16),
  expiresAt: NOW + 600,
  paramsHash: "cd".repeat(32),
};
const consented = ["registraduria"];

// Horizon says the payment is real, big enough and carries our reference.
function horizonThatConfirms(reference: string): typeof fetch {
  const memo = Buffer.from(reference, "hex").toString("base64");
  return (async (url: string) => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith("/payments")) {
      return new Response(
        JSON.stringify({
          _embedded: {
            records: [{ type: "payment", to: DESTINATION, amount: "1000", asset_type: "native" }],
          },
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ successful: true, memo_type: "hash", memo }), { status: 200 });
  }) as unknown as typeof fetch;
}

const storeThatNeverWrites: SpentPaymentStore = {
  async load() {
    return [];
  },
  async append() {
    throw new Error("disk is gone");
  },
};

test("a spend that cannot be written issues nothing and never calls a source", async () => {
  let providerCalls = 0;
  const provider = (async () => {
    providerCalls += 1;
    return new Response(JSON.stringify({ data: { found: true, status: "ALIVE" } }), { status: 200 });
  }) as typeof fetch;

  const reference = paymentRef(request, predicatesOf(consented));
  const spent = await createPersistentSpentPayments(storeThatNeverWrites);
  const server = createIssuerService({
    apiKey: "provider-key",
    issuerId: "issuer",
    seed: nodeSignatures.randomSeed(),
    fetchImpl: provider,
    access: { keys: new Set([ACCESS_KEY]) },
    spentPayments: spent,
    payments: {
      destination: DESTINATION,
      minAmountStroops: 1n,
      horizonUrl: "https://horizon.test",
      fetchImpl: horizonThatConfirms(reference),
    },
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("server did not bind");
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Knowni-Access-Key": ACCESS_KEY },
      body: JSON.stringify({
        documentKind: "CC",
        documentNumber: "1020304050",
        consented,
        request,
        paymentTx: TX,
      }),
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "payment_not_durable" });
    assert.equal(providerCalls, 0);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("a spend whose write failed is claimable again", async () => {
  const spent = await createPersistentSpentPayments(storeThatNeverWrites);
  assert.equal(spent.claim(TX), true);
  await assert.rejects(() => spent.settled!());
  // The write never landed and nothing was issued, so the buyer's transaction
  // is not burned by a transient disk error.
  assert.equal(spent.claim(TX), true);
});
