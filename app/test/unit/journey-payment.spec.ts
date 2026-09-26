// journey-payment.spec.ts: the journey pays first and only then queries (J3–J6).
// A payment that is not accepted by the network never reaches /issue, and the
// hash of one that is stays in the journey until it is reset.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { toHex } from "@knowni/core";
import { DEMO_ISSUER, demoResults, issuerRegistry } from "../../src/domain/demo-issuer.ts";
import { flowState, issue, reset, setConsent, setSubject, subscribeFlow, type IssuingStage } from "../../src/domain/flow.ts";
import { clearWalletSession, setWalletSession } from "../../src/domain/wallet-session.ts";
import type { PayerWalletPort } from "../../src/domain/wallet-port.ts";
import type { SessionRequest } from "@knowni/core";
import { SIGNER_ACCOUNT, signHash } from "../support/signer.ts";

const TREASURY = "GAZONAKJ7XIJVQI37HR2ZZKMQIISUIFAYXVCXJOCXVGQQNGM24BF2UZD";
const REFERENCE = "ab".repeat(32);
const TX = "22".repeat(32);
const BASE = "https://issuer.example";
const HORIZON = "https://horizon.example";

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

const quoteBody = (paymentRequired: boolean) => ({
  quote: { currency: "XLM", totalMinor: 120, paymentRef: REFERENCE, expiresAt: Math.floor(Date.now() / 1000) + 600 },
  paymentRequired,
  ...(paymentRequired
    ? {
        payment: {
          network: "testnet",
          destination: TREASURY,
          asset: { type: "native" },
          amountStroops: "12000000",
          paymentRef: REFERENCE,
        },
      }
    : {}),
});

// A fake issuer and Horizon: /issue answers with results signed by the key /keys
// serves, so the phone's own verification passes as it would against the real one.
function network(paymentRequired: boolean) {
  const paths: string[] = [];
  let issueBody: { paymentTx?: string; request: SessionRequest } | undefined;
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const { pathname } = new URL(String(url));
    paths.push(pathname);
    if (pathname === "/keys") {
      const key = issuerRegistry(undefined).publicKeyOf(DEMO_ISSUER)!;
      return new Response(JSON.stringify({ issuerId: DEMO_ISSUER, publicKey: toHex(key) }), { status: 200 });
    }
    if (pathname === "/quote") return new Response(JSON.stringify(quoteBody(paymentRequired)), { status: 200 });
    if (pathname.startsWith("/accounts/")) return new Response(JSON.stringify({ sequence: "7" }), { status: 200 });
    if (pathname === "/transactions") return new Response(JSON.stringify({ hash: TX }), { status: 200 });
    issueBody = JSON.parse(String(init?.body)) as typeof issueBody;
    const answers = [
      { predicate: "personhood", value: true, source: "registraduria", provenance: "observed", doesNotEstimate: "No dice quién es." },
    ] as const;
    const results = demoResults(issueBody!.request, answers, Math.floor(Date.now() / 1000));
    return new Response(JSON.stringify({ results, sourceStates: [] }), { status: 200 });
  }) as typeof fetch;
  return { fetchImpl, paths, issued: () => issueBody };
}

const options = (fetchImpl: typeof fetch) => ({ baseUrl: BASE, horizonUrl: HORIZON, fetchImpl });

beforeEach(() => {
  reset();
  clearWalletSession();
  setConsent(["registraduria"]);
  setSubject({ documentKind: "CC", documentNumber: "1020304050" });
});

test("J3: with payment required the journey quotes, pays on Horizon and only then issues", async () => {
  setWalletSession(wallet());
  const { fetchImpl, paths, issued } = network(true);
  await issue(options(fetchImpl));
  assert.deepEqual(paths, ["/keys", "/quote", `/accounts/${SIGNER_ACCOUNT}`, "/transactions", "/issue"]);
  assert.equal(issued()?.paymentTx, TX);
  assert.equal(flowState().step, "review");
  assert.equal(flowState().error, undefined);
});

test("J3: a quote that declares charging off issues without touching Horizon", async () => {
  const { fetchImpl, paths, issued } = network(false);
  await issue(options(fetchImpl));
  assert.deepEqual(paths, ["/keys", "/quote", "/issue"]);
  assert.equal(issued()?.paymentTx, undefined);
  assert.equal(flowState().step, "review");
  assert.equal(flowState().paymentTx, undefined);
});

test("J3: payment required and no wallet connected: nothing is signed and /issue is never called", async () => {
  const { fetchImpl, paths } = network(true);
  await issue(options(fetchImpl));
  assert.deepEqual(paths, ["/keys", "/quote"]);
  assert.equal(flowState().step, "consent");
  assert.match(flowState().error ?? "", /wallet no está conectada/);
});

test("J4: a rejected signature returns to consent with its typed reason and no issuance", async () => {
  setWalletSession(wallet(false));
  const { fetchImpl, paths } = network(true);
  await issue(options(fetchImpl));
  assert.equal(paths.includes("/issue"), false);
  assert.equal(paths.includes("/transactions"), false);
  assert.equal(flowState().step, "consent");
  assert.equal(flowState().paymentTx, undefined);
  assert.match(flowState().error ?? "", /no firmó/);
  assert.match(flowState().error ?? "", /No se consultó ninguna fuente/);
  assert.doesNotMatch(flowState().error ?? "", /error/i);
});

test("J5: the stages run paying → querying, and the hash is in the state before /issue", async () => {
  setWalletSession(wallet());
  const { fetchImpl } = network(true);
  const seen: { stage: IssuingStage | undefined; paymentTx: string | undefined }[] = [];
  const stop = subscribeFlow(() => {
    const { stage, paymentTx } = flowState();
    const last = seen.at(-1);
    if (last?.stage !== stage || last?.paymentTx !== paymentTx) seen.push({ stage, paymentTx });
  });
  await issue(options(fetchImpl));
  stop();
  assert.deepEqual(
    seen.map((entry) => entry.stage),
    ["quoting", "paying", "querying", undefined],
  );
  assert.equal(seen.find((entry) => entry.stage === "querying")?.paymentTx, TX);
});

test("J6: the payment hash survives issuance and sharing, and a reset clears it", async () => {
  setWalletSession(wallet());
  const { fetchImpl } = network(true);
  await issue(options(fetchImpl));
  assert.equal(flowState().paymentTx, TX);
  reset();
  assert.equal(flowState().paymentTx, undefined);
});
