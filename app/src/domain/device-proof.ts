// device-proof.ts: one end-to-end Groth16 run on this device, over the example
// input — fetch the key if needed, prove, and check the proof says what the
// fixture should. What the device-proof screen shows, and nothing more.

import type { ProverPort } from "./prover.ts";
import { proveWithDeviceKey, type KeyFiles } from "./proving-key.ts";

export type DeviceProofResult =
  | { readonly kind: "proved"; readonly millis: number; readonly outputs: readonly string[] }
  | { readonly kind: "unsupported" }
  | { readonly kind: "no_source" }
  | { readonly kind: "download_failed" }
  // The native side verified the proof, but it discloses something other than
  // the fixture's outcome: the input or the key is not the one expected.
  | { readonly kind: "wrong_statement"; readonly outputs: readonly string[] }
  | { readonly kind: "failed"; readonly reason: string };

export async function runDeviceProof(
  prover: ProverPort,
  files: KeyFiles,
  input: Readonly<Record<string, string | readonly string[]>>,
  expectedOutputs: readonly string[],
  url: string | undefined,
  clock: () => number = Date.now,
): Promise<DeviceProofResult> {
  const start = clock();
  const outcome = await proveWithDeviceKey(prover, files, input, url);
  const millis = clock() - start;
  if (outcome.kind !== "proved") return outcome;

  const outputs = outcome.publicSignals.slice(0, expectedOutputs.length);
  const matches = outputs.every((value, i) => value === expectedOutputs[i]);
  return matches ? { kind: "proved", millis, outputs } : { kind: "wrong_statement", outputs };
}
