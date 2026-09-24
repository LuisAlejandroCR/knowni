// claims.circom: a claim's commitment, as core computes it.
// The element order is core/src/claim-fields.ts and nothing else: the domain,
// the kind tag, the head every claim shares, then the kind's own fields, then
// the salt. A gadget per kind because a field hash has a fixed width and a
// padded variable-length list is how two claims share one commitment.

pragma circom 2.1.6;

include "poseidon_knowni.circom";
include "domains.circom";

template IdentityCommitment() {
    signal input jurisdiction;   // core hashes the string; this is the element
    signal input subjectRef;
    signal input documentKind;   // likewise
    signal input documentValid;
    signal input subjectAlive;
    signal input ofAge;
    signal input attestedAt;
    signal input salt;
    signal output out;

    component h = PoseidonKnowni10();
    h.inputs[0] <== DOMAIN_CLAIM();
    h.inputs[1] <== KIND_IDENTITY();
    h.inputs[2] <== jurisdiction;
    h.inputs[3] <== subjectRef;
    h.inputs[4] <== documentKind;
    h.inputs[5] <== documentValid;
    h.inputs[6] <== subjectAlive;
    h.inputs[7] <== ofAge;
    h.inputs[8] <== attestedAt;
    h.inputs[9] <== salt;
    out <== h.out;
}

template IncomeCommitment() {
    signal input jurisdiction;
    signal input subjectRef;
    signal input monthlyMinor;
    signal input currency;
    signal input basis;
    signal input periodsObserved;
    signal input periodsWindow;
    signal input attestedAt;
    signal input salt;
    signal output out;

    component h = PoseidonKnowni11();
    h.inputs[0] <== DOMAIN_CLAIM();
    h.inputs[1] <== KIND_INCOME();
    h.inputs[2] <== jurisdiction;
    h.inputs[3] <== subjectRef;
    h.inputs[4] <== monthlyMinor;
    h.inputs[5] <== currency;
    h.inputs[6] <== basis;
    h.inputs[7] <== periodsObserved;
    h.inputs[8] <== periodsWindow;
    h.inputs[9] <== attestedAt;
    h.inputs[10] <== salt;
    out <== h.out;
}
