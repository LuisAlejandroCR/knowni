// signing.ts: the ed25519 seam. An implementation is injected, never imported.
// Node has it in node:crypto and React Native does not, so the domain takes a
// port and each platform binds it once.

export interface SignaturePort {
  readonly algorithm: "ed25519";
  publicKeyOf(seed: Uint8Array): Uint8Array;
  sign(seed: Uint8Array, message: Uint8Array): Uint8Array;
  verify(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean;
  randomSeed(): Uint8Array;
}
