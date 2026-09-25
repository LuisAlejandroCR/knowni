//! Knowni's on-chain half: verify the proof, apply the policy, record that
//! it was spent.
//!
//! The split is deliberate and it is the reason this contract is small.
//! Groth16 verification is pure cryptography and says only "some witness
//! satisfies the circuit". Everything that makes that statement *mean*
//! something — whose issuer root, which session, spent already? — is policy,
//! and policy is where the attacks land. So:
//!
//!   1. the verifying key is pinned at deployment, never passed in;
//!   2. the public signals are checked for what they SAY, not just that they
//!      verify;
//!   3. the nullifier is marked spent before any effect is applied.
//!
//! Skipping (2) is the classic "verified the proof but not the statement"
//! bug: a valid proof about a different issuer root, or a session that is
//! not this one, would otherwise sail through.
//!
//! STATUS: compiles, the policy above is tested in `test.rs`, and a real
//! Groth16 proof over BLS12-381 verifies in `test_real_proof.rs` against a
//! development key, and on Stellar testnet (D-83). No measured fee or proof-verification
//! time is claimed anywhere in this repository.

#![no_std]

#[cfg(test)]
mod test;
#[cfg(test)]
mod real_proof;
#[cfg(test)]
mod test_real_proof;

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    crypto::bls12_381::{Fr, G1Affine, G2Affine},
    vec, Address, BytesN, Env, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct VerificationKey {
    pub alpha: G1Affine,
    pub beta: G2Affine,
    pub gamma: G2Affine,
    pub delta: G2Affine,
    pub ic: Vec<G1Affine>,
}

#[contracttype]
#[derive(Clone)]
pub struct Proof {
    pub a: G1Affine,
    pub b: G2Affine,
    pub c: G1Affine,
}

/// The public signals, named. The circuit emits them as a flat `Vec<Fr>`;
/// giving them a struct here is what lets the policy check say
/// `signals.issuer_root` instead of `signals.get(3)`, which is how an
/// off-by-one in signal order becomes a silent authorisation bug.
#[contracttype]
#[derive(Clone)]
pub struct PublicSignals {
    pub issuer_root: BytesN<32>,
    pub session_id: BytesN<32>,
    pub nullifier: BytesN<32>,
    pub list_set_root: BytesN<32>,
    pub personhood: bool,
    pub solvency_tier: u32,
    pub formality: bool,
    pub sanctions: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Vk,
    /// Issuer roots this contract accepts, each with the ledger it was
    /// registered at. A root is added by the admin and *not* removed: a
    /// verification that was valid against a root must stay auditable after
    /// the issuer rotates. Revocation happens by the issuer republishing a
    /// root without a leaf, not by deleting history here.
    IssuerRoot(BytesN<32>),
    /// Spent nullifiers. Persistent, never temporary: a replay guard in
    /// temporary storage expires, and an expired replay guard is no replay
    /// guard at all.
    Nullifier(BytesN<32>),
    /// The anchored commitment for a session.
    Anchor(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    MalformedVerifyingKey = 3,
    InvalidProof = 4,
    UnknownIssuerRoot = 5,
    NullifierAlreadySpent = 6,
    PredicateNotSatisfied = 7,
}

#[contract]
pub struct KnowniVerifier;

#[contractimpl]
impl KnowniVerifier {
    /// The verifying key is set once, here, and is never a call argument.
    ///
    /// A `verify(vk, proof, signals)` entry point is verifiable and useless:
    /// a caller who supplies the key proves only that they hold a key and a
    /// matching proof, which they can always manufacture. Pinning it is what
    /// makes a proof a statement about *this* circuit.
    pub fn __constructor(env: Env, admin: Address, vk: VerificationKey) {
        if env.storage().instance().has(&DataKey::Vk) {
            panic_with_error(&env, Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Vk, &vk);
    }

    /// Registers an issuer's published root. Admin-only: an unregistered
    /// root is an unknown issuer, and a proof against one is refused.
    pub fn register_issuer_root(env: Env, root: BytesN<32>) {
        Self::admin(&env).require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::IssuerRoot(root), &env.ledger().sequence());
    }

    /// Verify a Knowni eligibility proof and record the outcome.
    ///
    /// Order matters and is load-bearing: the statement is checked before
    /// the cryptography (cheap rejections first, and a caller cannot spend
    /// gas probing the pairing), and the nullifier is marked spent *before*
    /// the anchor is written, so a re-entrant caller finds it already gone.
    pub fn anchor(
        env: Env,
        proof: Proof,
        signals: PublicSignals,
        raw_signals: Vec<Fr>,
        commitment: BytesN<32>,
        min_tier: u32,
    ) -> Result<(), Error> {
        // (2) — what the proof SAYS, before whether it verifies.
        if !env
            .storage()
            .persistent()
            .has(&DataKey::IssuerRoot(signals.issuer_root.clone()))
        {
            return Err(Error::UnknownIssuerRoot);
        }

        if env
            .storage()
            .persistent()
            .has(&DataKey::Nullifier(signals.nullifier.clone()))
        {
            return Err(Error::NullifierAlreadySpent);
        }

        if !signals.personhood
            || !signals.formality
            || !signals.sanctions
            || signals.solvency_tier < min_tier
        {
            return Err(Error::PredicateNotSatisfied);
        }

        // The named struct and the flat vector must agree, or the policy
        // above checked one set of values while the pairing checked another
        // — the whole bug this struct exists to prevent, reintroduced by the
        // plumbing.
        if !signals_match(&env, &signals, &raw_signals) {
            return Err(Error::InvalidProof);
        }

        if !Self::verify_proof(env.clone(), proof, raw_signals)? {
            return Err(Error::InvalidProof);
        }

        // (3) — spend first, then record.
        env.storage()
            .persistent()
            .set(&DataKey::Nullifier(signals.nullifier.clone()), &true);
        env.storage()
            .persistent()
            .set(&DataKey::Anchor(signals.session_id.clone()), &commitment);

        // The event carries the commitment and the session, never the
        // outcome: an observer learns that a verification happened, not what
        // it concluded.
        env.events().publish(
            (symbol_short_anchored(), signals.session_id),
            commitment,
        );
        Ok(())
    }

    /// Whether a session's commitment is on record. Read-only, and it
    /// returns the commitment rather than the outcome — opening it needs the
    /// blinding factor the subject kept.
    pub fn anchored(env: Env, session_id: BytesN<32>) -> Option<BytesN<32>> {
        env.storage().persistent().get(&DataKey::Anchor(session_id))
    }

    pub fn spent(env: Env, nullifier: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Nullifier(nullifier))
    }

    /// The canonical Groth16 check over BLS12-381, verbatim from Stellar's
    /// `groth16_verifier` example, against the pinned key.
    fn verify_proof(env: Env, proof: Proof, pub_signals: Vec<Fr>) -> Result<bool, Error> {
        let vk: VerificationKey = env
            .storage()
            .instance()
            .get(&DataKey::Vk)
            .ok_or(Error::NotInitialized)?;

        if pub_signals.len() + 1 != vk.ic.len() {
            return Err(Error::MalformedVerifyingKey);
        }

        let bls = env.crypto().bls12_381();
        let mut vk_x = vk.ic.get(0).ok_or(Error::MalformedVerifyingKey)?;
        for (s, v) in pub_signals.iter().zip(vk.ic.iter().skip(1)) {
            vk_x = bls.g1_add(&vk_x, &bls.g1_mul(&v, &s));
        }

        let neg_a = -proof.a;
        let vp1 = vec![&env, neg_a, vk.alpha, vk_x, proof.c];
        let vp2 = vec![&env, proof.b, vk.beta, vk.gamma, vk.delta];
        Ok(bls.pairing_check(vp1, vp2))
    }

    fn admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error(env, Error::NotInitialized))
    }
}

/// Checks the named signals against the flat vector the pairing consumes.
///
/// The signal ORDER here must match `component main { public [...] }` in
/// `circuits/eligibility.circom`, plus the circuit's outputs, which Circom
/// places ahead of the declared public inputs. Getting it wrong does not
/// fail loudly — it authorises the wrong statement — so it is asserted in
/// `test.rs` against a fixture generated by the circuit itself.
// The index of each signal this contract reads, in the flat vector the pairing
// consumes. These are not a reading of the circuit: `circuits/eligibility.
// signals.txt` is written by the Circom compiler's own symbol table, and
// `test.rs` asserts every constant below against it.
pub const SIGNAL_COUNT: u32 = 13;
pub(crate) const AT_PERSONHOOD: u32 = 0;
pub(crate) const AT_SOLVENCY_TIER: u32 = 1;
pub(crate) const AT_FORMALITY: u32 = 2;
pub(crate) const AT_SANCTIONS: u32 = 3;
pub(crate) const AT_NULLIFIER: u32 = 4;
pub(crate) const AT_ISSUER_ROOT: u32 = 5;
pub(crate) const AT_SESSION_ID: u32 = 6;
pub(crate) const AT_LIST_SET_ROOT: u32 = 12;

fn signals_match(env: &Env, named: &PublicSignals, raw: &Vec<Fr>) -> bool {
    // Outputs first (personhood, solvencyTier, formality, sanctions,
    // nullifier), then the declared public inputs.
    if raw.len() != SIGNAL_COUNT {
        return false;
    }
    fr_eq_bool(env, raw.get(AT_PERSONHOOD), named.personhood)
        && fr_eq_u32(env, raw.get(AT_SOLVENCY_TIER), named.solvency_tier)
        && fr_eq_bool(env, raw.get(AT_FORMALITY), named.formality)
        && fr_eq_bool(env, raw.get(AT_SANCTIONS), named.sanctions)
        && fr_eq_bytes(raw.get(AT_NULLIFIER), &named.nullifier)
        && fr_eq_bytes(raw.get(AT_ISSUER_ROOT), &named.issuer_root)
        && fr_eq_bytes(raw.get(AT_SESSION_ID), &named.session_id)
        && fr_eq_bytes(raw.get(AT_LIST_SET_ROOT), &named.list_set_root)
}

fn fr_eq_bool(env: &Env, value: Option<Fr>, expected: bool) -> bool {
    fr_eq_u32(env, value, u32::from(expected))
}

fn fr_eq_u32(env: &Env, value: Option<Fr>, expected: u32) -> bool {
    match value {
        Some(fr) => fr == Fr::from_u256(soroban_sdk::U256::from_u32(env, expected)),
        None => false,
    }
}

fn fr_eq_bytes(value: Option<Fr>, expected: &BytesN<32>) -> bool {
    match value {
        // Fr is 32 bytes big-endian, the same layout the off-circuit
        // encoders in core/src/hash.ts produce.
        Some(fr) => fr.to_bytes() == expected.clone(),
        None => false,
    }
}

fn symbol_short_anchored() -> soroban_sdk::Symbol {
    soroban_sdk::symbol_short!("anchored")
}

fn panic_with_error(env: &Env, error: Error) -> ! {
    soroban_sdk::panic_with_error!(env, error)
}
