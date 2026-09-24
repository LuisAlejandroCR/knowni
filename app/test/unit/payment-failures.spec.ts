// payment-failures.spec.ts: criterio P6 — cada modo de fallo del pago tiene su
// propia razón. stellar-payment.spec.ts ya cubre cotización vencida, rechazo de
// wallet y cuenta ausente; aquí quedan los dos que faltaban —rechazo de Horizon
// y caída de red— y la separación entre ellos, que es lo que el criterio pide.

import { test } from "node:test";
import assert from "node:assert/strict";
import { payQuote, type PaymentResult, type PaymentTerms } from "../../src/domain/stellar-payment.ts";
import type { PayerWalletPort } from "../../src/domain/wallet-port.ts";

const ACCOUNT = "GAZONAKJ7XIJVQI37HR2ZZKMQIISUIFAYXVCXJOCXVGQQNGM24BF2UZD";
const TERMS: PaymentTerms = {
  network: "testnet",
  destination: ACCOUNT,
  asset: { type: "native" },
  amountStroops: "12000000",
  paymentRef: "ab".repeat(32),
};

const wallet = (): PayerWalletPort => ({
  id: "privy",
  label: "Privy",
  signingMethod: "raw_hash",
  accountId: async () => ACCOUNT,
  connect: async () => ACCOUNT,
  signTransaction: async () => "11".repeat(64),
  disconnect: async () => {},
});

const ACCOUNT_OK = new Response(JSON.stringify({ sequence: "7" }), { status: 200 });
const isAccountLookup = (url: string | URL | Request) => String(url).includes("/accounts/");

// Horizon answers twice per payment: the account lookup and the submission.
// `submit` decides the second one, so a test names only what it is about.
function horizon(submit: () => Promise<Response>): typeof fetch {
  return (async (url: string | URL | Request) =>
    isAccountLookup(url) ? ACCOUNT_OK.clone() : await submit()) as typeof fetch;
}

const pay = (fetchImpl: typeof fetch): Promise<PaymentResult> =>
  payQuote({ terms: TERMS, expiresAt: 200, nowUnix: 100, wallet: wallet(), fetchImpl });

test("Horizon refusing the envelope is its own reason", async () => {
  const result = await pay(
    horizon(async () => new Response(JSON.stringify({ title: "Transaction Failed" }), { status: 400 })),
  );
  assert.deepEqual(result, { status: "failed", reason: "horizon_rejected" });
});

test("an accepted submission without a hash is a rejection, not a payment", async () => {
  const result = await pay(horizon(async () => new Response("{}", { status: 200 })));
  assert.deepEqual(result, { status: "failed", reason: "horizon_rejected" });
});

test("the network falling away during submission is unreachable, not a rejection", async () => {
  const result = await pay(
    horizon(async () => {
      throw new TypeError("Network request failed");
    }),
  );
  assert.deepEqual(result, { status: "failed", reason: "unreachable" });
});

test("the network falling away before the account is read is unreachable too", async () => {
  const dead = (async () => {
    throw new TypeError("Network request failed");
  }) as typeof fetch;
  assert.deepEqual(await pay(dead), { status: "failed", reason: "unreachable" });
});

test("Horizon down on the account lookup never becomes account_not_found", async () => {
  const down = (async (url: string | URL | Request) =>
    isAccountLookup(url) ? new Response("<html>502</html>", { status: 502 }) : ACCOUNT_OK.clone()) as typeof fetch;
  assert.deepEqual(await pay(down), { status: "failed", reason: "unreachable" });
});

test("a wallet that cannot sign is refused before any network call", async () => {
  let called = false;
  const result = await payQuote({
    terms: TERMS,
    expiresAt: 200,
    nowUnix: 100,
    wallet: { ...wallet(), signingMethod: "unsupported" },
    fetchImpl: (async () => {
      called = true;
      throw new Error("must not run");
    }) as typeof fetch,
  });
  assert.deepEqual(result, { status: "failed", reason: "wallet_not_connected" });
  assert.equal(called, false);
});

test("the five failures the criterion separates never collapse into one reason", async () => {
  const expired = await payQuote({ terms: TERMS, expiresAt: 100, nowUnix: 100, wallet: wallet() });
  const rejected = await payQuote({
    terms: TERMS,
    expiresAt: 200,
    nowUnix: 100,
    wallet: { ...wallet(), signTransaction: async () => undefined },
    fetchImpl: horizon(async () => ACCOUNT_OK.clone()),
  });
  const missing = await pay((async () => new Response("{}", { status: 404 })) as typeof fetch);
  const refused = await pay(horizon(async () => new Response("{}", { status: 400 })));
  const offline = await pay(
    horizon(async () => {
      throw new TypeError("Network request failed");
    }),
  );
  const reasons = [expired, rejected, missing, refused, offline].map((result) =>
    result.status === "failed" ? result.reason : "paid",
  );
  assert.deepEqual(reasons, [
    "quote_expired",
    "wallet_rejected",
    "account_not_found",
    "horizon_rejected",
    "unreachable",
  ]);
  assert.equal(new Set(reasons).size, reasons.length);
});
