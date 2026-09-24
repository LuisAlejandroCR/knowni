// circuits/eligibility.circom
// The predicate, as a circuit: four private claims are checked against
// public parameters, and one packed outcome comes out.
//
// The disclosure table is the whole specification. Read it before changing a
// signal — a field moved from `private` to a public input is a product
// change, not a refactor.
//
//   PRIVATE (witness, never leaves the device)
//     documentValid, subjectAlive, ofAge   the identity facts
//     monthlyMinor                         the income figure itself
//     lastContributionMonth, monthsPaid    the contribution history
//     listed                               the screening result
//     salt*, siblings*, isRight*           the commitment openings and paths
//     subjectSecret                        derives the nullifier
//
//   PUBLIC (inputs the relying party chooses and can read)
//     issuerRoot                           which published set is trusted
//     sessionId                            who is asking, for what, until when
//     expectedSubjectRef                   which subject this is about
//     rentMinor                            the obligation being underwritten
//     nowMonth, maxStaleMonths, minMonths  the formality window
//     listSetRoot                          which screening snapshot counts
//
//   OUTPUTS (disclosed — the only witness-derived values that become public)
//     personhood, solvencyTier, formality, standing
//     nullifier                            spent-once marker, unlinkable
//                                          across relying parties
//
// The comparisons here are the same ones core/src/predicates.ts performs, on
// the same encodings, and core/test/predicates.test.ts is the shared spec.
// A case added there is a case this circuit owes an answer to.
//
// STATUS: this is the circuit source, not a compiled artifact. See
// circuits/README.md for exactly what has and has not been run.

pragma circom 2.1.6;

include "poseidon.circom";
include "comparators.circom";
include "merkle.circom";

// depth of the issuer's published tree: 2^20 claims per root.
template Eligibility(depth) {
    // ---- public ----
    signal input issuerRoot;
    signal input sessionId;
    signal input expectedSubjectRef;
    signal input rentMinor;
    signal input nowMonth;          // YYYYMM as an integer
    signal input maxStaleMonths;
    signal input minMonthsPaid;
    signal input listSetRoot;

    // ---- private: identity ----
    signal input idSubjectRef;
    signal input documentValid;
    signal input subjectAlive;
    signal input ofAge;
    signal input idSalt;
    signal input idSiblings[depth];
    signal input idIsRight[depth];

    // ---- private: income ----
    signal input incSubjectRef;
    signal input monthlyMinor;
    signal input incSalt;
    signal input incSiblings[depth];
    signal input incIsRight[depth];

    // ---- private: formality ----
    signal input lastContributionMonth;
    signal input monthsPaid;

    // ---- private: standing ----
    signal input listed;
    signal input claimListSetRoot;

    // ---- private: subject ----
    signal input subjectSecret;

    // ---- disclosed ----
    signal output personhood;
    signal output solvencyTier;
    signal output formality;
    signal output standing;
    signal output nullifier;

    // Every boolean the prover supplies is constrained to a bit. An
    // unconstrained "boolean" of 2 makes every AND below meaningless.
    documentValid * (documentValid - 1) === 0;
    subjectAlive * (subjectAlive - 1) === 0;
    ofAge * (ofAge - 1) === 0;
    listed * (listed - 1) === 0;

    // --- the claims are in the issuer's published set ---
    // Without these two, the prover could invent any claim they like: a ZK
    // proof shows SOME witness satisfies the circuit, and an unanchored
    // witness satisfies it trivially.
    component idCommit = Poseidon(6);
    idCommit.inputs[0] <== idSubjectRef;
    idCommit.inputs[1] <== documentValid;
    idCommit.inputs[2] <== subjectAlive;
    idCommit.inputs[3] <== ofAge;
    idCommit.inputs[4] <== listSetRoot; // domain pin; see README
    idCommit.inputs[5] <== idSalt;

    component idPath = MerklePath(depth);
    idPath.commitment <== idCommit.out;
    for (var i = 0; i < depth; i++) {
        idPath.siblings[i] <== idSiblings[i];
        idPath.isRight[i] <== idIsRight[i];
    }
    idPath.root === issuerRoot;

    component incCommit = Poseidon(3);
    incCommit.inputs[0] <== incSubjectRef;
    incCommit.inputs[1] <== monthlyMinor;
    incCommit.inputs[2] <== incSalt;

    component incPath = MerklePath(depth);
    incPath.commitment <== incCommit.out;
    for (var i = 0; i < depth; i++) {
        incPath.siblings[i] <== incSiblings[i];
        incPath.isRight[i] <== incIsRight[i];
    }
    incPath.root === issuerRoot;

    // --- both claims are about the subject the relying party named ---
    // This is what stops a valid attestation issued for a solvent guarantor
    // being presented alongside someone else's identity.
    idSubjectRef === expectedSubjectRef;
    incSubjectRef === expectedSubjectRef;

    // --- personhood ---
    signal alive;
    alive <== documentValid * subjectAlive;
    personhood <== alive * ofAge;

    // --- solvency: a band, never the amount ---
    // Three comparisons, packed into a tier. 64-bit range: COP cents fit
    // comfortably, and LessThan is unsound above its declared bit width.
    component ge1 = GreaterEqThan(64);
    ge1.in[0] <== monthlyMinor;
    ge1.in[1] <== rentMinor;

    component ge2 = GreaterEqThan(64);
    ge2.in[0] <== monthlyMinor;
    ge2.in[1] <== 2 * rentMinor;

    component ge3 = GreaterEqThan(64);
    ge3.in[0] <== monthlyMinor;
    ge3.in[1] <== 3 * rentMinor;

    // 0, 1, 2 or 3 — the tiers are cumulative, so the sum IS the tier.
    solvencyTier <== ge1.out + ge2.out + ge3.out;

    // --- formality ---
    // Month distance without a calendar: YYYYMM arithmetic, exactly as
    // core/src/predicates.ts does it.
    signal nowY;   nowY   <-- nowMonth \ 100;
    signal nowM;   nowM   <-- nowMonth % 100;
    nowMonth === nowY * 100 + nowM;

    signal lastY;  lastY  <-- lastContributionMonth \ 100;
    signal lastM;  lastM  <-- lastContributionMonth % 100;
    lastContributionMonth === lastY * 100 + lastM;

    signal staleness;
    staleness <== (nowY - lastY) * 12 + (nowM - lastM);

    component fresh = LessEqThan(16);
    fresh.in[0] <== staleness;
    fresh.in[1] <== maxStaleMonths;

    component enough = GreaterEqThan(8);
    enough.in[0] <== monthsPaid;
    enough.in[1] <== minMonthsPaid;

    formality <== fresh.out * enough.out;

    // --- standing ---
    // The claim must have been screened against the snapshot the relying
    // party named. "Clean" against a root nobody published is not an answer.
    claimListSetRoot === listSetRoot;
    standing <== 1 - listed;

    // --- nullifier ---
    // Mixing sessionId in is what makes two relying parties unable to join
    // their records on the same subject.
    component nul = Poseidon(2);
    nul.inputs[0] <== subjectSecret;
    nul.inputs[1] <== sessionId;
    nullifier <== nul.out;
}

component main {
    public [
        issuerRoot,
        sessionId,
        expectedSubjectRef,
        rentMinor,
        nowMonth,
        maxStaleMonths,
        minMonthsPaid,
        listSetRoot
    ]
} = Eligibility(20);
