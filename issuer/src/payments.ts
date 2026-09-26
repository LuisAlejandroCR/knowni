// payments.ts: checks that a question was paid for, against the chain itself.
// The payment carries the quote's reference in its memo, so a transaction can
// only pay for the question it was quoted for. See docs/memoria.md D-26.

const TESTNET_HORIZON = "https://horizon-testnet.stellar.org";

export type PaymentFailure =
  | "not_found"
  | "failed_on_chain"
  | "wrong_reference"
  | "wrong_destination"
  | "wrong_asset"
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

// The currency a quote must be priced in to be paid with this asset. A policy
// that names no asset charges native, as `verifyPayment` does.
export function assetCurrency(asset: PaymentAsset | undefined): string {
  return asset === undefined || asset.type === "native" ? "XLM" : asset.code;
}

export type PaymentAssetConfig =
  | { readonly status: "configured"; readonly asset: PaymentAsset }
  | { readonly status: "refused"; readonly message: string };

// Reads KNOWNI_PAYMENT_ASSET: `usdc` (the default) or `native`. Anything else
// refuses to start rather than charging in an asset nobody chose.
export function paymentAssetFromEnv(env: Readonly<Record<string, string | undefined>>): PaymentAssetConfig {
  const kind = env.KNOWNI_PAYMENT_ASSET ?? "usdc";
  if (kind === "native") return { status: "configured", asset: { type: "native" } };
  if (kind !== "usdc") {
    return { status: "refused", message: "KNOWNI_PAYMENT_ASSET must be `usdc` or `native`." };
  }
  const issuer = env.KNOWNI_PAYMENT_ASSET_ISSUER ?? "";
  if (issuer === "") {
    return { status: "refused", message: "KNOWNI_PAYMENT_ASSET_ISSUER is required when payments are charged in USDC." };
  }
  return { status: "configured", asset: { type: "credit", code: "USDC", issuer } };
}

export function paymentTerms(totalMinor: number, reference: string, currency: string, policy: PaymentPolicy): PaymentTerms {
  const asset = policy.asset ?? { type: "native" as const };
  if (assetCurrency(asset) !== currency) throw new TypeError("payment asset does not match quote currency");
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
  // Waits for the writes the claims launched. Optional: a store that keeps the
  // set in memory has nothing to settle. See D-38.
  settled?(): Promise<void>;
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

// Where the spent set outlives the process. A port, not a dependency: this
// module never learns what a file, a disk or a database is. Mirrors
// `NullifierStore` in `attestation/` — same hole, same shape. See D-37.
export interface SpentPaymentStore {
  load(): Promise<readonly string[]>;
  append(txHash: string): Promise<void>;
}

export interface PersistentSpentOptions {
  // A write that never lands means a transaction already redeemed can be
  // redeemed again after a restart. It is reported, never swallowed.
  readonly onWriteError?: (error: unknown, txHash: string) => void;
}

// Hydrated once at start-up, then decided in memory: `claim` stays synchronous
// because it is the last step of `verifyPayment` and an await there is exactly
// the window a double spend needs. The write is what trails.
export async function createPersistentSpentPayments(
  store: SpentPaymentStore,
  options: PersistentSpentOptions = {},
): Promise<SpentPayments> {
  const onWriteError = options.onWriteError ?? (() => {});
  const spent = new Set<string>(await store.load());

  // The writes never reject on their own: a caller that never asks whether they
  // landed must not crash the process with an unhandled rejection.
  let inFlight: Promise<void>[] = [];
  let failures: unknown[] = [];

  return {
    claim(txHash) {
      if (spent.has(txHash)) return false;
      spent.add(txHash);
      // A write that fails releases the claim. Burning a buyer's transaction
      // over a transient disk error is worse than the narrow window that
      // reopens, and the invariant holds because nothing was issued. D-38.
      inFlight.push(
        store.append(txHash).catch((error: unknown) => {
          spent.delete(txHash);
          failures.push(error);
          onWriteError(error, txHash);
        }),
      );
      return true;
    },
    async settled() {
      const pending = inFlight;
      inFlight = [];
      await Promise.all(pending);
      if (failures.length === 0) return;
      const [first] = failures;
      failures = [];
      throw first;
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

// Horizon writes an amount as a non-negative decimal with at most seven
// places. Anything else is not an amount this issuer can read, and reading it
// anyway is how `BigInt("abc")` threw out of a payment check instead of
// refusing it: a payer got a crash where the protocol has a word for "no".
const AMOUNT = /^\d+(\.\d{1,7})?$/;

const toStroops = (amount: unknown): bigint | undefined => {
  if (typeof amount !== "string" || !AMOUNT.test(amount)) return undefined;
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
    const body = (await opsResponse.json()) as { _embedded?: { records?: unknown } };
    const records = body._embedded?.records;
    // A page of records that is not a list is not a page of records.
    payments = Array.isArray(records) ? (records as HorizonPayment[]) : [];
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
  const toDestination = payments.filter(
    (payment) => payment.type === "payment" && payment.to === policy.destination,
  );
  const toUs = toDestination.filter((payment) => {
    if (expectedAsset.type === "native") return payment.asset_type === "native";
    return (
      payment.asset_type !== "native" &&
      payment.asset_code === expectedAsset.code &&
      payment.asset_issuer === expectedAsset.issuer
    );
  });
  // Money that landed here in the wrong asset is not money that landed
  // somewhere else, and telling the payer otherwise sends them to fix the
  // wrong thing. Both are refusals; only the reason differs.
  if (toUs.length === 0) {
    return { status: "refused", reason: toDestination.length === 0 ? "wrong_destination" : "wrong_asset" };
  }

  // A payment whose amount cannot be read is not counted: the total falls
  // short and the payer is told `underpaid`, which is true and actionable.
  const total = toUs.reduce((sum, payment) => sum + (toStroops(payment.amount) ?? 0n), 0n);
  if (total < policy.minAmountStroops) return { status: "refused", reason: "underpaid" };

  // Claimed last, and only once everything else passed: a refused payment
  // stays spendable, so a buyer is never charged for a question we rejected.
  if (!spent.claim(txHash)) return { status: "refused", reason: "already_spent" };

  return { status: "paid", amountStroops: total, txHash };
}
