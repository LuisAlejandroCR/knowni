// issuer-client.spec.ts: quote, payment and issuance are one ordered operation.
// A failed payment never spends a provider call, and a missing payment block
// cannot silently downgrade an issuer that declared charging enabled.

import { test } from "node:test";
import assert from "node:assert/strict";
import { requestPaidIssuance, type IssuanceInput } from "../../src/domain/issuer-client.ts";
import type { PayerWalletPort } from "../../src/domain/wallet-port.ts";

const ACCOUNT = "GAZONAKJ7XIJVQI37HR2ZZKMQIISUIFAYXVCXJOCXVGQQNGM24BF2UZD";
const REFERENCE = "ab".repeat(32);
const input: IssuanceInput = {
  documentKind: "CC",
  documentNumber: "1020304050",
  consented: ["registraduria"],
  request: {
    relyingPartyId: "notaria-17",
    purpose: "vehicle-sale",
    nonce: "cd".repeat(16),
    expiresAt: Math.floor(Date.now() / 1000) + 600,
    paramsHash: "ef".repeat(32),
  },
};

function wallet(signature: string | null = "11".repeat(64)): PayerWalletPort {
  return {
    id: "privy",
    label: "Privy",
    signingMethod: "raw_hash",
    accountId: async () => ACCOUNT,
    connect: async () => ACCOUNT,
    signTransaction: async () => signature ?? undefined,
    disconnect: async () => {},
  };
}

const quote = (paymentRequired: boolean, includePayment = paymentRequired) => ({
  quote: {
    currency: "USDC",
    totalMinor: 120,
    paymentRef: REFERENCE,
    expiresAt: Math.floor(Date.now() / 1000) + 600,
  },
  paymentRequired,
  ...(includePayment
    ? {
        payment: {
          network: "testnet",
          destination: ACCOUNT,
          asset: { type: "native" },
          amountStroops: "12000000",
          paymentRef: REFERENCE,
        },
      }
    : {}),
});

test("the paid path quotes, signs, submits and only then calls issue with the tx hash", async () => {
  const calls: string[] = [];
  let issueBody: { paymentTx?: string } | undefined;
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const value = String(url);
    calls.push(value);
    if (value.endsWith("/quote")) return new Response(JSON.stringify(quote(true)), { status: 200 });
    if (value.includes("/accounts/")) return new Response(JSON.stringify({ sequence: "7" }), { status: 200 });
    if (value.endsWith("/transactions")) {
      return new Response(JSON.stringify({ hash: "22".repeat(32) }), { status: 200 });
    }
    issueBody = JSON.parse(String(init?.body)) as { paymentTx?: string };
    return new Response(JSON.stringify({ results: {} }), { status: 200 });
  }) as typeof fetch;

  const result = await requestPaidIssuance(input, wallet(), {
    baseUrl: "https://issuer.example",
    horizonUrl: "https://horizon.example",
    fetchImpl,
  });
  assert.equal(result.status, "issued");
  assert.equal(issueBody?.paymentTx, "22".repeat(32));
  assert.deepEqual(calls.map((url) => new URL(url).pathname), [
    "/quote",
    `/accounts/${ACCOUNT}`,
    "/transactions",
    "/issue",
  ]);
});

test("a rejected signature stops before Horizon submission and issuance", async () => {
  const calls: string[] = [];
  const fetchImpl = (async (url: string | URL | Request) => {
    const value = String(url);
    calls.push(value);
    return value.endsWith("/quote")
      ? new Response(JSON.stringify(quote(true)), { status: 200 })
      : new Response(JSON.stringify({ sequence: "7" }), { status: 200 });
  }) as typeof fetch;
  const result = await requestPaidIssuance(input, wallet(null), {
    baseUrl: "https://issuer.example",
    horizonUrl: "https://horizon.example",
    fetchImpl,
  });
  assert.deepEqual(result, { status: "failed", stage: "payment", reason: "wallet_rejected" });
  assert.equal(calls.some((url) => url.endsWith("/issue")), false);
});

test("payment cannot be omitted unless quote explicitly disables it", async () => {
  let calls = 0;
  const malformed = (async () => {
    calls += 1;
    return new Response(JSON.stringify(quote(true, false)), { status: 200 });
  }) as typeof fetch;
  const refused = await requestPaidIssuance(input, wallet(), {
    baseUrl: "https://issuer.example",
    fetchImpl: malformed,
  });
  assert.equal(refused.status === "failed" && refused.stage, "quote");
  assert.equal(calls, 1);

  const freeCalls: string[] = [];
  const free = (async (url: string | URL | Request) => {
    freeCalls.push(String(url));
    return String(url).endsWith("/quote")
      ? new Response(JSON.stringify(quote(false, false)), { status: 200 })
      : new Response(JSON.stringify({ results: {} }), { status: 200 });
  }) as typeof fetch;
  assert.equal(
    (await requestPaidIssuance(input, wallet(), { baseUrl: "https://issuer.example", fetchImpl: free })).status,
    "issued",
  );
  assert.deepEqual(freeCalls.map((url) => new URL(url).pathname), ["/quote", "/issue"]);
});
