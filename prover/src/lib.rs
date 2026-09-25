// lib.rs: proves eligibility.circom natively over BLS12-381 — the witness from
// the transpiled circuit, the proof from arkworks with snarkjs's own domain —
// and writes it in snarkjs's JSON shape, so snarkjs and the contract check it.

mod ffi;
mod reduction;

use anyhow::{bail, ensure, Context, Result};
use ark_bls12_381::{Bls12_381, Fr, G1Affine, G2Affine};
use ark_ff::{BigInteger, PrimeField, UniformRand};
use ark_groth16::{prepare_verifying_key, Groth16, Proof, ProvingKey};
use ark_relations::r1cs::ConstraintMatrices;
use circom_prover::prover::ark_circom::read_zkey;
use num_bigint::{BigInt, BigUint};
use serde_json::{json, Value};
use std::{collections::HashMap, fs::File, io::BufReader, str::FromStr};

pub use ffi::prove_json;
pub use reduction::{snarkjs_root, SnarkjsReduction};

rust_witness::witness!(eligibility);

pub struct Prover {
    key: ProvingKey<Bls12_381>,
    matrices: ConstraintMatrices<Fr>,
}

pub struct Proved {
    pub proof: Proof<Bls12_381>,
    pub public: Vec<Fr>,
}

impl Prover {
    /// Loads the zkey. It must be over BLS12-381: that is the curve Stellar
    /// verifies, and the only one this prover's domain is fixed for.
    pub fn load(zkey_path: &str) -> Result<Self> {
        let mut reader = BufReader::new(File::open(zkey_path).with_context(|| format!("opening {zkey_path}"))?);
        let (key, matrices) = read_zkey::<_, Bls12_381>(&mut reader).context("reading the zkey as BLS12-381")?;
        Ok(Self { key, matrices })
    }

    /// Proves for a witness input in circom's JSON shape (what
    /// `circuits/tools/write-eligibility-input.ts` prints).
    pub fn prove(&self, input_json: &str) -> Result<Proved> {
        let witness = eligibility_witness(inputs(input_json)?);
        let assignment = witness.iter().map(to_fr).collect::<Result<Vec<_>>>()?;
        ensure!(assignment.len() == self.key.a_query.len(),
            "the witness has {} values and the zkey expects {}", assignment.len(), self.key.a_query.len());

        let rng = &mut ark_std::rand::thread_rng();
        let proof = Groth16::<Bls12_381, SnarkjsReduction>::create_proof_with_reduction_and_matrices(
            &self.key,
            Fr::rand(rng),
            Fr::rand(rng),
            &self.matrices,
            self.matrices.num_instance_variables,
            self.matrices.num_constraints,
            &assignment,
        )?;
        let public = assignment[1..self.matrices.num_instance_variables].to_vec();
        Ok(Proved { proof, public })
    }

    /// Verifies against the key inside the zkey. A second opinion; snarkjs
    /// and the contract are the ones that decide.
    pub fn verify(&self, proved: &Proved) -> Result<bool> {
        let pvk = prepare_verifying_key(&self.key.vk);
        Ok(Groth16::<Bls12_381, SnarkjsReduction>::verify_proof(&pvk, &proved.proof, &proved.public)?)
    }
}

/// Every signal becomes a list of integers. A scalar is a list of one: the
/// transpiled witness does not check that every input arrived, and a signal
/// that never arrives is a zero and a proof nobody accepts.
fn inputs(input_json: &str) -> Result<HashMap<String, Vec<BigInt>>> {
    let Value::Object(map) = serde_json::from_str(input_json)? else {
        bail!("the witness input is not a JSON object");
    };
    map.into_iter()
        .map(|(name, value)| {
            let items = match value {
                Value::Array(items) => items,
                scalar => vec![scalar],
            };
            let values = items
                .iter()
                .map(|v| match v.as_str().map(BigInt::from_str) {
                    Some(Ok(n)) => Ok(n),
                    _ => bail!("signal {name} holds {v}, not a decimal string"),
                })
                .collect::<Result<Vec<_>>>()?;
            Ok((name, values))
        })
        .collect()
}

fn to_fr(value: &BigInt) -> Result<Fr> {
    let unsigned = value.to_biguint().context("the witness produced a negative value")?;
    ensure!(unsigned < BigUint::from(Fr::MODULUS), "the witness produced a value outside the field");
    Ok(Fr::from(unsigned))
}

fn dec<F: PrimeField>(value: F) -> String {
    BigUint::from_bytes_le(&value.into_bigint().to_bytes_le()).to_string()
}

fn g1(point: &G1Affine) -> Value {
    json!([dec(point.x), dec(point.y), "1"])
}

fn g2(point: &G2Affine) -> Value {
    json!([[dec(point.x.c0), dec(point.x.c1)], [dec(point.y.c0), dec(point.y.c1)], ["1", "0"]])
}

/// The proof and its public signals, exactly as snarkjs writes them.
pub fn to_snarkjs(proved: &Proved) -> (Value, Value) {
    let body = json!({
        "pi_a": g1(&proved.proof.a),
        "pi_b": g2(&proved.proof.b),
        "pi_c": g1(&proved.proof.c),
        "protocol": "groth16",
        "curve": "bls12381",
    });
    let public = Value::from(proved.public.iter().copied().map(dec).collect::<Vec<_>>());
    (body, public)
}
