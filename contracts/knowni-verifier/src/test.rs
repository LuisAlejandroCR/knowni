//! test.rs: the policy layer of the contract, which is where the attacks land.
//! Every case here is refused before the pairing runs, so none of them needs a
//! real proof — that is the order the contract promises, asserted.

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Env,
};

const G1_SIZE: u32 = 96;
const G2_SIZE: u32 = 192;

/// A key of the right SHAPE and no cryptographic meaning. Every test in this
/// file is refused before the pairing, so the points are never touched.
fn dummy_vk(env: &Env) -> VerificationKey {
    let mut ic = Vec::new(env);
    // One point per public signal, plus the constant term.
    for _ in 0..14 {
        ic.push_back(g1(env));
    }
    VerificationKey { alpha: g1(env), beta: g2(env), gamma: g2(env), delta: g2(env), ic }
}

fn g1(env: &Env) -> G1Affine {
    G1Affine::from_bytes(BytesN::from_array(env, &[0u8; G1_SIZE as usize]))
}

fn g2(env: &Env) -> G2Affine {
    G2Affine::from_bytes(BytesN::from_array(env, &[0u8; G2_SIZE as usize]))
}

fn dummy_proof(env: &Env) -> Proof {
    Proof { a: g1(env), b: g2(env), c: g1(env) }
}

fn bytes32(env: &Env, tag: u8) -> BytesN<32> {
    BytesN::from_array(env, &[tag; 32])
}

fn satisfying_signals(env: &Env) -> PublicSignals {
    PublicSignals {
        issuer_root: bytes32(env, 1),
        session_id: bytes32(env, 2),
        nullifier: bytes32(env, 3),
        list_set_root: bytes32(env, 4),
        personhood: true,
        solvency_tier: 3,
        formality: true,
        standing: true,
    }
}

/// The flat vector the pairing consumes, in the order `signals_match` expects.
fn raw_signals(env: &Env, named: &PublicSignals) -> Vec<Fr> {
    let mut raw = Vec::new(env);
    raw.push_back(fr_u32(env, u32::from(named.personhood)));
    raw.push_back(fr_u32(env, named.solvency_tier));
    raw.push_back(fr_u32(env, u32::from(named.formality)));
    raw.push_back(fr_u32(env, u32::from(named.standing)));
    raw.push_back(fr_bytes(&named.nullifier));
    raw.push_back(fr_bytes(&named.issuer_root));
    raw.push_back(fr_bytes(&named.session_id));
    for _ in 7..11 {
        raw.push_back(fr_u32(env, 0));
    }
    raw.push_back(fr_bytes(&named.list_set_root));
    raw.push_back(fr_u32(env, 0));
    raw
}

fn fr_u32(env: &Env, value: u32) -> Fr {
    Fr::from_u256(soroban_sdk::U256::from_u32(env, value))
}

fn fr_bytes(value: &BytesN<32>) -> Fr {
    Fr::from_bytes(value.clone())
}

struct Fixture {
    env: Env,
    client: KnowniVerifierClient<'static>,
    id: Address,
}

fn deploy() -> Fixture {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let vk = dummy_vk(&env);
    let id = env.register(KnowniVerifier, (admin, vk));
    let client = KnowniVerifierClient::new(&env, &id);
    Fixture { env, client, id }
}

impl Fixture {
    /// Seeds storage the way a successful `anchor` would, so a replay can be
    /// tested without a proof that verifies.
    fn seed(&self, key: DataKey) {
        self.env.as_contract(&self.id, || {
            self.env.storage().persistent().set(&key, &true);
        });
    }
}

#[test]
fn a_root_nobody_registered_is_an_unknown_issuer() {
    let f = deploy();
    let signals = satisfying_signals(&f.env);
    let raw = raw_signals(&f.env, &signals);

    let result = f.client.try_anchor(
        &dummy_proof(&f.env),
        &signals,
        &raw,
        &bytes32(&f.env, 9),
        &1,
    );

    assert_eq!(result, Err(Ok(Error::UnknownIssuerRoot)));
}

#[test]
fn a_nullifier_already_spent_is_refused_before_anything_else_happens() {
    let f = deploy();
    let signals = satisfying_signals(&f.env);
    f.client.register_issuer_root(&signals.issuer_root);
    f.seed(DataKey::Nullifier(signals.nullifier.clone()));
    let raw = raw_signals(&f.env, &signals);

    let result = f.client.try_anchor(
        &dummy_proof(&f.env),
        &signals,
        &raw,
        &bytes32(&f.env, 9),
        &1,
    );

    assert_eq!(result, Err(Ok(Error::NullifierAlreadySpent)));
    assert_eq!(f.client.anchored(&signals.session_id), None);
}

#[test]
fn a_tier_below_what_the_counterparty_asked_is_not_satisfied() {
    let f = deploy();
    let mut signals = satisfying_signals(&f.env);
    signals.solvency_tier = 2;
    f.client.register_issuer_root(&signals.issuer_root);
    let raw = raw_signals(&f.env, &signals);

    let result = f.client.try_anchor(
        &dummy_proof(&f.env),
        &signals,
        &raw,
        &bytes32(&f.env, 9),
        &3,
    );

    assert_eq!(result, Err(Ok(Error::PredicateNotSatisfied)));
}

#[test]
fn every_boolean_predicate_has_to_hold_on_its_own() {
    for drop in 0..3 {
        let f = deploy();
        let mut signals = satisfying_signals(&f.env);
        match drop {
            0 => signals.personhood = false,
            1 => signals.formality = false,
            _ => signals.standing = false,
        }
        f.client.register_issuer_root(&signals.issuer_root);
        let raw = raw_signals(&f.env, &signals);

        let result = f.client.try_anchor(
            &dummy_proof(&f.env),
            &signals,
            &raw,
            &bytes32(&f.env, 9),
            &1,
        );

        assert_eq!(result, Err(Ok(Error::PredicateNotSatisfied)));
    }
}

/// The bug the named struct exists to prevent: the policy reads one set of
/// values and the pairing another. A flat vector that disagrees with the
/// struct is refused, whatever it would have proved.
#[test]
fn the_named_signals_and_the_flat_vector_have_to_agree() {
    let f = deploy();
    let signals = satisfying_signals(&f.env);
    f.client.register_issuer_root(&signals.issuer_root);

    let mut lying = raw_signals(&f.env, &signals);
    lying.set(5, fr_bytes(&bytes32(&f.env, 7)));

    let result = f.client.try_anchor(
        &dummy_proof(&f.env),
        &signals,
        &lying,
        &bytes32(&f.env, 9),
        &1,
    );

    assert_eq!(result, Err(Ok(Error::InvalidProof)));
}

#[test]
fn a_vector_of_the_wrong_length_is_not_a_statement_about_this_circuit() {
    let f = deploy();
    let signals = satisfying_signals(&f.env);
    f.client.register_issuer_root(&signals.issuer_root);

    let mut short = raw_signals(&f.env, &signals);
    short.pop_back();

    let result = f.client.try_anchor(
        &dummy_proof(&f.env),
        &signals,
        &short,
        &bytes32(&f.env, 9),
        &1,
    );

    assert_eq!(result, Err(Ok(Error::InvalidProof)));
}

#[test]
fn a_registered_root_stays_registered_and_carries_the_ledger_it_arrived_at() {
    let f = deploy();
    let at = f.env.ledger().sequence() + 10;
    f.env.ledger().set_sequence_number(at);
    let root = bytes32(&f.env, 1);

    f.client.register_issuer_root(&root);

    let recorded: u32 = f.env.as_contract(&f.id, || {
        f.env
            .storage()
            .persistent()
            .get(&DataKey::IssuerRoot(root.clone()))
            .unwrap()
    });
    assert_eq!(recorded, at);
}

#[test]
fn nothing_is_anchored_or_spent_before_a_verification() {
    let f = deploy();
    assert_eq!(f.client.anchored(&bytes32(&f.env, 2)), None);
    assert!(!f.client.spent(&bytes32(&f.env, 3)));
}

#[test]
fn the_verifying_key_is_pinned_at_deployment_and_is_never_an_argument() {
    let f = deploy();
    f.env.as_contract(&f.id, || {
        assert!(f.env.storage().instance().has(&DataKey::Vk));
        assert!(f.env.storage().instance().has(&DataKey::Admin));
    });
}
