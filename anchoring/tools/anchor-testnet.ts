// anchor-testnet.ts: anchors one real commitment on Stellar testnet and prints the transaction
// hash and its Explorer link. Creates and funds the demo account on first run.

import { commitOutcome, sha256Hash } from "@knowni/core";
import { createStellarMemoAnchor } from "../src/adapters/stellar.ts";
import {
  accountIdOf,
  createHorizonMemoSubmitter,
  demoSeedFrom,
  fundOnTestnet,
} from "../src/adapters/stellar-horizon.ts";

const passphrase = process.env.KNOWNI_DEMO_SEED_PHRASE ?? "knowni testnet demo account";
const seed = demoSeedFrom(passphrase);
const accountId = accountIdOf(seed);
console.log("account", accountId);

const probe = await fetch(`https://horizon-testnet.stellar.org/accounts/${accountId}`);
if (probe.status === 404) {
  console.log("funding with friendbot…");
  if (!(await fundOnTestnet(accountId))) throw new Error("friendbot refused to fund the account");
}

// A real outcome, committed the way the product commits one: blinded, so the
// chain holds a commitment and not a verdict about anyone.
const outcome = {
  personhood: true,
  solvencyTier: 3,
  formality: true,
  standing: true,
  decidedAt: Math.floor(Date.now() / 1000),
};
const blinded = commitOutcome(sha256Hash, outcome);

const anchor = createStellarMemoAnchor(createHorizonMemoSubmitter(seed), { chain: "stellar:testnet", logError: (error) => console.error("submitter:", error) });
const result = await anchor.anchor({ commitment: { hex: blinded.commitment } });

if (result.status !== "anchored") {
  console.error("anchoring degraded:", result);
  process.exit(1);
}
console.log("commitment", blinded.commitment);
console.log("tx", result.receipt.txRef);
console.log(`https://stellar.expert/explorer/testnet/tx/${result.receipt.txRef}`);
