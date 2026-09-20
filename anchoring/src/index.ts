// index.ts: The port, the registry, and the adapters that exist today.

export type {
  AnchorDegraded,
  AnchorFailureReason,
  AnchorReceipt,
  AnchorRequest,
  AnchorResult,
  AnchoringPort,
  ChainId,
  Commitment,
  Logger,
  Nullifier,
} from "./types.ts";
export { degraded, nowSeconds } from "./types.ts";

export type { AnchorRegistry } from "./registry.ts";
export { createAnchorRegistry } from "./registry.ts";

export type {
  StellarContractOptions,
  StellarContractSubmitter,
  StellarMemoOptions,
  StellarMemoSubmitter,
} from "./adapters/stellar.ts";
export { createStellarContractAnchor, createStellarMemoAnchor } from "./adapters/stellar.ts";

export type { MemoryAnchor } from "./adapters/memory.ts";
export { createMemoryAnchor } from "./adapters/memory.ts";
