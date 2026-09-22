// wallet-port.spec.ts: one port, three wallets, and a balance that does not
// depend on any of them. What is checked is the wiring and the honest failure:
// a wallet without its key configured connects to nothing.

import { test } from "node:test";
import assert from "node:assert/strict";

import { balancesOf, createDeviceWallet } from "../../src/domain/wallet-port.ts";
import { createPrivyWallet } from "../../src/domain/wallet-privy.ts";
import { createFreighterWallet } from "../../src/domain/wallet-freighter.ts";

const ACCOUNT = "GAZONAKJ7XIJVQI37HR2ZZKMQIISUIFAYXVCXJOCXVGQQNGM24BF2UZD";

test("a balance is read from Horizon by account id, whatever wallet signs", async () => {
  const impl = (async () =>
    new Response(
      JSON.stringify({ balances: [{ asset_type: "native", balance: "10000.0000000" }] }),
      { status: 200 },
    )) as unknown as typeof fetch;
  assert.deepEqual(await balancesOf(ACCOUNT, impl), [{ asset: "XLM", amount: "10000.0000000" }]);
});

test("an account nobody funded reads as empty, not as an error", async () => {
  const impl = (async () => new Response("{}", { status: 404 })) as unknown as typeof fetch;
  assert.deepEqual(await balancesOf(ACCOUNT, impl), []);
});

test("Horizon being down reads as empty too, and never throws into a screen", async () => {
  const impl = (async () => {
    throw new Error("offline");
  }) as unknown as typeof fetch;
  assert.deepEqual(await balancesOf(ACCOUNT, impl), []);
});

test("without its key a wallet connects to nothing instead of pretending", async () => {
  for (const wallet of [createPrivyWallet(undefined), createFreighterWallet(undefined)]) {
    assert.equal(await wallet.connect(), undefined);
    assert.equal(await wallet.signTransaction("AAAA"), undefined);
    assert.equal(await wallet.accountId(), undefined);
  }
});

test("a configured wallet connects, signs and disconnects through the same port", async () => {
  const privy = createPrivyWallet({
    loginWithPasskey: async () => true,
    stellarAddress: async () => ACCOUNT,
    createStellarWallet: async () => undefined,
    signRawHash: async (_address: string, hash: string) => `${hash}ff`,
    logout: async () => {},
  });
  assert.equal(await privy.connect(), ACCOUNT);
  // The hash goes in `0x`-prefixed and the signature comes back bare, which is
  // what the XDR envelope needs.
  assert.equal(await privy.signTransaction("ab".repeat(32)), `${"ab".repeat(32)}ff`);
  await privy.disconnect();
  assert.equal(await privy.accountId(), undefined);
});

test("the device wallet signs nothing, and says so", async () => {
  const device = createDeviceWallet(ACCOUNT);
  assert.equal(await device.connect(), ACCOUNT);
  assert.equal(await device.signTransaction("AAAA"), undefined);
});
