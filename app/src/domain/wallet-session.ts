// wallet-session.ts: the wallet a person connected, shared by every screen.
// Connected once in /firma, it signs the payment on the consent screen. It is
// held in memory only: the sealed control key of D-88 is the one thing on disk.

import { useSyncExternalStore } from "react";
import type { PayerWalletPort } from "./wallet-port.ts";

export interface WalletSession {
  readonly wallet: PayerWalletPort;
  readonly account: string;
}

let session: WalletSession | undefined;
const listeners = new Set<() => void>();

export function connectedWallet(): WalletSession | undefined {
  return session;
}

export function setWalletSession(next: WalletSession | undefined): void {
  session = next;
  for (const listener of listeners) listener();
}

export function useWalletSession(): WalletSession | undefined {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => session,
    () => session,
  );
}
