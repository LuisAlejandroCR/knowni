// wallet-session.spec.ts: the wallet a person signed into is readable by the
// journey (J1), and the consent button names what pressing it does (J2).

import { test } from "node:test";
import assert from "node:assert/strict";
import { clearWalletSession, setWalletSession, subscribeWalletSession, walletSession } from "../../src/domain/wallet-session.ts";
import { consentAction, xlmFromStroops } from "../../src/domain/payment-text.ts";
import { createDeviceWallet } from "../../src/domain/wallet-port.ts";

const port = createDeviceWallet("GAZONAKJ7XIJVQI37HR2ZZKMQIISUIFAYXVCXJOCXVGQQNGM24BF2UZD");

test("J1: a stored wallet is read back, announced, and gone once cleared", () => {
  let heard = 0;
  const stop = subscribeWalletSession(() => (heard += 1));
  setWalletSession(port);
  assert.equal(walletSession(), port);
  clearWalletSession();
  assert.equal(walletSession(), undefined);
  stop();
  setWalletSession(port);
  assert.equal(heard, 2);
  clearWalletSession();
});

test("stroops read as XLM without trailing zeros or float drift", () => {
  assert.equal(xlmFromStroops("12000000"), "1.2");
  assert.equal(xlmFromStroops("10000000"), "1");
  assert.equal(xlmFromStroops("1"), "0.0000001");
  assert.equal(xlmFromStroops("123456789012"), "12345.6789012");
});

const PAID = { paymentRequired: true, amountStroops: "12000000", asset: "XLM" } as const;

test("J2: the consent button names what it does in every state", () => {
  assert.deepEqual(consentAction({ blocker: "Elige al menos una fuente", price: undefined, walletConnected: false }), {
    kind: "blocked",
    label: "Elige al menos una fuente",
  });
  assert.deepEqual(consentAction({ blocker: undefined, price: undefined, walletConnected: false }), {
    kind: "issue",
    label: "Autorizar y consultar",
  });
  assert.deepEqual(
    consentAction({ blocker: undefined, price: { paymentRequired: false }, walletConnected: false }),
    { kind: "issue", label: "Autorizar y consultar" },
  );
  assert.deepEqual(consentAction({ blocker: undefined, price: PAID, walletConnected: true }), {
    kind: "issue",
    label: "Pagar 1.2 XLM y consultar",
  });
  assert.deepEqual(consentAction({ blocker: undefined, price: PAID, walletConnected: false }), {
    kind: "connect",
    label: "Conectar wallet para pagar",
  });
});
