// main.ts: starts the issuance service from the environment.
// The provider key, the treasury account and the messaging keys live here and
// nowhere else; each one absent turns off its feature instead of faking it.

import { createIssuerService } from "./service.ts";
import { notifierFromEnv } from "./notify.ts";
import { nodeSignatures } from "@knowni/attestation/node";

const apiKey = process.env.CROMA_API_KEY ?? "";
if (apiKey === "") {
  console.error("CROMA_API_KEY is not set. It lives in .env.local, which is gitignored.");
  process.exit(2);
}

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

createIssuerService({ apiKey, issuerId: "co-operador-demo", seed, payments, notifier }).listen(port, () => {
  console.log(`issuer listening on http://localhost:${port}`);
  console.log(`payments: ${payments === undefined ? "off (no treasury account)" : payments.destination}`);
  console.log(`notifications: ${notifier.channel}`);
});
