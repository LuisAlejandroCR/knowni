// wallet-freighter.ts: the Freighter adapter, over WalletConnect.
// Freighter ships iOS and Android apps and integrates with a mobile app
// through WalletConnect, not through the browser extension API.

import type { PayerWalletPort } from "./wallet-port.ts";

export const WALLETCONNECT_PROJECT_ID = process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export interface WalletConnectBridge {
  pair(): Promise<{ readonly address: string } | undefined>;
  signStellarTransaction(xdr: string): Promise<string | undefined>;
  close(): Promise<void>;
}

export function createFreighterWallet(bridge: WalletConnectBridge | undefined): PayerWalletPort {
  let account: string | undefined;
  return {
    id: "freighter",
    label: "Ya tengo wallet (Freighter)",
    accountId: async () => account,
    async connect() {
      if (bridge === undefined) return undefined;
      const session = await bridge.pair();
      account = session?.address;
      return account;
    },
    async signTransaction(unsignedXdr) {
      if (bridge === undefined || account === undefined) return undefined;
      return bridge.signStellarTransaction(unsignedXdr);
    },
    async disconnect() {
      account = undefined;
      await bridge?.close();
    },
  };
}

export const freighterConfigured = (): boolean => WALLETCONNECT_PROJECT_ID !== "";
