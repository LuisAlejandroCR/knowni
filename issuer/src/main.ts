// main.ts: starts the issuance service from the environment.
// The key lives here and nowhere else; without it the service refuses to start
// rather than pretending it can answer.

import { createIssuerService } from "./service.ts";
import { nodeSignatures } from "@knowni/attestation/node";

const apiKey = process.env.CROMA_API_KEY ?? "";
if (apiKey === "") {
  console.error("CROMA_API_KEY is not set. It lives in .env.local, which is gitignored.");
  process.exit(2);
}

// A demo issuer key per run. A real deployment loads it from a KMS and the
// registry publishes the public half.
const seed = process.env.KNOWNI_ISSUER_SEED
  ? Uint8Array.from(Buffer.from(process.env.KNOWNI_ISSUER_SEED, "hex"))
  : nodeSignatures.randomSeed();

const port = Number(process.env.PORT ?? 8787);
createIssuerService({ apiKey, issuerId: "co-operador-demo", seed }).listen(port, () => {
  console.log(`issuer listening on http://localhost:${port}`);
});
