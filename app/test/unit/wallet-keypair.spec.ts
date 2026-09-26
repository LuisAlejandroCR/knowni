// wallet-keypair.spec.ts: the device key pays through the raw-hash path.
// The signature must verify against the signed transaction's hash,
// and the seed must not travel anywhere.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha2";
import { accountIdOf, payQuote, type PaymentTerms } from "../../src/domain/stellar-payment.ts";
import { createKeypairWallet } from "../../src/domain/wallet-keypair.ts";

const SEED = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const DESTINATION = "GAZONAKJ7XIJVQI37HR2ZZKMQIISUIFAYXVCXJOCXVGQQNGM24BF2UZD";
const terms: PaymentTerms = {
  network: "testnet",
  destination: DESTINATION,
  asset: { type: "native" },
  amountStroops: "12000000",
  paymentRef: "ab".repeat(32),
};

test("an account id round-trips through the payment module's own decoder", async () => {
  const wallet = createKeypairWallet(SEED);
  const account = await wallet.connect();
  assert.equal(account, accountIdOf(ed25519.getPublicKey(SEED)));
  assert.match(account ?? "", /^G[A-Z2-7]{55}$/);
  // A payment to the wallet's own account only encodes if the checksum is right.
  const result = await payQuote({
    terms: { ...terms, destination: account! },
    expiresAt: 200,
    nowUnix: 100,
    wallet,
    fetchImpl: (async () => new Response("{}", { status: 404 })) as unknown as typeof fetch,
  });
  assert.deepEqual(result, { status: "failed", reason: "account_not_found" });
});

test("a known account id is encoded exactly", () => {
  const publicKey = Uint8Array.from(Buffer.from("0000000000000000000000000000000000000000000000000000000000000000", "hex"));
  assert.equal(accountIdOf(publicKey), "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
});

test("the device key signs the transaction hash and Horizon receives a verifiable envelope", async () => {
  const wallet = createKeypairWallet(SEED);
  const account = (await wallet.connect())!;
  let submitted = "";
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).endsWith(`/accounts/${account}`)) {
      return new Response(JSON.stringify({ sequence: "41" }), { status: 200 });
    }
    submitted = String(init?.body);
    return new Response(JSON.stringify({ hash: "cd".repeat(32) }), { status: 200 });
  }) as typeof fetch;

  const result = await payQuote({ terms, expiresAt: 200, nowUnix: 100, wallet, fetchImpl });
  assert.deepEqual(result, { status: "paid", txHash: "cd".repeat(32) });

  const envelope = Buffer.from(decodeURIComponent(submitted.slice(3)), "base64");
  const signature = envelope.subarray(envelope.length - 64);
  const transaction = envelope.subarray(4, envelope.length - 4 - 4 - 4 - 64);
  const typeTx = Uint8Array.of(0, 0, 0, 2);
  const networkId = sha256(new TextEncoder().encode("Test SDF Network ; September 2015"));
  const hash = sha256(Buffer.concat([networkId, typeTx, transaction]));
  assert.ok(ed25519.verify(signature, hash, ed25519.getPublicKey(SEED)));
  assert.ok(!envelope.includes(Buffer.from(SEED)));
  assert.ok(!JSON.stringify(result).includes(Buffer.from(SEED).toString("hex")));
});

test("nothing is signed before connecting, and nothing that is not a hash", async () => {
  const wallet = createKeypairWallet(SEED);
  assert.equal(await wallet.signTransaction("ab".repeat(32)), undefined);
  await wallet.connect();
  assert.equal(await wallet.signTransaction("AAAA"), undefined);
  assert.equal(await wallet.signTransaction("AB".repeat(32)), undefined);
  await wallet.disconnect();
  assert.equal(await wallet.accountId(), undefined);
});

test("a seed of the wrong length is refused", () => {
  assert.throws(() => createKeypairWallet(new Uint8Array(31)));
});
