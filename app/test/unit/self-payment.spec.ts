// self-payment.spec.ts: the signing bench pays 1 XLM to the wallet's own account.
// What is pinned is that a real Cavos-style envelope signature goes through, a
// foreign one does not, and that Friendbot funding reads the way the bench shows it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { explorerUrl, fundOnTestnet, selfPaymentTerms } from "../../src/domain/self-payment.ts";
import { payQuote } from "../../src/domain/stellar-payment.ts";
import { createCavosWallet } from "../../src/domain/wallet-cavos.ts";
import { SIGNER_ACCOUNT, signEnvelope } from "../support/signer.ts";

const REFERENCE = new Uint8Array(32).fill(0xab);

function horizon() {
  let submitted = "";
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("/accounts/")) return new Response(JSON.stringify({ sequence: "7" }), { status: 200 });
    submitted = String(init?.body ?? "");
    return new Response(JSON.stringify({ hash: "cd".repeat(32) }), { status: 200 });
  }) as typeof fetch;
  return { fetchImpl, submitted: () => submitted };
}

// The Cavos adapter over a bridge that signs like `wallet.signXdr`.
const cavos = (sign: (xdr: string) => string) =>
  createCavosWallet({
    address: async () => SIGNER_ACCOUNT,
    signXdr: async (xdr) => sign(xdr),
    logout: async () => {},
  });

const pay = (wallet: ReturnType<typeof cavos>, fetchImpl: typeof fetch) =>
  payQuote({ terms: selfPaymentTerms(SIGNER_ACCOUNT, REFERENCE), expiresAt: 200, nowUnix: 100, wallet, fetchImpl });

test("the terms are 1 XLM, native, to the wallet's own account, on testnet", () => {
  assert.deepEqual(selfPaymentTerms(SIGNER_ACCOUNT, REFERENCE), {
    network: "testnet",
    destination: SIGNER_ACCOUNT,
    asset: { type: "native" },
    amountStroops: "10000000",
    paymentRef: "ab".repeat(32),
  });
  assert.throws(() => selfPaymentTerms(SIGNER_ACCOUNT, new Uint8Array(31)));
});

test("a Cavos wallet that signs for its account pays itself through Horizon", async () => {
  const wallet = cavos((xdr) => signEnvelope(xdr));
  assert.equal(await wallet.connect(), SIGNER_ACCOUNT);
  const network = horizon();
  assert.deepEqual(await pay(wallet, network.fetchImpl), { status: "paid", txHash: "cd".repeat(32) });
  assert.match(network.submitted(), /^tx=/);
});

test("a Cavos envelope signed by another key never reaches Horizon", async () => {
  const wallet = cavos((xdr) => signEnvelope(xdr, new Uint8Array(32).fill(9)));
  await wallet.connect();
  const network = horizon();
  assert.deepEqual(await pay(wallet, network.fetchImpl), { status: "failed", reason: "wallet_rejected" });
  assert.equal(network.submitted(), "");
});

test("Friendbot funds a new account, and an already funded one is not a failure", async () => {
  let asked = "";
  const ok = (async (url: string | URL | Request) => {
    asked = String(url);
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  assert.equal(await fundOnTestnet(SIGNER_ACCOUNT, ok), true);
  assert.equal(asked, `https://friendbot.stellar.org/?addr=${SIGNER_ACCOUNT}`);

  const funded = (async () =>
    new Response(JSON.stringify({ detail: "op_already_exists (createAccountAlreadyExist)" }), { status: 400 })) as typeof fetch;
  assert.equal(await fundOnTestnet(SIGNER_ACCOUNT, funded), true);

  const refused = (async () => new Response(JSON.stringify({ detail: "rate limited" }), { status: 429 })) as typeof fetch;
  assert.equal(await fundOnTestnet(SIGNER_ACCOUNT, refused), false);

  const offline = (async () => {
    throw new Error("offline");
  }) as typeof fetch;
  assert.equal(await fundOnTestnet(SIGNER_ACCOUNT, offline), false);
});

test("the evidence link is the testnet explorer page of the hash", () => {
  assert.equal(explorerUrl("cd".repeat(32)), `https://stellar.expert/explorer/testnet/tx/${"cd".repeat(32)}`);
});
