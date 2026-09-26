// pricing.ts: what a verification costs, quoted before anyone consents.
// Per predicate, so asking for more costs more — that price is the lever that
// discourages asking beyond the purpose. See docs/memoria.md D-26.

import { sha256Hash } from "@knowni/core/node";
import { utf8 } from "@knowni/core";
import type { SessionRequest } from "@knowni/core";

// Minor units of the quoted currency, per predicate. A source that costs the
// issuer more costs the asker more; the margin is not hidden in an average.
// A `Map` and not an object literal: the predicate is a string the caller
// sends, and `PRICE_MINOR["constructor"]` on an object literal answers with a
// function — which is not `undefined`, so the guard below let it through and
// the total became a string.
export const PRICE_MINOR = new Map<string, number>([
  ["personhood", 120],
  ["capacity", 120],
  ["sanctions", 240],
  ["assetStanding", 300],
]);

// The default. An issuer that charges another asset quotes in that asset's
// currency instead; the amounts stay the same minor units.
export const CURRENCY = "USDC";

export interface QuoteLine {
  readonly predicate: string;
  readonly priceMinor: number;
}

export interface Quote {
  readonly currency: string;
  readonly lines: readonly QuoteLine[];
  readonly totalMinor: number;
  // What the payer must put in the payment memo. It proves the payment belongs
  // to THIS question without revealing who asked or about whom.
  readonly paymentRef: string;
  readonly quotedAt: number;
  readonly expiresAt: number;
}

export type QuoteFailure = "unknown_predicate" | "empty_request";

export type QuoteResult =
  | { readonly status: "quoted"; readonly quote: Quote }
  | { readonly status: "refused"; readonly reason: QuoteFailure };

// 32 bytes over the session and the exact predicates quoted: changing either
// changes the reference, so a payment cannot be moved to a bigger question.
export function paymentRef(request: SessionRequest, predicates: readonly string[]): string {
  return sha256Hash.hash("knowni/payment-ref/v1", [
    utf8(request.relyingPartyId),
    utf8(request.purpose),
    utf8(request.nonce),
    utf8(request.paramsHash),
    utf8([...predicates].sort().join(",")),
  ]);
}

export function quote(
  request: SessionRequest,
  predicates: readonly string[],
  nowUnix: number,
  validForSeconds = 600,
  currency = CURRENCY,
): QuoteResult {
  if (predicates.length === 0) return { status: "refused", reason: "empty_request" };

  const lines: QuoteLine[] = [];
  for (const predicate of predicates) {
    const priceMinor = PRICE_MINOR.get(predicate);
    // A predicate with no published price is not quoted at an invented one.
    if (priceMinor === undefined) return { status: "refused", reason: "unknown_predicate" };
    lines.push({ predicate, priceMinor });
  }

  return {
    status: "quoted",
    quote: {
      currency,
      lines,
      totalMinor: lines.reduce((sum, line) => sum + line.priceMinor, 0),
      paymentRef: paymentRef(request, predicates),
      quotedAt: nowUnix,
      expiresAt: nowUnix + validForSeconds,
    },
  };
}

// What is actually charged once the sources have answered. An `unavailable`
// is not a sellable answer: charging for "we don't know" would pay the issuer
// to leave a flaky source flaky.
export function chargeableMinor(
  answers: readonly { readonly predicate: string; readonly value: unknown }[],
): number {
  return answers
    .filter((answer) => answer.value !== "unavailable")
    .reduce((sum, answer) => sum + (PRICE_MINOR.get(answer.predicate) ?? 0), 0);
}
