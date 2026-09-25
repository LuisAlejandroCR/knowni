// proving-key.ts: gets the Groth16 proving key onto the device once, and hands
// the prover a path plus the digest it must have. The digest is checked in
// Rust before the key is read; a wrong file is deleted so the next try refetches.

import type { ProveOutcome, ProverPort, ProvingKeyFile } from "./prover.ts";

/// SHA-256 of the development zkey whose verifying key is committed in
/// circuits/groth16/verification_key.json and pinned by the contract tests.
/// A new setup means a new digest here, in the same change.
export const ZKEY_SHA256 = "bfdef55e5b5992e814cfd9c6157725d9274b7fe98e0dd7471718f334ecd0f6a8";

/// Served by the web deploy from web/public/keys/. The variable overrides it,
/// for a build that must fetch from somewhere else.
export const ZKEY_URL: string | undefined =
  process.env.EXPO_PUBLIC_ZKEY_URL || "https://knowni.vercel.app/keys/eligibility-dev.zkey";

/// What the key store needs from the file system, so it runs in tests.
export interface KeyFiles {
  readonly path: string;
  exists(): boolean;
  download(url: string): Promise<void>;
  remove(): void;
}

export type KeyState =
  | { readonly kind: "ready"; readonly key: ProvingKeyFile }
  // No URL configured: this build cannot fetch a key, and says so.
  | { readonly kind: "no_source" }
  | { readonly kind: "download_failed" };

export async function ensureProvingKey(files: KeyFiles, url: string | undefined): Promise<KeyState> {
  const key = { path: files.path, sha256: ZKEY_SHA256 };
  if (files.exists()) return { kind: "ready", key };
  if (url === undefined) return { kind: "no_source" };
  try {
    await files.download(url);
  } catch {
    // A partial file would read as present next time and fail the digest.
    if (files.exists()) files.remove();
    return { kind: "download_failed" };
  }
  return files.exists() ? { kind: "ready", key } : { kind: "download_failed" };
}

/// Proves with the key on the device, fetching it first if needed. A key that
/// fails its digest is removed and fetched once more; a second mismatch is the
/// answer, because the source itself is serving the wrong file.
export async function proveWithDeviceKey(
  prover: ProverPort,
  files: KeyFiles,
  input: Readonly<Record<string, string | readonly string[]>>,
  url: string | undefined,
): Promise<ProveOutcome | Exclude<KeyState, { kind: "ready" }>> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const state = await ensureProvingKey(files, url);
    if (state.kind !== "ready") return state;
    const outcome = await prover.prove(input, state.key);
    if (outcome.kind !== "failed" || outcome.reason !== "zkey_mismatch") return outcome;
    files.remove();
  }
  return { kind: "failed", reason: "zkey_mismatch" };
}
