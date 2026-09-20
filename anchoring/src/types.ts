// anchoring/src/types.ts
// The port every chain adapter implements. No chain SDK may be imported in
// this file or anywhere else in src/ outside adapters/.
//
// The one change from the shape this was ported from (creva-zk's
// anchoring/): ChainId is an open string, not a closed union of the chains
// that happened to exist when it was written. A closed union makes adding a
// chain a change to the domain layer — which is exactly the coupling the
// port exists to prevent. The tradeoff is that a typo in a chain id is
// caught at registration rather than at compile time, so registration
// validates.

// e.g. "stellar", "stellar:testnet", "evm:8453", "midnight". A chain id
// names a NETWORK, not just a protocol: an anchor on testnet and an anchor
// on mainnet are not interchangeable evidence, and a receipt that does not
// say which one it came from is not auditable.
export type ChainId = string;

// The only value that ever reaches an external chain. A blinded commitment
// to an outcome — never the outcome, never a subject reference, never a
// claim. @knowni/core's commitOutcome is its only constructor.
export interface Commitment {
  readonly hex: string;
}

// Spent-proof marker. Optional because not every anchoring backend is also
// the replay guard: a Soroban policy contract stores nullifiers and refuses
// a repeat, while a bare payment-memo anchor cannot, and an adapter must be
// able to say which it is rather than pretend.
export interface Nullifier {
  readonly hex: string;
}

export interface AnchorReceipt {
  readonly chain: ChainId;
  readonly commitment: Commitment;
  readonly txRef: string; // chain-native transaction identifier
  readonly anchoredAt: number; // unix seconds
  // Whether this chain also refused a repeated nullifier. A relying party
  // that needs replay protection and gets `false` knows it must keep its own
  // nullifier set rather than assume the chain did it.
  readonly replayGuarded: boolean;
}

// A fixed vocabulary. An adapter never surfaces a raw provider error here —
// those carry endpoints, account state and stack fragments, and a relying
// party's UI is not the place for them. Raw errors go to a logger.
export type AnchorFailureReason =
  | "provider_unavailable"
  | "invalid_response"
  | "nullifier_already_spent"
  | "rejected_by_policy";

export interface AnchorDegraded {
  readonly chain: ChainId;
  readonly reason: AnchorFailureReason;
}

// Degraded is the only failure an adapter may surface: never a thrown error,
// never a synthesised receipt. A verification that could not be anchored
// still answered the question — anchoring is durability, not the verdict.
export type AnchorResult =
  | { readonly status: "anchored"; readonly receipt: AnchorReceipt }
  | { readonly status: "degraded"; readonly degraded: AnchorDegraded };

export interface AnchorRequest {
  readonly commitment: Commitment;
  readonly nullifier?: Nullifier;
}

export interface AnchoringPort {
  readonly chain: ChainId;
  readonly replayGuarded: boolean;
  anchor(request: AnchorRequest): Promise<AnchorResult>;
}

export type Logger = (error: unknown) => void;

export function degraded(chain: ChainId, reason: AnchorFailureReason): AnchorResult {
  return { status: "degraded", degraded: { chain, reason } };
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
