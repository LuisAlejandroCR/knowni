// registry.ts: which chains this deployment can anchor to, resolved at runtime.
// Validates a chain id at registration and picks an adapter by name, so adding
// a chain is configuration rather than a change to the domain.

import type { AnchoringPort, ChainId } from "./types.ts";

export interface AnchorRegistry {
  register(port: AnchoringPort): void;
  get(chain: ChainId): AnchoringPort | undefined;
  chains(): readonly ChainId[];
}

const CHAIN_ID = /^[a-z0-9-]+(?::[a-z0-9-]+)*$/;

export function createAnchorRegistry(): AnchorRegistry {
  const ports = new Map<ChainId, AnchoringPort>();
  return {
    register(port) {
      if (!CHAIN_ID.test(port.chain)) {
        throw new TypeError(`not a chain id: ${JSON.stringify(port.chain)}`);
      }
      if (ports.has(port.chain)) {
        throw new Error(`chain already registered: ${port.chain}`);
      }
      ports.set(port.chain, port);
    },
    get: (chain) => ports.get(chain),
    chains: () => [...ports.keys()].sort(),
  };
}
