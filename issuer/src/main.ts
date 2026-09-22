// main.ts: starts the issuance service from the environment.
// The provider key, the relying-party access keys, the treasury account and
// the messaging keys live here and nowhere else. A missing provider or access
// key refuses to start; a missing treasury or messaging key just turns off
// its feature instead of faking it.

import { createIssuerService } from "./service.ts";
import { createMemoryRequestQuota, DEFAULT_MAX_PER_MINUTE } from "./access.ts";
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

const seed = process.env.KNOWNI_ISSUER_SEED
  ? Uint8Array.from(Buffer.from(process.env.KNOWNI_ISSUER_SEED, "hex"))
  : nodeSignatures.randomSeed();

// No treasury account means no charging: the service answers for free rather
// than collecting into an account nobody named.
const treasury = process.env.KNOWNI_TREASURY_ACCOUNT;
const payments =
  treasury === undefined
    ? undefined
    : {
        destination: treasury,
        minAmountStroops: BigInt(process.env.KNOWNI_MIN_PAYMENT_STROOPS ?? "1"),
        horizonUrl: process.env.STELLAR_HORIZON_URL,
      };

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
}).listen(port, () => {
  console.log(`issuer listening on http://localhost:${port}`);
  console.log(`payments: ${payments === undefined ? "off (no treasury account)" : payments.destination}`);
  console.log(`notifications: ${notifier.channel}`);
  console.log(`relying parties: ${accessKeys.length}, ${maxPerMinute}/min each`);
});
