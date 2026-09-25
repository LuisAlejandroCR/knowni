// self-payment.ts: the smallest real payment a wallet can make — 1 XLM to itself.
// It proves a wallet signs a Stellar transaction the network accepts, without
// needing an issuer, a quote or a counterparty.

import type { PaymentTerms } from "./stellar-payment.ts";

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export const SELF_PAYMENT_STROOPS = "10000000";

// The reference is random so two runs are two transactions, not one replayed.
export function selfPaymentTerms(account: string, reference: Uint8Array): PaymentTerms {
  if (reference.length !== 32) throw new TypeError("invalid reference");
  return {
    network: "testnet",
    destination: account,
    asset: { type: "native" },
    amountStroops: SELF_PAYMENT_STROOPS,
    paymentRef: toHex(reference),
  };
}

export const explorerUrl = (txHash: string): string => `https://stellar.expert/explorer/testnet/tx/${txHash}`;
