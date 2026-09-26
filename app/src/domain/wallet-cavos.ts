// wallet-cavos.ts: the Cavos adapter of the payer wallet port.
// Cavos keeps the Stellar key on the device and signs an unsigned envelope
// without submitting it — the same contract as Freighter, so payQuote checks it.

import type { PayerWalletPort } from "./wallet-port.ts";

export const CAVOS_APP_ID = process.env.EXPO_PUBLIC_CAVOS_APP_ID ?? "";

// What the native kit provides once a person has signed in, as data so the
// adapter runs under Node, where the kit's native module cannot load.
export interface CavosBridge {
  // The `G…` of this identity; the account may not exist on the network yet.
  address(): Promise<string | undefined>;
  signXdr(unsignedXdr: string): Promise<string | undefined>;
  logout(): Promise<void>;
}

export function createCavosWallet(bridge: CavosBridge | undefined): PayerWalletPort {
  let account: string | undefined;
  return {
    id: "cavos",
    label: "Cavos (llave en este dispositivo)",
    signingMethod: "envelope",
    accountId: async () => account,
    async connect() {
      if (bridge === undefined) return undefined;
      account = await bridge.address();
      return account;
    },
    async signTransaction(unsignedXdr) {
      if (bridge === undefined || account === undefined) return undefined;
      return bridge.signXdr(unsignedXdr);
    },
    async disconnect() {
      account = undefined;
      await bridge?.logout();
    },
  };
}

export const cavosConfigured = (): boolean => CAVOS_APP_ID !== "";
