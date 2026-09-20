// types.ts: The port every chain adapter implements. No chain SDK may be imported in this file
// or anywhere else in src/ outside adapters/.

export type ChainId = string;

export interface Commitment {
  readonly hex: string;
}

export interface Nullifier {
  readonly hex: string;
}

export interface AnchorReceipt {
  readonly chain: ChainId;
  readonly commitment: Commitment;
  readonly txRef: string; // chain-native transaction identifier
  readonly anchoredAt: number; // unix seconds
  readonly replayGuarded: boolean;
}

export type AnchorFailureReason =
  | "provider_unavailable"
  | "invalid_response"
  | "nullifier_already_spent"
  | "rejected_by_policy";

export interface AnchorDegraded {
  readonly chain: ChainId;
  readonly reason: AnchorFailureReason;
}

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
