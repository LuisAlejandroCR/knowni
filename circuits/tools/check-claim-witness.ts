// check-claim-witness.ts: compares the witness of IncomeCommitment with the
// commitment core computes for the same claim. Exits non-zero when they
// disagree, which is the whole point — a credential this repository issues has
// to be one the circuit can open.
//
//   node --experimental-strip-types circuits/tools/check-claim-witness.ts <witness.json>

import { readFileSync } from "node:fs";
import { commitClaim } from "@knowni/core";
import { poseidonHash } from "@knowni/core/node";
import { INCOME, SALT } from "./claim-fixture.ts";

const file = process.argv[2];
if (file === undefined) throw new Error("usage: check-claim-witness.ts <witness.json>");

/// snarkjs exports the witness as decimal strings: the constant one, then the
/// outputs, then everything else. `out` is the circuit's only output.
const witness = JSON.parse(readFileSync(file, "utf8")) as unknown;
if (!Array.isArray(witness) || typeof witness[1] !== "string") {
  throw new Error("witness json is not the array of decimal strings snarkjs writes");
}

const fromCircuit = BigInt(witness[1]).toString(16).padStart(64, "0");
const fromCore = commitClaim(poseidonHash, INCOME, SALT);

if (fromCircuit !== fromCore) {
  throw new Error(`circuit and core disagree on the income commitment: ${fromCircuit} vs ${fromCore}`);
}

process.stdout.write(`ok: income commitment ${fromCore}\n`);
