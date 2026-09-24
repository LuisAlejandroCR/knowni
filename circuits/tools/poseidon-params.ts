// poseidon-params.ts: re-export, so the circuit's tools and the domain both
// read one implementation. It lives in core/ because core/ is what hashes with
// it; a second copy here is a copy that drifts.

export {
  BLS12_381_PRIME,
  BN254_PRIME,
  CIRCOMLIB_PARTIAL_ROUNDS,
  circomlibSpec,
  parameters,
  roundConstants,
  type GrainSpec,
  type PoseidonParameters,
} from "@knowni/core";
