//! test_real_proof.rs: the pairing, run. A proof produced by the compiled
//! circuit over BLS12-381 goes through `anchor` against the key it was made
//! for, and every tampering with it is refused by the cryptography itself.

use super::real_proof as real;
use super::*;
use soroban_sdk::{testutils::Address as _, Env};

fn vk(env: &Env) -> VerificationKey {
    let mut ic = Vec::new(env);
    for point in real::IC.iter() {
        ic.push_back(G1Affine::from_array(env, point));
    }
    VerificationKey {
        alpha: G1Affine::from_array(env, &real::ALPHA),
        beta: G2Affine::from_array(env, &real::BETA),
        gamma: G2Affine::from_array(env, &real::GAMMA),
        delta: G2Affine::from_array(env, &real::DELTA),
        ic,
    }
}

fn proof(env: &Env) -> Proof {
    Proof {
        a: G1Affine::from_array(env, &real::A),
        b: G2Affine::from_array(env, &real::B),
        c: G1Affine::from_array(env, &real::C),
    }
}

fn raw(env: &Env) -> Vec<Fr> {
    let mut raw = Vec::new(env);
    for signal in real::SIGNALS.iter() {
        raw.push_back(Fr::from_bytes(BytesN::from_array(env, signal)));
    }
    raw
}

fn at(env: &Env, index: u32) -> BytesN<32> {
    BytesN::from_array(env, &real::SIGNALS[index as usize])
}

fn last_byte(env: &Env, index: u32) -> u8 {
    at(env, index).get(31).unwrap_or(0)
}

/// The named signals, read out of the proof's own vector rather than typed.
fn named(env: &Env) -> PublicSignals {
    PublicSignals {
        issuer_root: at(env, AT_ISSUER_ROOT),
        session_id: at(env, AT_SESSION_ID),
        nullifier: at(env, AT_NULLIFIER),
        list_set_root: at(env, AT_LIST_SET_ROOT),
        personhood: last_byte(env, AT_PERSONHOOD) == 1,
        solvency_tier: u32::from(last_byte(env, AT_SOLVENCY_TIER)),
        formality: last_byte(env, AT_FORMALITY) == 1,
        sanctions: last_byte(env, AT_SANCTIONS) == 1,
    }
}

fn deploy(env: &Env) -> KnowniVerifierClient<'_> {
    env.mock_all_auths();
    let id = env.register(KnowniVerifier, (Address::generate(env), vk(env)));
    let client = KnowniVerifierClient::new(env, &id);
    client.register_issuer_root(&at(env, AT_ISSUER_ROOT));
    client
}

#[test]
fn a_real_proof_verifies_and_spends_its_nullifier() {
    let env = Env::default();
    env.cost_estimate().budget().reset_unlimited();
    let client = deploy(&env);
    let signals = named(&env);
    let commitment = BytesN::from_array(&env, &[7; 32]);

    client.anchor(&proof(&env), &signals, &raw(&env), &commitment, &3);

    assert!(client.spent(&signals.nullifier));
    assert_eq!(client.anchored(&signals.session_id), Some(commitment));
}

#[test]
fn the_same_proof_twice_is_a_replay() {
    let env = Env::default();
    env.cost_estimate().budget().reset_unlimited();
    let client = deploy(&env);
    let commitment = BytesN::from_array(&env, &[7; 32]);
    client.anchor(&proof(&env), &named(&env), &raw(&env), &commitment, &3);

    let again = client.try_anchor(&proof(&env), &named(&env), &raw(&env), &commitment, &3);
    assert_eq!(again, Err(Ok(Error::NullifierAlreadySpent)));
}

// A signal the policy never reads — here the rent — is still bound by the
// pairing. Changing it passes every check above the pairing and fails there.
#[test]
fn a_public_input_changed_after_proving_fails_the_pairing() {
    let env = Env::default();
    env.cost_estimate().budget().reset_unlimited();
    let client = deploy(&env);
    let mut tampered = raw(&env);
    tampered.set(8, Fr::from_u256(soroban_sdk::U256::from_u32(&env, 1)));

    let result = client.try_anchor(&proof(&env), &named(&env), &tampered, &BytesN::from_array(&env, &[7; 32]), &3);
    assert_eq!(result, Err(Ok(Error::InvalidProof)));
}

#[test]
fn a_proof_with_a_swapped_point_fails_the_pairing() {
    let env = Env::default();
    env.cost_estimate().budget().reset_unlimited();
    let client = deploy(&env);
    let mut forged = proof(&env);
    forged.c = G1Affine::from_array(&env, &real::A);

    let result = client.try_anchor(&forged, &named(&env), &raw(&env), &BytesN::from_array(&env, &[7; 32]), &3);
    assert_eq!(result, Err(Ok(Error::InvalidProof)));
}
