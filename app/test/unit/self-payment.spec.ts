// self-payment.spec.ts: the signing bench pays 1 XLM to the wallet's own account.
// What is pinned is that a real signature goes through, a foreign one does not,
// and that the terms are the ones the bench shows on screen.

import { test } from "node:test";
import assert from "node:assert/strict";
import { explorerUrl, selfPaymentTerms } from "../../src/domain/self-payment.ts";
import { payQuote } from "../../src/domain/stellar-payment.ts";
import { createPrivyWallet } from "../../src/domain/wallet-privy.ts";
import { SIGNER_ACCOUNT, signHash } from "../support/signer.ts";

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

// The Privy adapter over a bridge that signs like Privy: `0x` in, `0x` out.
const privy = (sign: (hash: string) => string) =>
  createPrivyWallet({
    loginWithPasskey: async () => true,
    stellarAddress: async () => SIGNER_ACCOUNT,
    createStellarWallet: async () => undefined,
    signRawHash: async (_address, hash) => `0x${sign(hash.replace(/^0x/, ""))}`,
    logout: async () => {},
  });

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

test("a Privy wallet that signs for its account pays itself through Horizon", async () => {
  const wallet = privy((hash) => signHash(hash));
  assert.equal(await wallet.connect(), SIGNER_ACCOUNT);
  const network = horizon();
  const result = await payQuote({
    terms: selfPaymentTerms(SIGNER_ACCOUNT, REFERENCE),
    expiresAt: 200,
    nowUnix: 100,
    wallet,
    fetchImpl: network.fetchImpl,
  });
  assert.deepEqual(result, { status: "paid", txHash: "cd".repeat(32) });
  assert.match(network.submitted(), /^tx=/);
});

test("a Privy wallet whose signature is from another key never reaches Horizon", async () => {
  const wallet = privy((hash) => signHash(hash, new Uint8Array(32).fill(9)));
  await wallet.connect();
  const network = horizon();
  const result = await payQuote({
    terms: selfPaymentTerms(SIGNER_ACCOUNT, REFERENCE),
    expiresAt: 200,
    nowUnix: 100,
    wallet,
    fetchImpl: network.fetchImpl,
  });
  assert.deepEqual(result, { status: "failed", reason: "wallet_rejected" });
  assert.equal(network.submitted(), "");
});

test("the evidence link is the testnet explorer page of the hash", () => {
  assert.equal(explorerUrl("cd".repeat(32)), `https://stellar.expert/explorer/testnet/tx/${"cd".repeat(32)}`);
});
