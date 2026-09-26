// payment-text.ts: the words a payment is shown in, shared by `/firma` and the journey.
// Every failed payment is one of the typed reasons of P6, never "error", and
// an amount is printed from the stroops of the quote's own terms.

import type { PaymentResult } from "./stellar-payment.ts";

export type PaymentFailure = Extract<PaymentResult, { status: "failed" }>["reason"];

export const PAYMENT_REASON: Record<PaymentFailure, string> = {
  quote_expired: "El pago venció antes de firmarse.",
  invalid_terms: "Los términos del pago no se pudieron construir.",
  wallet_not_connected: "La wallet no está conectada.",
  account_not_found: "La cuenta no existe en testnet todavía: fondéala primero.",
  wallet_rejected: "La wallet no firmó, o su firma no es de esta cuenta sobre esta transacción.",
  horizon_rejected: "Horizon rechazó la transacción firmada.",
  unreachable: "No se pudo hablar con Horizon.",
};

export const paymentReasonText = (reason: string): string =>
  PAYMENT_REASON[reason as PaymentFailure] ?? "El pago no se completó.";

// One stroop is 10^-7 of a unit. Integer arithmetic, so 1.2 never prints as 1.19999.
export function xlmFromStroops(stroops: string): string {
  const value = BigInt(stroops);
  const whole = value / 10_000_000n;
  const fraction = (value % 10_000_000n).toString().padStart(7, "0").replace(/0+$/, "");
  return fraction === "" ? whole.toString() : `${whole}.${fraction}`;
}

// What /quote said about the price, reduced to what the consent button needs.
export type Price =
  | { readonly paymentRequired: false }
  | { readonly paymentRequired: true; readonly amountStroops: string; readonly asset: string };

export type ConsentAction =
  | { readonly kind: "blocked"; readonly label: string }
  | { readonly kind: "issue"; readonly label: string }
  | { readonly kind: "connect"; readonly label: string };

// Unknown price reads as the plain action: the issue call quotes again anyway,
// and a charge it finds without a wallet comes back as a typed reason.
export function consentAction(input: {
  readonly blocker: string | undefined;
  readonly price: Price | undefined;
  readonly walletConnected: boolean;
}): ConsentAction {
  if (input.blocker !== undefined) return { kind: "blocked", label: input.blocker };
  if (input.price === undefined || !input.price.paymentRequired) return { kind: "issue", label: "Autorizar y consultar" };
  if (!input.walletConnected) return { kind: "connect", label: "Conectar wallet para pagar" };
  return { kind: "issue", label: `Pagar ${xlmFromStroops(input.price.amountStroops)} ${input.price.asset} y consultar` };
}
