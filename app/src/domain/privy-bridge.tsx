// privy-bridge.tsx: the only file that touches Privy's React hooks.
// Turns them into the plain interfaces the wallet and the session use, so both
// stay testable under Node where no hook can run.

import { useCallback, useRef } from "react";
import { usePrivy, useEmbeddedWallet } from "@privy-io/expo";
import { useLoginWithPasskey } from "@privy-io/expo/passkey";
import { useCreateWallet, useSignRawHash } from "@privy-io/expo/extended-chains";
import type { PrivyBridge } from "./wallet-port-bridge.ts";

export function usePrivyBridge(): PrivyBridge {
  const { user, logout } = usePrivy();
  const { loginWithPasskey } = useLoginWithPasskey();
  const { createWallet } = useCreateWallet();
  const { signRawHash } = useSignRawHash();
  useEmbeddedWallet();

  // The user a login just returned. The hook's `user` only catches up on the
  // next render, and the wallet asks for the address in the same call.
  const justLoggedIn = useRef<typeof user>(undefined);

  const stellarAddress = useCallback(async () => {
    const current = justLoggedIn.current ?? user;
    const accounts = (current?.linked_accounts ?? []) as { type?: string; chain_type?: string; address?: string }[];
    return accounts.find((account) => account.chain_type === "stellar")?.address;
  }, [user]);

  return {
    loginWithPasskey: async () => {
      const loggedIn = await loginWithPasskey({ relyingParty: process.env.EXPO_PUBLIC_PRIVY_RP ?? "" });
      justLoggedIn.current = loggedIn ?? undefined;
      return loggedIn !== undefined;
    },
    stellarAddress,
    createStellarWallet: async () => {
      const { wallet } = await createWallet({ chainType: "stellar" });
      return wallet.address;
    },
    signRawHash: async (address: string, hashHex: string) => {
      const { signature } = await signRawHash({
        address,
        chainType: "stellar",
        hash: hashHex as `0x${string}`,
      });
      return signature;
    },
    logout: async () => {
      justLoggedIn.current = undefined;
      await logout();
    },
  };
}
