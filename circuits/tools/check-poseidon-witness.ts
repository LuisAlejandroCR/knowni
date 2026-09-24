// check-poseidon-witness.ts: compares the witness of PoseidonKnowni2 with the
// digest core computes for the same inputs, on the curve named on the command
// line. Exits non-zero when they disagree, which is the whole point.
//
//   node --experimental-strip-types circuits/tools/check-poseidon-witness.ts \
//     <witness.json> [bls12381]

import { readFileSync } from "node:fs";
import { BLS12_381_PRIME, BN254_PRIME, circomlibSpec, poseidon } from "@knowni/core";

const [file, curve] = process.argv.slice(2);
if (file === undefined) {
  throw new Error("usage: check-poseidon-witness.ts <witness.json> [bls12381]");
}

const bls = curve === "bls12381";
const spec = circomlibSpec(bls ? BLS12_381_PRIME : BN254_PRIME, bls ? 255 : 254, 3);

/// snarkjs exports the witness as decimal strings: the constant one, then the
/// outputs, then everything else. `out` is the circuit's only output.
const witness = JSON.parse(readFileSync(file, "utf8")) as unknown;
if (!Array.isArray(witness) || typeof witness[1] !== "string") {
  throw new Error("witness json is not the array of decimal strings snarkjs writes");
}

const INPUTS = [1n, 2n];
const fromCircuit = BigInt(witness[1]);
const fromCore = poseidon(INPUTS, spec);

if (fromCircuit !== fromCore) {
  throw new Error(
    `circuit and core disagree on ${bls ? "bls12381" : "bn128"}: ` +
      `0x${fromCircuit.toString(16)} vs 0x${fromCore.toString(16)}`,
  );
}

process.stdout.write(`ok: ${bls ? "bls12381" : "bn128"} 0x${fromCore.toString(16)}\n`);
