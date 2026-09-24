// circuits/merkle.circom
// Folds a Merkle path into a root, inside the circuit.
//
// This is the gadget that replaces in-circuit signature verification. The
// issuer signs the root once, off-circuit; the subject proves their
// commitment is under it. Cost is one hash per level — for a 2^20 issuer
// set, 20 hashes, against the thousands of constraints an EdDSA gadget
// costs. See docs/ARCHITECTURE.md, "Two ways to trust an issuer".

pragma circom 2.1.6;

include "poseidon.circom";
include "domains.circom";

// One level. `isRight` says whether the running node sits on the right, so
// the pair is hashed in the order the off-circuit builder used. A gadget
// that hashed the pair unordered would let a sibling be swapped for the
// node and still fold to the same root.
template MerkleLevel() {
    signal input node;
    signal input sibling;
    signal input isRight; // 0 or 1
    signal output out;

    // Constrain the selector to a bit. Without this line a prover could pass
    // isRight = 7 and the two mux equations below would produce a pair that
    // is neither ordering — the single most common Circom bug of its kind.
    isRight * (isRight - 1) === 0;

    signal left;
    signal right;
    // isRight = 0 -> (node, sibling); isRight = 1 -> (sibling, node)
    left <== node + isRight * (sibling - node);
    right <== sibling + isRight * (node - sibling);

    // The domain goes in front, exactly as core/src/merkle.ts puts it in front
    // of the bytes: a leaf and a node must not be able to hash to each other,
    // or a prover shows a node as a leaf and the tree stops meaning anything.
    component h = Poseidon(3);
    h.inputs[0] <== DOMAIN_MERKLE_NODE();
    h.inputs[1] <== left;
    h.inputs[2] <== right;
    out <== h.out;
}

// The commitment is not the leaf. `core/` hashes it once more under its own
// domain, and a path that starts at the bare commitment folds to a root this
// repository never published.
template MerkleLeaf() {
    signal input commitment;
    signal output out;

    component h = Poseidon(2);
    h.inputs[0] <== DOMAIN_MERKLE_LEAF();
    h.inputs[1] <== commitment;
    out <== h.out;
}

// Takes the COMMITMENT, not the leaf: hashing it is the gadget's job so a
// caller cannot forget to.
template MerklePath(depth) {
    signal input commitment;
    signal input siblings[depth];
    signal input isRight[depth];
    signal output root;

    component leafHash = MerkleLeaf();
    leafHash.commitment <== commitment;

    component levels[depth];
    signal running[depth + 1];
    running[0] <== leafHash.out;

    for (var i = 0; i < depth; i++) {
        levels[i] = MerkleLevel();
        levels[i].node <== running[i];
        levels[i].sibling <== siblings[i];
        levels[i].isRight <== isRight[i];
        running[i + 1] <== levels[i].out;
    }

    root <== running[depth];
}
