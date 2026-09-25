// prove.rs: the native prover proves the fixture input, arkworks accepts it,
// and the statement is the one the circuit tests pin. Needs KNOWNI_ZKEY and
// KNOWNI_INPUT; prover/tools/check.sh sets both.

use knowni_prover::Prover;

fn setup() -> (Prover, String) {
    let zkey = std::env::var("KNOWNI_ZKEY").expect("KNOWNI_ZKEY: run through prover/tools/check.sh");
    let input = std::env::var("KNOWNI_INPUT").expect("KNOWNI_INPUT: run through prover/tools/check.sh");
    (Prover::load(&zkey).unwrap(), std::fs::read_to_string(input).unwrap())
}

#[test]
fn a_native_proof_of_the_fixture_verifies() {
    let (prover, input) = setup();
    let proved = prover.prove(&input).unwrap();
    assert!(prover.verify(&proved).unwrap());

    // personhood, solvencyTier, formality, sanctions — the order in
    // circuits/eligibility.signals.txt.
    let (_, public) = knowni_prover::to_snarkjs(&proved);
    let public: Vec<&str> = public.as_array().unwrap().iter().map(|v| v.as_str().unwrap()).collect();
    assert_eq!(public.len(), 13);
    assert_eq!(public[..4], ["1", "3", "1", "1"]);
}

#[test]
fn a_proof_does_not_verify_for_another_statement() {
    let (prover, input) = setup();
    let mut proved = prover.prove(&input).unwrap();
    proved.public[1] += ark_bls12_381::Fr::from(1u64);
    assert!(!prover.verify(&proved).unwrap());
}

#[test]
fn a_number_where_a_decimal_string_belongs_is_refused() {
    let (prover, _) = setup();
    assert!(prover.prove(r#"{"issuerRoot": 1}"#).is_err());
}

#[test]
fn the_json_entry_point_answers_proof_and_public_signals() {
    let zkey = std::env::var("KNOWNI_ZKEY").unwrap();
    let input = std::fs::read_to_string(std::env::var("KNOWNI_INPUT").unwrap()).unwrap();
    let answer: serde_json::Value =
        serde_json::from_str(&knowni_prover::prove_json(&input, &zkey, &sha256_hex(&zkey))).unwrap();
    assert_eq!(answer["proof"]["curve"], "bls12381");
    assert_eq!(answer["publicSignals"].as_array().unwrap().len(), 13);
}

fn sha256_hex(path: &str) -> String {
    let out = std::process::Command::new("sha256sum").arg(path).output().unwrap();
    String::from_utf8(out.stdout).unwrap().split_whitespace().next().unwrap().to_string()
}

#[test]
fn a_key_that_is_not_the_pinned_one_is_refused_before_it_is_read() {
    let zkey = std::env::var("KNOWNI_ZKEY").unwrap();
    let input = std::fs::read_to_string(std::env::var("KNOWNI_INPUT").unwrap()).unwrap();
    let wrong = "0".repeat(64);
    let answer: serde_json::Value = serde_json::from_str(&knowni_prover::prove_json(&input, &zkey, &wrong)).unwrap();
    assert_eq!(answer["code"], "zkey_mismatch");
    assert!(answer.get("proof").is_none());
}
