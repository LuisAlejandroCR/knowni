// wallet-session.ts: the payer wallet connected in /firma, shared with the journey.
// Held in memory only: the seed stays sealed where cavos-control keeps it (D-88).

import { useSyncExternalStore } from "react";
import type { PayerWalletPort } from "./wallet-port.ts";

export interface WalletSession {
  readonly wallet: PayerWalletPort;
  readonly account: string;
}

let session: WalletSession | undefined;
const listeners = new Set<() => void>();

function publish(next: WalletSession | undefined): void {
  session = next;
  for (const listener of listeners) listener();
}

export const connectWalletSession = (wallet: PayerWalletPort, account: string): void => publish({ wallet, account });
export const clearWalletSession = (): void => publish(undefined);
export const currentWalletSession = (): WalletSession | undefined => session;

export function subscribeWalletSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWalletSession(): WalletSession | undefined {
  return useSyncExternalStore(subscribeWalletSession, currentWalletSession, currentWalletSession);
}
