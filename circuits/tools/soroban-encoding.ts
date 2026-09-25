// soroban-encoding.ts: the committed Groth16 key, proof and signals as hex in the
// byte layout Soroban's BLS12-381 host functions read. One encoding, used by the
// Rust test fixture and by the testnet invocation, so the two cannot drift.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../groth16/", import.meta.url));
const read = (name: string): unknown => JSON.parse(readFileSync(`${dir}${name}`, "utf8"));

type G1 = readonly [string, string, string];
type G2 = readonly [readonly [string, string], readonly [string, string], readonly [string, string]];

interface VerificationKeyJson {
  curve: string;
  nPublic: number;
  vk_alpha_1: G1;
  vk_beta_2: G2;
  vk_gamma_2: G2;
  vk_delta_2: G2;
  IC: G1[];
}
interface ProofJson {
  pi_a: G1;
  pi_b: G2;
  pi_c: G1;
}

export function be(value: string, bytes: number): string {
  const hex = BigInt(value).toString(16).padStart(bytes * 2, "0");
  if (hex.length !== bytes * 2) throw new RangeError(`${value} does not fit ${bytes} bytes`);
  return hex;
}

/// Uncompressed, big-endian, x then y: 96 bytes. snarkjs writes the
/// projective z as "1" for an affine point; anything else is not affine.
export function g1(point: G1): string {
  if (point[2] !== "1") throw new Error("a G1 point is not affine");
  return be(point[0], 48) + be(point[1], 48);
}

/// 192 bytes, and the order inside each coordinate is c1 then c0: snarkjs lists
/// the Fp2 components the other way round, so copying them in order produces a
/// point that is not on the curve, not a proof that fails.
export function g2(point: G2): string {
  if (point[2][0] !== "1" || point[2][1] !== "0") throw new Error("a G2 point is not affine");
  return be(point[0][1], 48) + be(point[0][0], 48) + be(point[1][1], 48) + be(point[1][0], 48);
}

export interface Encoded {
  readonly vk: { alpha: string; beta: string; gamma: string; delta: string; ic: string[] };
  readonly proof: { a: string; b: string; c: string };
  /// 32-byte big-endian, in eligibility.signals.txt's order.
  readonly signals: string[];
}

export function committed(): Encoded {
  const vk = read("verification_key.json") as VerificationKeyJson;
  const proof = read("proof.json") as ProofJson;
  const signals = read("public.json") as string[];

  if (vk.curve !== "bls12381") throw new Error(`the key is over ${vk.curve}; Stellar verifies bls12381`);
  if (signals.length !== vk.nPublic || vk.IC.length !== vk.nPublic + 1) {
    throw new Error("the key, the proof and the public signals disagree on how many signals there are");
  }
  return {
    vk: {
      alpha: g1(vk.vk_alpha_1),
      beta: g2(vk.vk_beta_2),
      gamma: g2(vk.vk_gamma_2),
      delta: g2(vk.vk_delta_2),
      ic: vk.IC.map(g1),
    },
    proof: { a: g1(proof.pi_a), b: g2(proof.pi_b), c: g1(proof.pi_c) },
    signals: signals.map((signal) => be(signal, 32)),
  };
}
