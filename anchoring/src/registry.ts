// anchoring/src/registry.ts
// Which chains this deployment can anchor to, resolved at runtime.
//
// This is the piece that makes "chain-agnostic" an operational property
// rather than an architectural aspiration: the application asks for a chain
// by id and gets a port, and the only place that knows Stellar exists is the
// line that registers the Stellar adapter. Swapping the hackathon's Stellar
// anchor for an EVM one at a bank's request is a one-line change in
// composition, with no edit to any predicate, claim or disclosure.

import type { AnchoringPort, ChainId } from "./types.ts";

export interface AnchorRegistry {
  register(port: AnchoringPort): void;
  get(chain: ChainId): AnchoringPort | undefined;
  chains(): readonly ChainId[];
}

// Lowercase, colon-separated segments of alphanumerics and dashes:
// "stellar", "stellar:testnet", "evm:8453". Validated at registration
// because ChainId is an open string — the cost of not pinning the union in
// the domain layer is that the id has to be checked somewhere, and this is
// the one place it can be.
const CHAIN_ID = /^[a-z0-9-]+(?::[a-z0-9-]+)*$/;

export function createAnchorRegistry(): AnchorRegistry {
  const ports = new Map<ChainId, AnchoringPort>();
  return {
    register(port) {
      if (!CHAIN_ID.test(port.chain)) {
        throw new TypeError(`not a chain id: ${JSON.stringify(port.chain)}`);
      }
      // Registering twice is a composition bug, and a silent overwrite would
      // make it a production one: the second adapter would quietly receive
      // anchors the first was configured for.
      if (ports.has(port.chain)) {
        throw new Error(`chain already registered: ${port.chain}`);
      }
      ports.set(port.chain, port);
    },
    get: (chain) => ports.get(chain),
    chains: () => [...ports.keys()].sort(),
  };
}
