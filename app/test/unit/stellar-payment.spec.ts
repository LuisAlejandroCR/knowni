// stellar-payment.spec.ts: a quote becomes one signed Stellar transaction.
// Tests cover Privy's raw-hash contract, submission shape and failures without
// reaching a network or depending on a wallet SDK.

import { test } from "node:test";
import assert from "node:assert/strict";
import { payQuote, type PaymentTerms } from "../../src/domain/stellar-payment.ts";
import type { PayerWalletPort } from "../../src/domain/wallet-port.ts";

const ACCOUNT = "GAZONAKJ7XIJVQI37HR2ZZKMQIISUIFAYXVCXJOCXVGQQNGM24BF2UZD";
const terms: PaymentTerms = {
  network: "testnet",
  destination: ACCOUNT,
  asset: { type: "native" },
  amountStroops: "12000000",
  paymentRef: "ab".repeat(32),
};

function privy(signature: string | null = "11".repeat(64)): PayerWalletPort {
  return {
    id: "privy",
    label: "Privy",
    signingMethod: "raw_hash",
    accountId: async () => ACCOUNT,
    connect: async () => ACCOUNT,
    signTransaction: async (hash) => {
      assert.match(hash, /^[0-9a-f]{64}$/);
      return signature ?? undefined;
    },
    disconnect: async () => {},
  };
}

test("Privy signs the transaction hash and Horizon receives only a signed envelope", async () => {
  let submitted = "";
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).endsWith(`/accounts/${ACCOUNT}`)) {
      return new Response(JSON.stringify({ sequence: "7" }), { status: 200 });
    }
    submitted = String(init?.body);
    return new Response(JSON.stringify({ hash: "cd".repeat(32) }), { status: 200 });
  }) as typeof fetch;
  const result = await payQuote({ terms, expiresAt: 200, nowUnix: 100, wallet: privy(), fetchImpl });
  assert.deepEqual(result, { status: "paid", txHash: "cd".repeat(32) });
  assert.match(submitted, /^tx=/);
  const xdr = Buffer.from(decodeURIComponent(submitted.slice(3)), "base64");
  assert.ok(xdr.includes(Buffer.from(terms.paymentRef, "hex")));
  assert.ok(!submitted.includes("11".repeat(64)));
});

test("an expired quote is refused before account lookup or signature", async () => {
  let called = false;
  const result = await payQuote({
    terms,
    expiresAt: 100,
    nowUnix: 100,
    wallet: privy(),
    fetchImpl: (async () => {
      called = true;
      throw new Error("must not run");
    }) as typeof fetch,
  });
  assert.deepEqual(result, { status: "failed", reason: "quote_expired" });
  assert.equal(called, false);
});

test("wallet rejection and an unfunded account remain distinct", async () => {
  const account = (async () => new Response(JSON.stringify({ sequence: "7" }), { status: 200 })) as typeof fetch;
  assert.deepEqual(
    await payQuote({ terms, expiresAt: 200, nowUnix: 100, wallet: privy(null), fetchImpl: account }),
    { status: "failed", reason: "wallet_rejected" },
  );
  const missing = (async () => new Response("{}", { status: 404 })) as typeof fetch;
  assert.deepEqual(
    await payQuote({ terms, expiresAt: 200, nowUnix: 100, wallet: privy(), fetchImpl: missing }),
    { status: "failed", reason: "account_not_found" },
  );
});

test("Freighter signs the unsigned envelope and cannot swap the transaction", async () => {
  const wallet: PayerWalletPort = {
    id: "freighter",
    label: "Freighter",
    signingMethod: "envelope",
    accountId: async () => ACCOUNT,
    connect: async () => ACCOUNT,
    signTransaction: async (unsigned) => {
      const bytes = Buffer.from(unsigned, "base64");
      const count = Buffer.from([0, 0, 0, 1]);
      const hint = Buffer.alloc(4);
      const length = Buffer.from([0, 0, 0, 64]);
      return Buffer.concat([bytes.subarray(0, -4), count, hint, length, Buffer.alloc(64, 7)]).toString("base64");
    },
    disconnect: async () => {},
  };
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return calls === 1
      ? new Response(JSON.stringify({ sequence: "7" }), { status: 200 })
      : new Response(JSON.stringify({ hash: "ef".repeat(32) }), { status: 200 });
  }) as typeof fetch;
  assert.deepEqual(await payQuote({ terms, expiresAt: 200, nowUnix: 100, wallet, fetchImpl }), {
    status: "paid",
    txHash: "ef".repeat(32),
  });
});

test("an invalid payment reference is never sent for signature", async () => {
  let signed = false;
  const wallet = privy();
  const guarded = { ...wallet, signTransaction: async () => { signed = true; return "11".repeat(64); } };
  const account = (async () => new Response(JSON.stringify({ sequence: "7" }), { status: 200 })) as typeof fetch;
  assert.deepEqual(
    await payQuote({ terms: { ...terms, paymentRef: "ab" }, expiresAt: 200, nowUnix: 100, wallet: guarded, fetchImpl: account }),
    { status: "failed", reason: "invalid_terms" },
  );
  assert.equal(signed, false);
});
