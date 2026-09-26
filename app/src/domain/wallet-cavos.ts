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

// The login token inside what Cavos's email-code endpoint returns: a bare JWT,
// or JSON carrying it as id_token, jwt or token. Mirrors the kit's own parse,
// because NativeCavosAuth reads the token but never hands it to the registry.
export function tokenFromAuthData(data: string): string | undefined {
  let token = data;
  try {
    const parsed = JSON.parse(data) as { id_token?: string; jwt?: string; token?: string };
    token = parsed.id_token ?? parsed.jwt ?? parsed.token ?? data;
  } catch {
    // Not JSON: the data is the token itself.
  }
  return token.split(".").length === 3 ? token : undefined;
}
