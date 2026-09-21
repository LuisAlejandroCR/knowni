// wallet-privy.ts: the Privy adapter of the payer wallet port.
// Privy classifies Stellar as tier 2 — it signs, it does not submit — so this
// adapter only signs and the app sends the envelope to Horizon itself.

import type { PayerWalletPort } from "./wallet-port.ts";

export const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? "";

// The SDK is loaded when the app id exists, so the app builds and runs without
// a Privy account: a missing key turns the option off instead of crashing.
export interface PrivyBridge {
  login(): Promise<{ readonly address: string } | undefined>;
  signStellarTransaction(xdr: string): Promise<string | undefined>;
  logout(): Promise<void>;
}

export function createPrivyWallet(bridge: PrivyBridge | undefined): PayerWalletPort {
  let account: string | undefined;
  return {
    id: "privy",
    label: "Entrar con correo o teléfono",
    accountId: async () => account,
    async connect() {
      if (bridge === undefined) return undefined;
      const wallet = await bridge.login();
      account = wallet?.address;
      return account;
    },
    async signTransaction(unsignedXdr) {
      if (bridge === undefined || account === undefined) return undefined;
      return bridge.signStellarTransaction(unsignedXdr);
    },
    async disconnect() {
      account = undefined;
      await bridge?.logout();
    },
  };
}

export const privyConfigured = (): boolean => PRIVY_APP_ID !== "";
