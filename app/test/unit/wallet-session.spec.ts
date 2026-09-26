// wallet-session.spec.ts: criterio Q1 — the wallet connected in /firma is the
// one the journey pays with, and disconnecting forgets it everywhere.

import { test } from "node:test";
import assert from "node:assert/strict";
import { clearWalletSession, connectWalletSession, currentWalletSession, subscribeWalletSession } from "../../src/domain/wallet-session.ts";
import { createDeviceWallet } from "../../src/domain/wallet-port.ts";

const ACCOUNT = "GAZONAKJ7XIJVQI37HR2ZZKMQIISUIFAYXVCXJOCXVGQQNGM24BF2UZD";

test("a connected wallet is readable from anywhere until it is cleared", async () => {
  const wallet = createDeviceWallet(ACCOUNT);
  let notified = 0;
  const unsubscribe = subscribeWalletSession(() => {
    notified += 1;
  });

  assert.equal(currentWalletSession(), undefined);
  connectWalletSession(wallet, ACCOUNT);
  assert.equal(currentWalletSession()?.wallet, wallet);
  assert.equal(currentWalletSession()?.account, ACCOUNT);

  clearWalletSession();
  assert.equal(currentWalletSession(), undefined);
  assert.equal(notified, 2);
  unsubscribe();
});
