// quote-asset.spec.ts: the quote is priced in the asset the issuer charges.
// Native XLM for the testnet demo, USDC by default; one never stands in for
// the other. See docs/plan.md X1–X4.

import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { nodeSignatures } from "@knowni/attestation/node";
import { createIssuerService } from "../../src/service.ts";
import { CURRENCY, quote, type Quote } from "../../src/pricing.ts";
import {
  assetCurrency,
  paymentAssetFromEnv,
  paymentTerms,
  type PaymentPolicy,
  type PaymentTerms,
} from "../../src/payments.ts";

const DESTINATION = "GA".padEnd(56, "X");
const USDC_ISSUER = "GB".padEnd(56, "Y");
const NOW = 1_760_000_000;
const request = {
  relyingPartyId: "notaria-17",
  purpose: "vehicle-sale",
  nonce: "ab".repeat(16),
  expiresAt: NOW + 600,
  paramsHash: "cd".repeat(32),
};

test("native charges XLM and needs no asset issuer", () => {
  assert.deepEqual(paymentAssetFromEnv({ KNOWNI_PAYMENT_ASSET: "native" }), {
    status: "configured",
    asset: { type: "native" },
  });
  assert.equal(assetCurrency({ type: "native" }), "XLM");
});

test("without the variable, or with usdc, the issuer charges USDC and requires its issuer", () => {
  const usdc = { status: "configured", asset: { type: "credit", code: "USDC", issuer: USDC_ISSUER } };
  assert.deepEqual(paymentAssetFromEnv({ KNOWNI_PAYMENT_ASSET_ISSUER: USDC_ISSUER }), usdc);
  assert.deepEqual(
    paymentAssetFromEnv({ KNOWNI_PAYMENT_ASSET: "usdc", KNOWNI_PAYMENT_ASSET_ISSUER: USDC_ISSUER }),
    usdc,
  );
  for (const env of [{}, { KNOWNI_PAYMENT_ASSET: "usdc" }, { KNOWNI_PAYMENT_ASSET_ISSUER: "" }]) {
    const result = paymentAssetFromEnv(env);
    assert.equal(result.status, "refused");
    assert.match(result.status === "refused" ? result.message : "", /KNOWNI_PAYMENT_ASSET_ISSUER/);
  }
});

test("an unknown asset refuses to start instead of falling back to a default", () => {
  for (const value of ["xlm", "NATIVE", "eurc", " ", "native,usdc"]) {
    const result = paymentAssetFromEnv({ KNOWNI_PAYMENT_ASSET: value, KNOWNI_PAYMENT_ASSET_ISSUER: USDC_ISSUER });
    assert.equal(result.status, "refused", value);
    assert.match(result.status === "refused" ? result.message : "", /KNOWNI_PAYMENT_ASSET/);
  }
});

test("the quote carries the currency it is given, USDC by default", () => {
  const byDefault = quote(request, ["personhood"], NOW);
  const inXlm = quote(request, ["personhood"], NOW, 600, "XLM");
  assert.equal(byDefault.status === "quoted" && byDefault.quote.currency, CURRENCY);
  assert.equal(CURRENCY, "USDC");
  assert.equal(inXlm.status === "quoted" && inXlm.quote.currency, "XLM");
  // Same question, same price and reference: only the unit changes.
  if (byDefault.status !== "quoted" || inXlm.status !== "quoted") throw new Error("not quoted");
  assert.equal(inXlm.quote.totalMinor, byDefault.quote.totalMinor);
  assert.equal(inXlm.quote.paymentRef, byDefault.quote.paymentRef);
});

test("terms refuse a quote in one asset paid in another, both ways", () => {
  const native: PaymentPolicy = { destination: DESTINATION, minAmountStroops: 1n, asset: { type: "native" } };
  const usdc: PaymentPolicy = {
    destination: DESTINATION,
    minAmountStroops: 1n,
    asset: { type: "credit", code: "USDC", issuer: USDC_ISSUER },
  };
  assert.equal(paymentTerms(120, "ab".repeat(32), "XLM", native).asset.type, "native");
  assert.throws(() => paymentTerms(120, "ab".repeat(32), "USDC", native), /does not match/);
  assert.throws(() => paymentTerms(120, "ab".repeat(32), "XLM", usdc), /does not match/);
});

interface QuoteBody {
  readonly quote: Quote;
  readonly paymentRequired: boolean;
  readonly payment?: PaymentTerms;
}

async function postQuote(payments: PaymentPolicy | undefined) {
  const server = createIssuerService({
    apiKey: "provider-key",
    issuerId: "issuer",
    seed: nodeSignatures.randomSeed(),
    access: { keys: new Set(["notaria-key"]) },
    payments,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/quote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request, predicates: ["personhood", "capacity"] }),
    });
    return { status: response.status, body: (await response.json()) as QuoteBody };
  } finally {
    server.close();
  }
}

test("/quote with a native treasury publishes XLM terms", async () => {
  const { status, body } = await postQuote({
    destination: DESTINATION,
    minAmountStroops: 1n,
    asset: { type: "native" },
  });
  assert.equal(status, 200);
  assert.equal(body.quote.currency, "XLM");
  assert.equal(body.paymentRequired, true);
  assert.deepEqual(body.payment?.asset, { type: "native" });
  assert.equal(body.payment?.destination, DESTINATION);
  assert.equal(body.payment?.amountStroops, "24000000");
  assert.equal(body.payment?.paymentRef, body.quote.paymentRef);
});

test("/quote with a USDC treasury publishes USDC terms, as before", async () => {
  const { status, body } = await postQuote({
    destination: DESTINATION,
    minAmountStroops: 1n,
    asset: { type: "credit", code: "USDC", issuer: USDC_ISSUER },
  });
  assert.equal(status, 200);
  assert.equal(body.quote.currency, "USDC");
  assert.deepEqual(body.payment?.asset, { type: "credit", code: "USDC", issuer: USDC_ISSUER });
});

test("/quote without a treasury stays free and in USDC", async () => {
  const { status, body } = await postQuote(undefined);
  assert.equal(status, 200);
  assert.equal(body.quote.currency, "USDC");
  assert.equal(body.paymentRequired, false);
  assert.equal(body.payment, undefined);
});
