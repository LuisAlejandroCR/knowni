// wallet-session.ts: the payer wallet a person signed into, shared by screens.
// `/firma` puts it here and the journey reads it to pay a quote; it lives in
// memory only, so the key itself stays wherever the wallet adapter keeps it.

import { useSyncExternalStore } from "react";
import type { PayerWalletPort } from "./wallet-port.ts";

let current: PayerWalletPort | undefined;
const listeners = new Set<() => void>();

function announce(): void {
  for (const listener of listeners) listener();
}

export function walletSession(): PayerWalletPort | undefined {
  return current;
}

export function setWalletSession(wallet: PayerWalletPort): void {
  current = wallet;
  announce();
}

export function clearWalletSession(): void {
  current = undefined;
  announce();
}

export function subscribeWalletSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWalletSession(): PayerWalletPort | undefined {
  return useSyncExternalStore(subscribeWalletSession, walletSession, walletSession);
}
