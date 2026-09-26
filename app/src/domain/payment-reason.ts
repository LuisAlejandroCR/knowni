// payment-reason.ts: why a payment failed, in words a person can act on.
// Shared by the wallet bench and the journey, so the same failure reads the
// same wherever it happens.

import type { PaymentResult } from "./stellar-payment.ts";

export const PAYMENT_REASON: Record<Extract<PaymentResult, { status: "failed" }>["reason"], string> = {
  quote_expired: "El pago venció antes de firmarse.",
  invalid_terms: "Los términos del pago no se pudieron construir.",
  wallet_not_connected: "La wallet no está conectada.",
  account_not_found: "La cuenta no existe en testnet todavía: fondéala primero.",
  wallet_rejected: "La wallet no firmó, o su firma no es de esta cuenta sobre esta transacción.",
  horizon_rejected: "Horizon rechazó la transacción firmada.",
  unreachable: "No se pudo hablar con Horizon.",
};

export function paymentReasonText(reason: string): string {
  return (PAYMENT_REASON as Record<string, string>)[reason] ?? reason;
}
