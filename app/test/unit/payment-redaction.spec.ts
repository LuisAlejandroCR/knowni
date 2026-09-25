// payment-redaction.spec.ts: criterio P7 — lo que el pago publica hacia afuera.
// Un `PaymentResult` viaja a la pantalla, a un reporte o a un log, así que lo
// que se fija aquí es su serialización: hash de red sí, firma, sobre, llave de
// la contraparte y respuesta cruda de Horizon no. La consola queda interceptada
// en todos los caminos, porque un `console.error` de depuración es la fuga que
// una revisión de código deja pasar.

import { test } from "node:test";
import assert from "node:assert/strict";
import { payQuote, type PaymentResult, type PaymentTerms } from "../../src/domain/stellar-payment.ts";
import type { PayerWalletPort } from "../../src/domain/wallet-port.ts";
import { SIGNER_ACCOUNT, signHash } from "../support/signer.ts";

const DESTINATION = "GCKFBEIYV2U22IO2BJ4KVJOIP7XPWQGQFKKWXR6DOSJBV7STMAQSMTGG";
const SIGNATURE = "9f".repeat(64);
const HORIZON_BODY = JSON.stringify({
  hash: "cd".repeat(32),
  envelope_xdr: "AAAAAgAAAAA=",
  result_xdr: "AAAAAAAAAGQAAAAA",
  extras: { result_codes: { transaction: "tx_bad_seq" } },
});
const TERMS: PaymentTerms = {
  network: "testnet",
  destination: DESTINATION,
  asset: { type: "native" },
  amountStroops: "12000000",
  paymentRef: "ab".repeat(32),
};

// Everything an operator could end up reading: the console in all its methods.
function recording() {
  const methods = ["log", "info", "warn", "error", "debug"] as const;
  const written: string[] = [];
  const saved = methods.map((name) => [name, console[name].bind(console)] as const);
  for (const name of methods) {
    console[name] = ((...args: unknown[]) => {
      written.push(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "));
    }) as typeof console.log;
  }
  return {
    written,
    restore: () => {
      for (const [name, fn] of saved) console[name] = fn;
    },
  };
}

const wallet = (): PayerWalletPort => ({
  id: "privy",
  label: "Privy",
  signingMethod: "raw_hash",
  accountId: async () => SIGNER_ACCOUNT,
  connect: async () => SIGNER_ACCOUNT,
  signTransaction: async (hash) => (signed = signHash(hash)),
  disconnect: async () => {},
});

let submitted = "";
// The real signature of the last payment; secret like the fixed one above.
let signed = "";

function horizon(submit: () => Promise<Response>): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("/accounts/")) return new Response(JSON.stringify({ sequence: "7" }), { status: 200 });
    submitted = String(init?.body ?? "");
    return await submit();
  }) as typeof fetch;
}

// Every way the module can end a payment, so no path publishes what another hides.
async function everyOutcome(): Promise<readonly PaymentResult[]> {
  const run = (fetchImpl: typeof fetch, over: Partial<Parameters<typeof payQuote>[0]> = {}) =>
    payQuote({ terms: TERMS, expiresAt: 200, nowUnix: 100, wallet: wallet(), fetchImpl, ...over });
  return [
    await run(horizon(async () => new Response(HORIZON_BODY, { status: 200 }))),
    await run(horizon(async () => new Response(HORIZON_BODY, { status: 400 }))),
    await run(
      horizon(async () => {
        throw new TypeError(`Network request failed: ${SIGNATURE}`);
      }),
    ),
    await run(horizon(async () => new Response(HORIZON_BODY, { status: 200 })), {
      wallet: { ...wallet(), signTransaction: async () => undefined },
    }),
    await run((async () => new Response("{}", { status: 404 })) as typeof fetch),
    await run(horizon(async () => new Response(HORIZON_BODY, { status: 200 })), { expiresAt: 100 }),
  ];
}

const secrets = () => [SIGNATURE, signed, submitted.slice(3), decodeURIComponent(submitted.slice(3)), DESTINATION, "envelope_xdr", "result_xdr", "tx_bad_seq"];

test("no payment result carries the signature, the envelope or Horizon's body", async () => {
  const results = await everyOutcome();
  const serialized = JSON.stringify(results);
  assert.ok(submitted.length > 0, "the submission body was never captured");
  for (const secret of secrets()) {
    assert.ok(secret.length > 0);
    assert.ok(!serialized.includes(secret), `"${secret.slice(0, 24)}…" reached a public payment result`);
  }
  // What a result may say: the network hash of an accepted payment, and a reason.
  assert.deepEqual(results[0], { status: "paid", txHash: "cd".repeat(32) });
  assert.deepEqual(
    results.slice(1).map((result) => Object.keys(result).sort()),
    Array.from({ length: 5 }, () => ["reason", "status"]),
  );
});

test("no payment path writes anything to the console", async () => {
  const console = recording();
  try {
    await everyOutcome();
  } finally {
    console.restore();
  }
  assert.deepEqual(console.written, []);
});

test("a wallet that throws with the signature inside never leaks it out of payQuote", async () => {
  const console = recording();
  let result: PaymentResult;
  try {
    result = await payQuote({
      terms: TERMS,
      expiresAt: 200,
      nowUnix: 100,
      wallet: {
        ...wallet(),
        signTransaction: async () => {
          throw new Error(`signer blew up with ${SIGNATURE}`);
        },
      },
      fetchImpl: horizon(async () => new Response(HORIZON_BODY, { status: 200 })),
    });
  } finally {
    console.restore();
  }
  assert.deepEqual(result, { status: "failed", reason: "wallet_rejected" });
  assert.deepEqual(console.written, []);
});
