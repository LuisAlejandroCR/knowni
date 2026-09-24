// merkle.ts: the issuer's tree and the inclusion check a verifier runs.
// It does NOT yet fold the way circuits/merkle.circom folds: this side puts a
// domain between leaves and nodes and that side hashes the pair bare. Measured
// and written down in docs/memoria.md D-54; until it is settled, a root here
// and a root there are different numbers.

import type { FieldHasher } from "./field-hasher.ts";
import { utf8 } from "./hash.ts";

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

export function hashLeaf(h: FieldHasher, commitmentHex: string): string {
  return h.toHex(h.hashFields("merkleLeaf", [h.fromHex(commitmentHex, "commitment")]));
}

function hashNode(h: FieldHasher, left: string, right: string): string {
  return h.toHex(h.hashFields("merkleNode", [h.fromHex(left, "left"), h.fromHex(right, "right")]));
}

export function buildMerkleTree(h: FieldHasher, leaves: readonly string[]): MerkleTree {
  if (leaves.length === 0) {
    // An empty set still needs a root a contract can pin, and it must not be
    // a value any leaf could hash to.
    const empty = h.toHex(h.hashFields("merkleEmpty", [0n]));
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

export function verifyInclusion(h: FieldHasher, proof: MerkleProof): boolean {
  let node = proof.leaf;
  for (const step of proof.path) {
    node = step.right ? hashNode(h, node, step.sibling) : hashNode(h, step.sibling, node);
  }
  return constantTimeEqualHex(node, proof.root);
}

export function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export { utf8 };
