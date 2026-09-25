// write-soroban-args.ts: the committed proof as the JSON arguments the Stellar
// CLI passes to the verifier contract — the verifying key for the constructor,
// and the proof, named signals and flat vector for `anchor`.
//
//   node --experimental-strip-types circuits/tools/write-soroban-args.ts <out-dir>

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { committed } from "./soroban-encoding.ts";

const out = process.argv[2];
if (out === undefined) throw new Error("usage: write-soroban-args.ts <out-dir>");

const order = readFileSync(fileURLToPath(new URL("../eligibility.signals.txt", import.meta.url)), "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line !== "" && !line.startsWith("#"));

const { vk, proof, signals } = committed();
const at = (name: string): string => {
  const index = order.indexOf(name);
  if (index < 0) throw new Error(`${name} is not a public signal`);
  return signals[index]!;
};
const small = (name: string): number => Number(BigInt(`0x${at(name)}`));

const named = {
  issuer_root: at("issuerRoot"),
  session_id: at("sessionId"),
  nullifier: at("nullifier"),
  list_set_root: at("listSetRoot"),
  personhood: small("personhood") === 1,
  solvency_tier: small("solvencyTier"),
  formality: small("formality") === 1,
  sanctions: small("sanctions") === 1,
};

mkdirSync(out, { recursive: true });
const write = (name: string, value: unknown) => writeFileSync(join(out, name), JSON.stringify(value));
write("vk.json", vk);
write("proof.json", proof);
write("signals.json", named);
// Fr is a u256 in the contract spec, and the CLI reads a u256 as a decimal.
write("raw_signals.json", signals.map((hex) => BigInt(`0x${hex}`).toString()));
process.stdout.write(`${JSON.stringify({ issuer_root: named.issuer_root, session_id: named.session_id, nullifier: named.nullifier })}\n`);
