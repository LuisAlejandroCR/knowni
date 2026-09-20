// sources/src/issuer.ts
// The step between a source answering and a subject being able to prove:
// commit each claim, put the commitments in a tree, publish the root.
//
// This is where the architecture stops needing the issuer to be online. Once
// the root is published, the subject proves against it by themselves,
// forever — or until the issuer republishes a root without their leaf, which
// is what revocation is. Neither a proof nor a verification ever calls back
// to the source.
//
// It is also the reason no signature verification happens inside a circuit
// here: the issuer signs the ROOT, once, out of circuit, and a Merkle path
// is one hash per level. See docs/ARCHITECTURE.md, "Two ways to trust an
// issuer".

import type { Claim, FieldHash, MerkleProof, Salt } from "@knowni/core";
import { buildMerkleTree, commitClaim, hashLeaf, randomSalt } from "@knowni/core";

// What the subject keeps for one claim: the claim itself, the salt that
// hides it, and the path proving it is in the published set. All three are
// needed to prove, and none of them leave the device.
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
  // Real issuance batches thousands of claims and the subject receives one.
  // Padding to a fixed batch size hides HOW MANY claims an issuer wrote in a
  // round, which otherwise leaks activity volume to anyone watching the
  // published root's tree size.
  readonly padTo?: number;
}

export function issueClaimSet(h: FieldHash, request: IssueRequest): IssuedSet {
  const salted = request.claims.map((claim) => {
    const salt = randomSalt();
    return { claim, salt, leaf: hashLeaf(h, commitClaim(h, claim, salt)) };
  });

  // Padding leaves are indistinguishable from real ones: each is a leaf hash
  // over 32 random bytes, which is exactly what a real commitment looks like
  // from outside.
  const padding: string[] = [];
  const target = request.padTo ?? salted.length;
  for (let i = salted.length; i < target; i += 1) {
    padding.push(hashLeaf(h, randomSalt().hex));
  }

  const tree = buildMerkleTree(h, [...salted.map((s) => s.leaf), ...padding]);

  const credentials: HeldCredential[] = salted.map((entry) => {
    const proof = tree.proveInclusion(entry.leaf);
    // The leaf was just placed in this tree; no proof means the tree is
    // broken, and issuing a credential that cannot prove would fail later,
    // on the subject's device, where it cannot be diagnosed.
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
