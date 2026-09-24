// issuer.ts: The step between a source answering and a subject being able to prove: commit
// each claim, put the commitments in a tree, publish the root.

import type { Claim, FieldHasher, MerkleProof, Salt } from "@knowni/core";
import { buildMerkleTree, commitClaim, hashLeaf, randomSalt } from "@knowni/core";

export interface HeldCredential {
  readonly claim: Claim;
  readonly salt: Salt;
  readonly proof: MerkleProof;
}

export interface IssuedSet {
  readonly issuerId: string;
  readonly root: string;
  readonly issuedAt: number;
  readonly size: number;
  readonly credentials: readonly HeldCredential[];
}

export interface IssueRequest {
  readonly issuerId: string;
  readonly claims: readonly Claim[];
  readonly issuedAt: number;
  readonly padTo?: number;
}

export function issueClaimSet(h: FieldHasher, request: IssueRequest): IssuedSet {
  const salted = request.claims.map((claim) => {
    const salt = randomSalt(h.prime);
    return { claim, salt, leaf: hashLeaf(h, commitClaim(h, claim, salt)) };
  });

  const padding: string[] = [];
  const target = request.padTo ?? salted.length;
  for (let i = salted.length; i < target; i += 1) {
    padding.push(hashLeaf(h, randomSalt(h.prime).hex));
  }

  const tree = buildMerkleTree(h, [...salted.map((s) => s.leaf), ...padding]);

  const credentials: HeldCredential[] = salted.map((entry) => {
    const proof = tree.proveInclusion(entry.leaf);
    if (proof === undefined) {
      throw new Error(`issuer built a tree that does not contain its own leaf: ${entry.leaf}`);
    }
    return { claim: entry.claim, salt: entry.salt, proof };
  });

  return {
    issuerId: request.issuerId,
    root: tree.root,
    issuedAt: request.issuedAt,
    size: tree.size,
    credentials,
  };
}
