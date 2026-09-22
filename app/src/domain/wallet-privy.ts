// wallet-privy.ts: the Privy adapter of the payer wallet port.
// Privy signs Stellar as an extended chain — a raw hash, not an envelope — and
// Stellar signs the SHA-256 of the signature base, so the two meet exactly.

import type { PayerWalletPort } from "./wallet-port.ts";

export const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? "";

// What the React hooks provide, expressed as data so the adapter can be tested
// under Node, where those hooks cannot run.
import type { PrivyBridge } from "./wallet-port-bridge.ts";
export type { PrivyBridge };

export function createPrivyWallet(bridge: PrivyBridge | undefined): PayerWalletPort {
  let account: string | undefined;

  return {
    id: "privy",
    label: "Entrar con passkey",
    accountId: async () => account,

    async connect() {
      if (bridge === undefined) return undefined;
      if (!(await bridge.loginWithPasskey())) return undefined;
      // An account that exists is reused; only a first-time payer gets one
      // created, because a second wallet would split their balance.
      account = (await bridge.stellarAddress()) ?? (await bridge.createStellarWallet());
      return account;
    },

    // Takes the transaction hash — not the envelope — because that is what
    // Stellar signs and what Privy's extended chains accept.
    async signTransaction(transactionHashHex) {
      if (bridge === undefined || account === undefined) return undefined;
      if (!/^[0-9a-f]{64}$/.test(transactionHashHex)) return undefined;
      const signature = await bridge.signRawHash(account, `0x${transactionHashHex}`);
      return signature?.replace(/^0x/, "");
    },

    async disconnect() {
      account = undefined;
      await bridge?.logout();
    },
  };
}

export const privyConfigured = (): boolean => PRIVY_APP_ID !== "";
