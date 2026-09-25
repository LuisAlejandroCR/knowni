// prover.ts: proving eligibility on the phone, behind one port. The native
// module does the work; this side decides what counts as an answer, so a
// malformed or partial reply is refused here and never reaches a verifier.

export interface Groth16Proof {
  readonly pi_a: readonly string[];
  readonly pi_b: readonly (readonly string[])[];
  readonly pi_c: readonly string[];
  readonly protocol: "groth16";
  readonly curve: "bls12381";
}

export type ProveOutcome =
  | { readonly kind: "proved"; readonly proof: Groth16Proof; readonly publicSignals: readonly string[] }
  // No native module: Expo Go, the web, or a build without the prover.
  | { readonly kind: "unsupported" }
  | { readonly kind: "failed"; readonly reason: string };

/// Where the proving key is on this device, and the digest it must have.
export interface ProvingKeyFile {
  readonly path: string;
  readonly sha256: string;
}

export interface ProverPort {
  prove(input: Readonly<Record<string, string | readonly string[]>>, key: ProvingKeyFile): Promise<ProveOutcome>;
}

export interface NativeProver {
  prove(inputJson: string, zkeyPath: string, zkeySha256: string): Promise<string>;
}

/// The number of public signals eligibility.circom exposes: its five outputs
/// and eight public inputs, in circuits/eligibility.signals.txt's order.
export const ELIGIBILITY_SIGNALS = 13;

const decimal = /^(0|[1-9][0-9]*)$/;
const isDecimalList = (value: unknown, length?: number): value is string[] =>
  Array.isArray(value) &&
  (length === undefined || value.length === length) &&
  value.every((item) => typeof item === "string" && decimal.test(item));

function parseProof(value: unknown): Groth16Proof | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const proof = value as Record<string, unknown>;
  const piB = proof["pi_b"];
  const ok =
    isDecimalList(proof["pi_a"], 3) &&
    isDecimalList(proof["pi_c"], 3) &&
    Array.isArray(piB) &&
    piB.length === 3 &&
    piB.every((pair) => isDecimalList(pair, 2)) &&
    proof["protocol"] === "groth16" &&
    proof["curve"] === "bls12381";
  return ok ? (proof as unknown as Groth16Proof) : undefined;
}

export function createNativeProver(native: NativeProver | undefined): ProverPort {
  return {
    async prove(input, key) {
      if (native === undefined) return { kind: "unsupported" };

      let raw: string;
      try {
        raw = await native.prove(JSON.stringify(input), key.path, key.sha256);
      } catch {
        return { kind: "failed", reason: "native_error" };
      }

      let answer: unknown;
      try {
        answer = JSON.parse(raw);
      } catch {
        return { kind: "failed", reason: "unreadable_answer" };
      }
      if (typeof answer !== "object" || answer === null) return { kind: "failed", reason: "unreadable_answer" };

      const { error, code, proof, publicSignals } = answer as Record<string, unknown>;
      // The native error text can name a file path; it stays on the device.
      // Only the code travels, and only the one a caller can act on.
      if (typeof error === "string") {
        // The module is linked but its native library is not in this build.
        if (code === "unsupported") return { kind: "unsupported" };
        return { kind: "failed", reason: code === "zkey_mismatch" ? "zkey_mismatch" : "prover_error" };
      }

      const parsed = parseProof(proof);
      if (parsed === undefined || !isDecimalList(publicSignals, ELIGIBILITY_SIGNALS)) {
        return { kind: "failed", reason: "malformed_proof" };
      }
      return { kind: "proved", proof: parsed, publicSignals };
    },
  };
}
