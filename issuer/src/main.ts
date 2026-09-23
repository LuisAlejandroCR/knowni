// main.ts: starts the issuance service from the environment.
// The provider key, the relying-party access keys, the treasury account and
// the messaging keys live here and nowhere else. A missing provider or access
// key refuses to start; a missing treasury or messaging key just turns off
// its feature instead of faking it.

import { createIssuerService } from "./service.ts";
import { createMemoryRequestQuota, DEFAULT_MAX_PER_MINUTE } from "./access.ts";
import { createMemoryIssuanceCache, DEFAULT_CACHE_MAX_ENTRIES } from "./cache.ts";
import { createPersistentSpentPayments } from "./payments.ts";
import { createFileSpentPaymentStore } from "./spent-store.ts";
import { notifierFromEnv } from "./notify.ts";
import { nodeSignatures } from "@knowni/attestation/node";

const apiKey = process.env.CROMA_API_KEY ?? "";
if (apiKey === "") {
  console.error("CROMA_API_KEY is not set. It lives in .env.local, which is gitignored.");
  process.exit(2);
}

// One key per relying party, comma-separated. Without at least one, /issue
// would answer anyone who finds the URL and spend Croma's quota for free —
// so the service refuses to start rather than run open. See D-31.
const accessKeys = (process.env.KNOWNI_ISSUER_ACCESS_KEYS ?? "")
  .split(",")
  .map((key) => key.trim())
  .filter((key) => key !== "");
if (accessKeys.length === 0) {
  console.error("KNOWNI_ISSUER_ACCESS_KEYS is not set. It lives in .env.local, which is gitignored.");
  process.exit(2);
}
const maxPerMinute = Number(process.env.KNOWNI_ISSUER_RATE_LIMIT_PER_MINUTE ?? String(DEFAULT_MAX_PER_MINUTE));
const cacheMaxEntries = Number(process.env.KNOWNI_ISSUER_CACHE_MAX_ENTRIES ?? String(DEFAULT_CACHE_MAX_ENTRIES));
if (!Number.isSafeInteger(cacheMaxEntries) || cacheMaxEntries < 1) {
  console.error("KNOWNI_ISSUER_CACHE_MAX_ENTRIES must be a positive integer.");
  process.exit(2);
}

const seed = process.env.KNOWNI_ISSUER_SEED
  ? Uint8Array.from(Buffer.from(process.env.KNOWNI_ISSUER_SEED, "hex"))
  : nodeSignatures.randomSeed();

// No treasury account means no charging: the service answers for free rather
// than collecting into an account nobody named.
const treasury = process.env.KNOWNI_TREASURY_ACCOUNT;
const paymentAssetIssuer = process.env.KNOWNI_PAYMENT_ASSET_ISSUER;
if (treasury !== undefined && paymentAssetIssuer === undefined) {
  console.error("KNOWNI_PAYMENT_ASSET_ISSUER is required when payments are enabled.");
  process.exit(2);
}
const payments =
  treasury === undefined
    ? undefined
    : {
        destination: treasury,
        minAmountStroops: BigInt(process.env.KNOWNI_MIN_PAYMENT_STROOPS ?? "1"),
        asset: { type: "credit" as const, code: "USDC", issuer: paymentAssetIssuer! },
        horizonUrl: process.env.STELLAR_HORIZON_URL,
      };

// Charging without a durable spent set is a hole, not a lesser feature: on a
// restart a transaction already redeemed buys a second issuance. So payments
// and persistence are enabled together or not at all — D-37.
const spentPath = process.env.KNOWNI_SPENT_PAYMENTS_FILE;
if (payments !== undefined && spentPath === undefined) {
  console.error("KNOWNI_SPENT_PAYMENTS_FILE is required when payments are enabled: a spent set that");
  console.error("dies with the process lets a redeemed transaction pay twice.");
  process.exit(2);
}
const spentPayments =
  spentPath === undefined
    ? undefined
    : await createPersistentSpentPayments(createFileSpentPaymentStore(spentPath), {
        onWriteError: (error, txHash) =>
          console.error(`spent payment ${txHash} was not written; it may be redeemed again`, error),
      });

const notifier = notifierFromEnv(process.env);
const port = Number(process.env.PORT ?? 8787);

createIssuerService({
  apiKey,
  issuerId: "co-operador-demo",
  seed,
  payments,
  notifier,
  access: { keys: new Set(accessKeys) },
  requestQuota: createMemoryRequestQuota(maxPerMinute),
  issuanceCache: createMemoryIssuanceCache(cacheMaxEntries),
  spentPayments,
}).listen(port, () => {
  console.log(`issuer listening on http://localhost:${port}`);
  console.log(`payments: ${payments === undefined ? "off (no treasury account)" : payments.destination}`);
  console.log(`notifications: ${notifier.channel}`);
  console.log(`relying parties: ${accessKeys.length}, ${maxPerMinute}/min each`);
  console.log(`spent payments: ${spentPath ?? "in memory (payments off)"}`);
  console.log(`issuance cache: memory, max ${cacheMaxEntries} entries`);
});
