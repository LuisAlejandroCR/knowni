// stellar-payment.spec.ts: a quote becomes one signed Stellar transaction.
// Tests cover Privy's raw-hash contract, submission shape and failures without
// reaching a network or depending on a wallet SDK.

import { test } from "node:test";
import assert from "node:assert/strict";
import { payQuote, type PaymentTerms } from "../../src/domain/stellar-payment.ts";
import type { PayerWalletPort } from "../../src/domain/wallet-port.ts";
import { SIGNER_ACCOUNT, signEnvelope, signHash } from "../support/signer.ts";

const ACCOUNT = "GAZONAKJ7XIJVQI37HR2ZZKMQIISUIFAYXVCXJOCXVGQQNGM24BF2UZD";
const terms: PaymentTerms = {
  network: "testnet",
  destination: ACCOUNT,
  asset: { type: "native" },
  amountStroops: "12000000",
  paymentRef: "ab".repeat(32),
};

function privy(signs = true): PayerWalletPort {
  return {
    id: "privy",
    label: "Privy",
    signingMethod: "raw_hash",
    accountId: async () => SIGNER_ACCOUNT,
    connect: async () => SIGNER_ACCOUNT,
    signTransaction: async (hash) => {
      assert.match(hash, /^[0-9a-f]{64}$/);
      return signs ? signHash(hash) : undefined;
    },
    disconnect: async () => {},
  };
}

test("Privy signs the transaction hash and Horizon receives only a signed envelope", async () => {
  let submitted = "";
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).endsWith(`/accounts/${SIGNER_ACCOUNT}`)) {
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
    await payQuote({ terms, expiresAt: 200, nowUnix: 100, wallet: privy(false), fetchImpl: account }),
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
    accountId: async () => SIGNER_ACCOUNT,
    connect: async () => SIGNER_ACCOUNT,
    signTransaction: async (unsigned) => signEnvelope(unsigned),
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

// A signature nobody checks is only discovered when Horizon refuses it, and then
// the wallet's fault reads as the network's. These pin that it is caught first.
const OTHER_SEED = new Uint8Array(32).fill(9);

function submitCounter() {
  let submissions = 0;
  const fetchImpl = (async (url: string | URL | Request) => {
    if (String(url).includes("/accounts/")) return new Response(JSON.stringify({ sequence: "7" }), { status: 200 });
    submissions += 1;
    return new Response(JSON.stringify({ hash: "cd".repeat(32) }), { status: 200 });
  }) as typeof fetch;
  return { fetchImpl, submissions: () => submissions };
}

test("a raw-hash signature from another key is refused before Horizon", async () => {
  const horizon = submitCounter();
  const wallet = { ...privy(), signTransaction: async (hash: string) => signHash(hash, OTHER_SEED) };
  assert.deepEqual(await payQuote({ terms, expiresAt: 200, nowUnix: 100, wallet, fetchImpl: horizon.fetchImpl }), {
    status: "failed",
    reason: "wallet_rejected",
  });
  assert.equal(horizon.submissions(), 0);
});

test("a raw-hash signature over a different hash is refused too", async () => {
  const horizon = submitCounter();
  const wallet = { ...privy(), signTransaction: async () => signHash("00".repeat(32)) };
  assert.deepEqual(await payQuote({ terms, expiresAt: 200, nowUnix: 100, wallet, fetchImpl: horizon.fetchImpl }), {
    status: "failed",
    reason: "wallet_rejected",
  });
  assert.equal(horizon.submissions(), 0);
});

test("a Freighter envelope signed by another account is refused before Horizon", async () => {
  const horizon = submitCounter();
  const wallet: PayerWalletPort = {
    ...privy(),
    id: "freighter",
    signingMethod: "envelope",
    signTransaction: async (unsigned) => signEnvelope(unsigned, OTHER_SEED),
  };
  assert.deepEqual(await payQuote({ terms, expiresAt: 200, nowUnix: 100, wallet, fetchImpl: horizon.fetchImpl }), {
    status: "failed",
    reason: "wallet_rejected",
  });
  assert.equal(horizon.submissions(), 0);
});

test("a Freighter envelope with the payer's hint but a forged signature is refused", async () => {
  const horizon = submitCounter();
  const wallet: PayerWalletPort = {
    ...privy(),
    id: "freighter",
    signingMethod: "envelope",
    signTransaction: async (unsigned) => {
      const signed = Buffer.from(signEnvelope(unsigned), "base64");
      signed[signed.length - 1]! ^= 1;
      return signed.toString("base64");
    },
  };
  assert.deepEqual(await payQuote({ terms, expiresAt: 200, nowUnix: 100, wallet, fetchImpl: horizon.fetchImpl }), {
    status: "failed",
    reason: "wallet_rejected",
  });
  assert.equal(horizon.submissions(), 0);
});
