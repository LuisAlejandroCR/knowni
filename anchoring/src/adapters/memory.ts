// anchoring/src/adapters/memory.ts
// An in-process anchor with a real nullifier set. Two uses, both honest:
// every test in this repository runs against it, and a deployment that has
// not chosen a chain yet can run the whole journey on it and swap later —
// which is the claim the port makes, exercised rather than asserted.

import type { AnchorRequest, AnchorResult, AnchoringPort } from "../types.ts";
import { degraded, nowSeconds } from "../types.ts";

export interface MemoryAnchor extends AnchoringPort {
  readonly entries: readonly { commitment: string; nullifier?: string; txRef: string }[];
  spent(nullifierHex: string): boolean;
}

export function createMemoryAnchor(chain = "memory"): MemoryAnchor {
  const entries: { commitment: string; nullifier?: string; txRef: string }[] = [];
  const nullifiers = new Set<string>();
  let counter = 0;

  return {
    chain,
    replayGuarded: true,
    entries,
    spent: (hex) => nullifiers.has(hex),
    async anchor(request: AnchorRequest): Promise<AnchorResult> {
      if (request.nullifier && nullifiers.has(request.nullifier.hex)) {
        return degraded(chain, "nullifier_already_spent");
      }
      counter += 1;
      const txRef = `mem-${counter.toString(16).padStart(8, "0")}`;
      if (request.nullifier) nullifiers.add(request.nullifier.hex);
      entries.push({
        commitment: request.commitment.hex,
        ...(request.nullifier ? { nullifier: request.nullifier.hex } : {}),
        txRef,
      });
      return {
        status: "anchored",
        receipt: {
          chain,
          commitment: request.commitment,
          txRef,
          anchoredAt: nowSeconds(),
          replayGuarded: true,
        },
      };
    },
  };
}
