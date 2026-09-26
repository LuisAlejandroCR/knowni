// pay-then-query.spec.ts: the main journey pays before it consults (J1–J6).
// The wallet connected on one screen signs on another, the payment settles
// before a single source is queried, and its hash stays with the verification.

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { toHex } from "@knowni/core";
import type { AttestedAnswer } from "@knowni/attestation";
import type { SessionRequest } from "@knowni/core";
import { DEMO_ISSUER, demoResults, issuerRegistry } from "../../src/domain/demo-issuer.ts";
import { getFlow, issue, loadQuote, reset, setConsent, setSubject, subscribeFlow } from "../../src/domain/flow.ts";
import { paymentAmount, requestPaidIssuance, type IssuanceInput } from "../../src/domain/issuer-client.ts";
import { connectedWallet, setWalletSession } from "../../src/domain/wallet-session.ts";
import type { PayerWalletPort } from "../../src/domain/wallet-port.ts";
import { SIGNER_ACCOUNT, signHash } from "../support/signer.ts";

const ISSUER_ACCOUNT = "GAZONAKJ7XIJVQI37HR2ZZKMQIISUIFAYXVCXJOCXVGQQNGM24BF2UZD";
const REFERENCE = "ab".repeat(32);
const TX = "22".repeat(32);

const answers: AttestedAnswer[] = [
  { predicate: "personhood", value: true, source: "registraduria", provenance: "observed", doesNotEstimate: "No dice quién es." },
];

function wallet(signs = true): PayerWalletPort {
  return {
    id: "cavos",
    label: "Cavos",
    signingMethod: "raw_hash",
    accountId: async () => SIGNER_ACCOUNT,
    connect: async () => SIGNER_ACCOUNT,
    signTransaction: async (hash) => (signs ? signHash(hash) : undefined),
    disconnect: async () => {},
  };
}

const quote = (paymentRequired: boolean) => ({
  quote: { currency: "XLM", totalMinor: 120, paymentRef: REFERENCE, expiresAt: Math.floor(Date.now() / 1000) + 600 },
  paymentRequired,
  ...(paymentRequired
    ? {
        payment: {
          network: "testnet",
          destination: ISSUER_ACCOUNT,
          asset: { type: "native" },
          amountStroops: "12000000",
          paymentRef: REFERENCE,
        },
      }
    : {}),
});

// The issuer, Horizon and nothing else, answered by path.
function network(paymentRequired: boolean) {
  const calls: string[] = [];
  let issued: { paymentTx?: string } | undefined;
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    calls.push(path);
    if (path === "/keys") {
      const key = issuerRegistry(undefined).publicKeyOf(DEMO_ISSUER)!;
      return new Response(JSON.stringify({ issuerId: DEMO_ISSUER, publicKey: toHex(key) }), { status: 200 });
    }
    if (path === "/quote") return new Response(JSON.stringify(quote(paymentRequired)), { status: 200 });
    if (path.startsWith("/accounts/")) return new Response(JSON.stringify({ sequence: "7" }), { status: 200 });
    if (path === "/transactions") return new Response(JSON.stringify({ hash: TX }), { status: 200 });
    if (path === "/issue") {
      const body = JSON.parse(String(init?.body)) as { request: SessionRequest; paymentTx?: string };
      issued = body;
      const results = demoResults(body.request, answers, Math.floor(Date.now() / 1000));
      return new Response(JSON.stringify({ results, sourceStates: [] }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
  return { calls, fetchImpl, issued: () => issued };
}

const realFetch = globalThis.fetch;

function useNetwork(paymentRequired: boolean) {
  const net = network(paymentRequired);
  globalThis.fetch = net.fetchImpl;
  return net;
}

function consentToRegistraduria(): void {
  setConsent(["registraduria"]);
  setSubject({ documentKind: "CC", documentNumber: "1020304050" });
}

beforeEach(() => {
  reset();
  setWalletSession(undefined);
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("J1: the wallet connected on one screen is read by another and survives a new journey", async () => {
  assert.equal(connectedWallet(), undefined);
  const port = wallet();
  setWalletSession({ wallet: port, account: SIGNER_ACCOUNT });
  assert.equal(connectedWallet()?.wallet, port);
  reset();
  assert.equal(connectedWallet()?.account, SIGNER_ACCOUNT);
});

test("J2: the amount shown is the one the quote published, in the asset it names", () => {
  const terms = quote(true).payment!;
  assert.equal(paymentAmount({ ...terms, asset: { type: "native" } } as never), "1.2 XLM");
  assert.equal(paymentAmount({ ...terms, amountStroops: "10000000", asset: { type: "native" } } as never), "1 XLM");
  assert.equal(paymentAmount({ ...terms, amountStroops: "5", asset: { type: "native" } } as never), "0.0000005 XLM");
  assert.equal(
    paymentAmount({ ...terms, asset: { type: "credit", code: "USDC", issuer: ISSUER_ACCOUNT } } as never),
    "1.2 USDC",
  );
});

test("J2: the consent screen reads the quote's total before anything is paid", async () => {
  const net = useNetwork(true);
  consentToRegistraduria();
  await loadQuote();
  assert.deepEqual(getFlow().quote, { status: "quoted", paymentRequired: true, amount: "1.2 XLM" });
  assert.deepEqual(net.calls, ["/quote"]);
});

test("J2: a quote with charging off is shown as free", async () => {
  useNetwork(false);
  consentToRegistraduria();
  await loadQuote();
  assert.deepEqual(getFlow().quote, { status: "quoted", paymentRequired: false, amount: undefined });
});

test("J3/J6: a paid quote is paid, then issued with its hash, and the hash stays in the state", async () => {
  const net = useNetwork(true);
  setWalletSession({ wallet: wallet(), account: SIGNER_ACCOUNT });
  consentToRegistraduria();
  await issue();
  const flow = getFlow();
  assert.equal(flow.error, undefined);
  assert.equal(flow.step, "review");
  assert.equal(flow.paymentTx, TX);
  assert.equal(net.issued()?.paymentTx, TX);
  assert.deepEqual(net.calls, ["/keys", "/quote", `/accounts/${SIGNER_ACCOUNT}`, "/transactions", "/issue"]);
});

test("J3: with charging off the journey issues without touching Horizon", async () => {
  const net = useNetwork(false);
  consentToRegistraduria();
  await issue();
  assert.equal(getFlow().step, "review");
  assert.equal(getFlow().paymentTx, undefined);
  assert.deepEqual(net.calls, ["/keys", "/quote", "/issue"]);
});

test("J4: a refused signature queries no source and says nothing was charged", async () => {
  const net = useNetwork(true);
  setWalletSession({ wallet: wallet(false), account: SIGNER_ACCOUNT });
  consentToRegistraduria();
  await issue();
  const flow = getFlow();
  assert.equal(flow.step, "consent");
  assert.equal(flow.paymentTx, undefined);
  assert.match(flow.error ?? "", /No se cobró nada y no se consultó ninguna fuente/);
  assert.equal(net.calls.includes("/issue"), false);
});

test("J4: without a connected wallet a paid quote stops before signing and issuing", async () => {
  const net = useNetwork(true);
  consentToRegistraduria();
  await issue();
  assert.equal(getFlow().step, "consent");
  assert.match(getFlow().error ?? "", /wallet/i);
  assert.deepEqual(net.calls, ["/keys", "/quote"]);
});

test("J5: the emission screen sees quoting, paying, then querying with the accepted hash", async () => {
  useNetwork(true);
  setWalletSession({ wallet: wallet(), account: SIGNER_ACCOUNT });
  consentToRegistraduria();
  const seen: string[] = [];
  const stop = subscribeFlow(() => {
    const { phase, paymentTx } = getFlow();
    const entry = `${phase}${paymentTx === undefined ? "" : `:${paymentTx.slice(0, 4)}`}`;
    if (phase !== undefined && seen.at(-1) !== entry) seen.push(entry);
  });
  await issue();
  stop();
  assert.deepEqual(seen, ["quoting", "paying", "querying:2222"]);
  assert.equal(getFlow().phase, undefined);
});

test("the coordinator reports each stage and refuses a paid quote with no wallet", async () => {
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
  const net = network(true);
  const refused = await requestPaidIssuance(input, undefined, { baseUrl: "https://issuer.example", fetchImpl: net.fetchImpl });
  assert.deepEqual(refused, { status: "failed", stage: "payment", reason: "wallet_not_connected" });
  assert.deepEqual(net.calls, ["/quote"]);
});
