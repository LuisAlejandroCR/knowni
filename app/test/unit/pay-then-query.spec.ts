// pay-then-query.spec.ts: criterios Q2–Q5 — the journey pays the quote before
// the issuer queries any source, and a failed payment consults nothing.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { SessionRequest } from "@knowni/core";
import { toHex } from "@knowni/core";
import { DEMO_ISSUER, demoRegistry, demoResults } from "../../src/domain/demo-issuer.ts";
import { flowState, issue, loadPrice, reset, setConsent, setSubject, subscribeFlow, type IssueStage } from "../../src/domain/flow.ts";
import { xlmFromStroops } from "../../src/domain/payment-copy.ts";
import type { PayerWalletPort } from "../../src/domain/wallet-port.ts";
import { SIGNER_ACCOUNT, signHash } from "../support/signer.ts";

const TREASURY = "GAZONAKJ7XIJVQI37HR2ZZKMQIISUIFAYXVCXJOCXVGQQNGM24BF2UZD";
const TX = "22".repeat(32);

function wallet(signs = true): PayerWalletPort {
  return {
    id: "device",
    label: "Llave del dispositivo",
    signingMethod: "raw_hash",
    accountId: async () => SIGNER_ACCOUNT,
    connect: async () => SIGNER_ACCOUNT,
    signTransaction: async (hash) => (signs ? signHash(hash) : undefined),
    disconnect: async () => {},
  };
}

function quoteBody(paymentRequired: boolean) {
  const reference = "ab".repeat(32);
  return {
    quote: { currency: "XLM", totalMinor: 25, paymentRef: reference, expiresAt: Math.floor(Date.now() / 1000) + 600 },
    paymentRequired,
    ...(paymentRequired
      ? {
          payment: {
            network: "testnet",
            destination: TREASURY,
            asset: { type: "native" },
            amountStroops: "25000000",
            paymentRef: reference,
          },
        }
      : {}),
  };
}

// A fake issuer and Horizon behind one fetch: it records every path and signs
// /issue answers with the demo issuer key the app trusts under test.
function network(options: { paymentRequired: boolean; horizonAccepts?: boolean }) {
  const paths: string[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    paths.push(path);
    if (path === "/keys") {
      const key = demoRegistry().publicKeyOf(DEMO_ISSUER)!;
      return new Response(JSON.stringify({ issuerId: DEMO_ISSUER, publicKey: toHex(key) }), { status: 200 });
    }
    if (path === "/quote") return new Response(JSON.stringify(quoteBody(options.paymentRequired)), { status: 200 });
    if (path.startsWith("/accounts/")) return new Response(JSON.stringify({ sequence: "7" }), { status: 200 });
    if (path === "/transactions") {
      return options.horizonAccepts === false
        ? new Response("{}", { status: 400 })
        : new Response(JSON.stringify({ hash: TX }), { status: 200 });
    }
    const { request } = JSON.parse(String(init?.body)) as { request: SessionRequest };
    const results = demoResults(
      request,
      [{ predicate: "personhood", value: true, source: "registraduria", provenance: "observed", doesNotEstimate: "No dice quién es." }],
      Math.floor(Date.now() / 1000),
    );
    return new Response(JSON.stringify({ results, sourceStates: [] }), { status: 200 });
  }) as typeof fetch;
  return { paths, deps: { baseUrl: "https://issuer.example", horizonUrl: "https://horizon.example", fetchImpl } };
}

beforeEach(() => {
  reset();
  setConsent(["registraduria"]);
  setSubject({ documentNumber: "1020304050" });
});

test("Q2: the quoted total reads in XLM from integer stroops", () => {
  assert.equal(xlmFromStroops("25000000"), "2.5");
  assert.equal(xlmFromStroops("10000000"), "1");
  assert.equal(xlmFromStroops("1"), "0.0000001");
  assert.equal(xlmFromStroops("123456789012"), "12345.6789012");
});

test("Q2: the consent screen learns the price from /quote before anything is queried", async () => {
  const { paths, deps } = network({ paymentRequired: true });
  await loadPrice(deps);
  assert.deepEqual(flowState().price, { paymentRequired: true, stroops: "25000000" });
  assert.deepEqual(paths, ["/quote"]);
});

test("Q3: the journey pays, and only then asks the issuer to query", async () => {
  const { paths, deps } = network({ paymentRequired: true });
  await issue({ ...deps, wallet: wallet() });
  assert.deepEqual(paths, ["/keys", "/quote", `/accounts/${SIGNER_ACCOUNT}`, "/transactions", "/issue"]);
  assert.equal(flowState().step, "review");
  assert.equal(flowState().paymentTx, TX);
});

test("Q3: a rejected signature leaves the person at consent with no source queried", async () => {
  const { paths, deps } = network({ paymentRequired: true });
  await issue({ ...deps, wallet: wallet(false) });
  assert.equal(paths.includes("/issue"), false);
  assert.equal(flowState().step, "consent");
  assert.match(flowState().error ?? "", /wallet no firmó/);
  assert.match(flowState().error ?? "", /No se consultó ninguna fuente/);
  assert.equal(flowState().paymentTx, undefined);
});

test("Q3: a payment Horizon refuses consults nothing either", async () => {
  const { paths, deps } = network({ paymentRequired: true, horizonAccepts: false });
  await issue({ ...deps, wallet: wallet() });
  assert.equal(paths.includes("/issue"), false);
  assert.match(flowState().error ?? "", /Horizon rechazó/);
});

test("Q2: with a price and no wallet, nothing is signed and nothing is queried", async () => {
  const { paths, deps } = network({ paymentRequired: true });
  await issue(deps);
  assert.equal(paths.includes("/issue"), false);
  assert.equal(paths.includes("/transactions"), false);
  assert.match(flowState().error ?? "", /wallet no está conectada/);
});

test("Q3: an issuer that does not charge is queried without a payment", async () => {
  const { paths, deps } = network({ paymentRequired: false });
  await issue(deps);
  assert.deepEqual(paths, ["/keys", "/quote", "/issue"]);
  assert.equal(flowState().step, "review");
  assert.equal(flowState().paymentTx, undefined);
});

test("Q4: the emission screen can name each stage in order", async () => {
  const { deps } = network({ paymentRequired: true });
  const stages: IssueStage[] = [];
  const unsubscribe = subscribeFlow(() => {
    const { stage } = flowState();
    if (stages.at(-1) !== stage) stages.push(stage);
  });
  await issue({ ...deps, wallet: wallet() });
  unsubscribe();
  assert.deepEqual(stages, ["quoting", "signing", "querying", "idle"]);
});

test("Q5: the payment hash stays on the phone and never enters the signed results", async () => {
  const { deps } = network({ paymentRequired: true });
  await issue({ ...deps, wallet: wallet() });
  assert.equal(flowState().paymentTx, TX);
  assert.equal(JSON.stringify(flowState().results).includes(TX), false);
});
