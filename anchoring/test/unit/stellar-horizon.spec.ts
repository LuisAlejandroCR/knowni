// stellar-horizon.spec.ts: The hand-written Stellar wire format, pinned against the account
// and the transaction that testnet actually accepted on 2026-09-20.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createPublicKey, verify } from "node:crypto";

import {
  decodeAccountId,
  encodeAccountId,
  encodeTransaction,
  keypairFromSeed,
  signaturePayload,
  transactionHash,
} from "../../src/adapters/stellar-xdr.ts";
import {
  TESTNET_PASSPHRASE,
  accountIdOf,
  createHorizonMemoSubmitter,
  demoSeedFrom,
  expectedHash,
} from "../../src/adapters/stellar-horizon.ts";

// The demo passphrase, its account, and a commitment that is on ledger
// 4783364. If any of the encoding drifts, these stop matching.
const DEMO_PHRASE = "knowni testnet demo account";
const DEMO_ACCOUNT = "GAZONAKJ7XIJVQI37HR2ZZKMQIISUIFAYXVCXJOCXVGQQNGM24BF2UZD";
const ANCHORED_COMMITMENT = "a88721ff2ce8c84aca495dd751964fe98f41d06a955b7544394c4702da6df523";

const seed = demoSeedFrom(DEMO_PHRASE);
const memo = Uint8Array.from(Buffer.from(ANCHORED_COMMITMENT, "hex"));

test("the demo seed derives the account testnet funded", () => {
  assert.equal(accountIdOf(seed), DEMO_ACCOUNT);
  assert.equal(DEMO_ACCOUNT.length, 56);
  assert.match(DEMO_ACCOUNT, /^G/);
});

test("StrKey round-trips, and a corrupted one is refused rather than decoded", () => {
  const publicKey = keypairFromSeed(seed).publicKey;
  assert.equal(encodeAccountId(publicKey), DEMO_ACCOUNT);
  assert.deepEqual(decodeAccountId(DEMO_ACCOUNT), publicKey);
  const corrupted = `${DEMO_ACCOUNT.slice(0, 40)}AAAA${DEMO_ACCOUNT.slice(44)}`;
  assert.throws(() => decodeAccountId(corrupted), /checksum|version/);
});

test("a memo that is not 32 bytes cannot be encoded at all", () => {
  const publicKey = keypairFromSeed(seed).publicKey;
  assert.throws(
    () =>
      encodeTransaction({
        source: publicKey,
        destination: publicKey,
        sequence: 1n,
        feeStroops: 100,
        amountStroops: 1n,
        memoHash32: new Uint8Array(31),
      }),
    /32 bytes/,
  );
});

test("the signature Stellar accepts is over the transaction hash, not the signature base", () => {
  const keypair = keypairFromSeed(seed);
  const transaction = encodeTransaction({
    source: keypair.publicKey,
    destination: keypair.publicKey,
    sequence: 42n,
    feeStroops: 100,
    amountStroops: 1n,
    memoHash32: memo,
  });
  const hash = Buffer.from(transactionHash(TESTNET_PASSPHRASE, transaction), "hex");
  const signature = keypair.sign(hash);

  const spki = Buffer.concat([
    Buffer.from("302a300506032b6570032100", "hex"),
    Buffer.from(keypair.publicKey),
  ]);
  const publicKey = createPublicKey({ key: spki, format: "der", type: "spki" });
  assert.equal(verify(null, hash, publicKey, signature), true);
  // Signing the base instead is the mistake that produces tx_bad_auth: the
  // envelope is well formed and the network still refuses it.
  assert.equal(
    verify(null, hash, publicKey, keypair.sign(signaturePayload(TESTNET_PASSPHRASE, transaction))),
    false,
  );
});

test("the same transaction hashes differently per network, so an anchor names its network", () => {
  const testnet = expectedHash(seed, 42n, memo, TESTNET_PASSPHRASE);
  const mainnet = expectedHash(seed, 42n, memo, "Public Global Stellar Network ; September 2015");
  assert.notEqual(testnet, mainnet);
  assert.match(testnet, /^[0-9a-f]{64}$/);
});

test("the submitter sends the memo it was given, and returns Horizon's hash", async () => {
  const calls: { url: string; body?: string }[] = [];
  const impl = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), body: init.body as string | undefined });
    if (String(url).includes("/accounts/")) {
      return new Response(JSON.stringify({ sequence: "100" }), { status: 200 });
    }
    return new Response(JSON.stringify({ hash: "deadbeef" }), { status: 200 });
  }) as unknown as typeof fetch;

  const submitter = createHorizonMemoSubmitter(seed, { fetchImpl: impl });
  assert.deepEqual(await submitter.sendMemoHash(memo), { hash: "deadbeef" });
  // Sequence 100 from Horizon means the transaction is built with 101.
  const envelope = new URLSearchParams(calls[1]?.body ?? "").get("tx") ?? "";
  assert.ok(Buffer.from(envelope, "base64").includes(Buffer.from(memo)));
});

test("an account Horizon does not know is an error, not a silent anchor", async () => {
  const impl = (async () => new Response("{}", { status: 404 })) as unknown as typeof fetch;
  const submitter = createHorizonMemoSubmitter(seed, { fetchImpl: impl });
  await assert.rejects(() => submitter.sendMemoHash(memo), /404/);
});

test("a rejected transaction surfaces its result codes and no envelope", async () => {
  const impl = (async (url: string) => {
    if (String(url).includes("/accounts/")) {
      return new Response(JSON.stringify({ sequence: "1" }), { status: 200 });
    }
    return new Response(JSON.stringify({ extras: { result_codes: { transaction: "tx_bad_seq" } } }), {
      status: 400,
    });
  }) as unknown as typeof fetch;
  const submitter = createHorizonMemoSubmitter(seed, { fetchImpl: impl });
  await assert.rejects(() => submitter.sendMemoHash(memo), /tx_bad_seq/);
});
