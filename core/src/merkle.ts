// core/src/merkle.ts
// The issuer's published claim set, as a Merkle tree, and the inclusion
// proof a subject presents against it.
//
// Why this and not an in-circuit signature check: a signature verification
// gadget is the single most expensive thing a predicate circuit can do, and
// it forces the circuit's embedded curve to match the issuer's key. A Merkle
// path costs one hash per level and is indifferent to how the issuer signs.
// The issuer signs the ROOT, once, out of circuit — see docs/ARCHITECTURE.md,
// "Two ways to trust an issuer".
//
// Revocation comes free: an issuer who republishes the root without a leaf
// has revoked that claim, and a proof against the old root is refused by the
// on-chain policy that pins the current one.

import type { FieldHash } from "./hash.ts";
import { fromHex, u32be, utf8 } from "./hash.ts";

const LEAF_DOMAIN = "knowni:merkle:leaf:v1";
const NODE_DOMAIN = "knowni:merkle:node:v1";

export interface MerkleProof {
  readonly leaf: string; // hex
  readonly root: string; // hex
  // Sibling at each level, bottom-up, with the side the sibling sits on.
  readonly path: readonly { readonly sibling: string; readonly right: boolean }[];
}

export interface MerkleTree {
  readonly root: string;
  readonly size: number;
  proveInclusion(leaf: string): MerkleProof | undefined;
}

// Leaves and internal nodes are hashed under DIFFERENT domains. Without
// that separation a caller who can choose a leaf's bytes can submit a value
// that is really an internal node, and prove membership of something the
// issuer never put in the tree (the classic second-preimage attack on
// unbalanced Merkle trees).
export function hashLeaf(h: FieldHash, commitmentHex: string): string {
  return h.hash(LEAF_DOMAIN, [fromHex(commitmentHex)]);
}

function hashNode(h: FieldHash, left: string, right: string): string {
  return h.hash(NODE_DOMAIN, [fromHex(left), fromHex(right)]);
}

// Builds the tree over already-hashed leaves. An odd level promotes its last
// node unchanged rather than duplicating it: duplicating the last leaf lets
// a 3-leaf tree and a 4-leaf tree with a repeated last element share a root,
// which is a forgery surface. Promotion cannot collide, because a promoted
// node is carried, never re-hashed.
export function buildMerkleTree(h: FieldHash, leaves: readonly string[]): MerkleTree {
  if (leaves.length === 0) {
    // An empty set still needs a root a contract can pin, and it must not be
    // a value any leaf could hash to.
    const empty = h.hash("knowni:merkle:empty:v1", [u32be(0)]);
    return { root: empty, size: 0, proveInclusion: () => undefined };
  }

  const levels: string[][] = [[...leaves]];
  while (levels[levels.length - 1]!.length > 1) {
    const prev = levels[levels.length - 1]!;
    const next: string[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const left = prev[i]!;
      const right = prev[i + 1];
      next.push(right === undefined ? left : hashNode(h, left, right));
    }
    levels.push(next);
  }

  const root = levels[levels.length - 1]![0]!;

  return {
    root,
    size: leaves.length,
    proveInclusion(leaf) {
      let index = levels[0]!.indexOf(leaf);
      if (index < 0) return undefined;

      const path: { sibling: string; right: boolean }[] = [];
      for (let level = 0; level < levels.length - 1; level += 1) {
        const nodes = levels[level]!;
        const isRightChild = index % 2 === 1;
        const siblingIndex = isRightChild ? index - 1 : index + 1;
        const sibling = nodes[siblingIndex];
        // No sibling means this node was promoted, not combined — there is
        // nothing to hash against at this level.
        if (sibling !== undefined) path.push({ sibling, right: !isRightChild });
        index = Math.floor(index / 2);
      }
      return { leaf, root, path };
    },
  };
}

// The verifier side, and the exact computation the circuit performs: fold
// the path into a root and compare. It never looks the leaf up anywhere —
// that is the point, the relying party holds only the root.
export function verifyInclusion(h: FieldHash, proof: MerkleProof): boolean {
  let node = proof.leaf;
  for (const step of proof.path) {
    node = step.right ? hashNode(h, node, step.sibling) : hashNode(h, step.sibling, node);
  }
  return constantTimeEqualHex(node, proof.root);
}

// A root comparison is not secret-dependent, but the same helper is used for
// commitment openings below, where it is — so there is one comparison in the
// codebase and it is the safe one.
export function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export { utf8 };
