// index.ts: the native prover module, or undefined where it is not linked —
// Expo Go and the web have no native code of ours, and saying so is the honest
// answer, not a crash. The domain reads it through app/src/domain/prover.ts.

import { requireOptionalNativeModule } from "expo-modules-core";

export interface KnowniProverNative {
  /// Input JSON, zkey path and its pinned SHA-256 in; `{"proof","publicSignals"}`
  /// or `{"error","code"}` out.
  prove(inputJson: string, zkeyPath: string, zkeySha256: string): Promise<string>;
}

export default requireOptionalNativeModule<KnowniProverNative>("KnowniProver") ?? undefined;
