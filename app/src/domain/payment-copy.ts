// payment-copy.ts: what a person reads about a payment — the amount and why it failed.
// Amounts stay integer stroops until they become text; one XLM is 10^7 stroops.

import type { PaymentResult } from "./stellar-payment.ts";

const STROOPS_PER_XLM = 10_000_000n;

export function xlmFromStroops(stroops: string): string {
  const value = BigInt(stroops);
  const whole = value / STROOPS_PER_XLM;
  const fraction = (value % STROOPS_PER_XLM).toString().padStart(7, "0").replace(/0+$/, "");
  return fraction === "" ? whole.toString() : `${whole}.${fraction}`;
}

export const PAYMENT_REASON: Record<Extract<PaymentResult, { status: "failed" }>["reason"], string> = {
  quote_expired: "El pago venció antes de firmarse.",
  invalid_terms: "Los términos del pago no se pudieron construir.",
  wallet_not_connected: "La wallet no está conectada.",
  account_not_found: "La cuenta no existe en testnet todavía: fondéala primero.",
  wallet_rejected: "La wallet no firmó, o su firma no es de esta cuenta sobre esta transacción.",
  horizon_rejected: "Horizon rechazó la transacción firmada.",
  unreachable: "No se pudo hablar con Horizon.",
};
