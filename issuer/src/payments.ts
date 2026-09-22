// payments.ts: checks that a question was paid for, against the chain itself.
// The payment carries the quote's reference in its memo, so a transaction can
// only pay for the question it was quoted for. See docs/memoria.md D-26.

const TESTNET_HORIZON = "https://horizon-testnet.stellar.org";

export type PaymentFailure =
  | "not_found"
  | "failed_on_chain"
  | "wrong_reference"
  | "wrong_destination"
  | "underpaid"
  | "already_spent"
  | "unreachable";

export type PaymentCheck =
  | { readonly status: "paid"; readonly amountStroops: bigint; readonly txHash: string }
  | { readonly status: "refused"; readonly reason: PaymentFailure };

export interface PaymentPolicy {
  // Where the money must land. A payment to somewhere else is not a payment.
  readonly destination: string;
  readonly minAmountStroops: bigint;
  readonly asset?: PaymentAsset;
  readonly horizonUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

export type PaymentAsset =
  | { readonly type: "native" }
  | { readonly type: "credit"; readonly code: string; readonly issuer: string };

export interface PaymentTerms {
  readonly network: "testnet";
  readonly destination: string;
  readonly asset: PaymentAsset;
  readonly amountStroops: string;
  readonly paymentRef: string;
}

export function quotedAmountStroops(totalMinor: number, policy: PaymentPolicy): bigint {
  const quoted = BigInt(totalMinor) * 100_000n;
  return quoted > policy.minAmountStroops ? quoted : policy.minAmountStroops;
}

export function paymentTerms(totalMinor: number, reference: string, currency: string, policy: PaymentPolicy): PaymentTerms {
  const asset = policy.asset ?? { type: "native" as const };
  const assetCurrency = asset.type === "native" ? "XLM" : asset.code;
  if (assetCurrency !== currency) throw new TypeError("payment asset does not match quote currency");
  return {
    network: "testnet",
    destination: policy.destination,
    asset,
    amountStroops: quotedAmountStroops(totalMinor, policy).toString(),
    paymentRef: reference,
  };
}

// A transaction pays once. Without this a single payment would buy every
// question sharing its reference, which is every retry of the same question.
export interface SpentPayments {
  claim(txHash: string): boolean;
}

export function createMemorySpentPayments(): SpentPayments {
  const spent = new Set<string>();
  return {
    claim(txHash) {
      if (spent.has(txHash)) return false;
      spent.add(txHash);
      return true;
    },
  };
}

interface HorizonTransaction {
  readonly successful?: boolean;
  readonly memo_type?: string;
  readonly memo?: string;
}

interface HorizonPayment {
  readonly type?: string;
  readonly to?: string;
  readonly amount?: string;
  readonly asset_type?: string;
  readonly asset_code?: string;
  readonly asset_issuer?: string;
}

const toStroops = (amount: string): bigint => {
  const [whole = "0", fraction = ""] = amount.split(".");
  return BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, "0").slice(0, 7));
};

export async function verifyPayment(
  txHash: string,
  paymentRef: string,
  policy: PaymentPolicy,
  spent: SpentPayments,
): Promise<PaymentCheck> {
  const horizonUrl = policy.horizonUrl ?? TESTNET_HORIZON;
  const fetchImpl = policy.fetchImpl ?? fetch;

  let transaction: HorizonTransaction;
  let payments: HorizonPayment[];
  try {
    const txResponse = await fetchImpl(`${horizonUrl}/transactions/${txHash}`);
    if (txResponse.status === 404) return { status: "refused", reason: "not_found" };
    if (!txResponse.ok) return { status: "refused", reason: "unreachable" };
    transaction = (await txResponse.json()) as HorizonTransaction;

    const opsResponse = await fetchImpl(`${horizonUrl}/transactions/${txHash}/payments`);
    if (!opsResponse.ok) return { status: "refused", reason: "unreachable" };
    const body = (await opsResponse.json()) as { _embedded?: { records?: HorizonPayment[] } };
    payments = body._embedded?.records ?? [];
  } catch {
    return { status: "refused", reason: "unreachable" };
  }

  if (transaction.successful !== true) return { status: "refused", reason: "failed_on_chain" };

  // MEMO_HASH holds 32 bytes; anything else is not the reference we quoted.
  if (transaction.memo_type !== "hash" || typeof transaction.memo !== "string") {
    return { status: "refused", reason: "wrong_reference" };
  }
  const memoHex = Buffer.from(transaction.memo, "base64").toString("hex");
  if (memoHex !== paymentRef) return { status: "refused", reason: "wrong_reference" };

  const expectedAsset = policy.asset ?? { type: "native" as const };
  const toUs = payments.filter((payment) => {
    if (payment.type !== "payment" || payment.to !== policy.destination) return false;
    if (expectedAsset.type === "native") return payment.asset_type === "native";
    return (
      payment.asset_type !== "native" &&
      payment.asset_code === expectedAsset.code &&
      payment.asset_issuer === expectedAsset.issuer
    );
  });
  if (toUs.length === 0) return { status: "refused", reason: "wrong_destination" };

  const total = toUs.reduce((sum, payment) => sum + toStroops(payment.amount ?? "0"), 0n);
  if (total < policy.minAmountStroops) return { status: "refused", reason: "underpaid" };

  // Claimed last, and only once everything else passed: a refused payment
  // stays spendable, so a buyer is never charged for a question we rejected.
  if (!spent.claim(txHash)) return { status: "refused", reason: "already_spent" };

  return { status: "paid", amountStroops: total, txHash };
}
