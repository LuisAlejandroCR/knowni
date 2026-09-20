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

    component h = Poseidon(2);
    h.inputs[0] <== left;
    h.inputs[1] <== right;
    out <== h.out;
}

template MerklePath(depth) {
    signal input leaf;
    signal input siblings[depth];
    signal input isRight[depth];
    signal output root;

    component levels[depth];
    signal running[depth + 1];
    running[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        levels[i] = MerkleLevel();
        levels[i].node <== running[i];
        levels[i].sibling <== siblings[i];
        levels[i].isRight <== isRight[i];
        running[i + 1] <== levels[i].out;
    }

    root <== running[depth];
}
