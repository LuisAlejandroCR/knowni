// reduction.rs: the snarkjs witness map, over the roots of unity snarkjs uses.
// snarkjs builds BLS12-381's roots from the generator 5 and arkworks from 7, so
// the same-size domain lists different points and h(x) lands on the wrong ones.

use ark_ff::{BigInteger, PrimeField};
use ark_groth16::r1cs_to_qap::{evaluate_constraint, LibsnarkReduction, R1CSToQAP};
use ark_poly::{EvaluationDomain, Radix2EvaluationDomain};
use ark_relations::r1cs::{ConstraintMatrices, ConstraintSystemRef, SynthesisError};

/// The generator ffjavascript derives its roots from (its `nqr`). For BN254 it
/// equals arkworks' generator, which is why the mismatch never shows there.
const SNARKJS_NQR: u64 = 5;

/// The 2^k-th root of unity snarkjs uses: `w[k]` in ffjavascript.
pub fn snarkjs_root<F: PrimeField>(k: u32) -> Option<F> {
    let s = F::TWO_ADICITY;
    if k > s {
        return None;
    }
    // (r - 1) / 2^s, the odd part of the group order.
    let mut t = F::MODULUS;
    t.sub_with_borrow(&F::BigInt::from(1u64));
    t >>= s;
    let mut root = F::from(SNARKJS_NQR).pow(t);
    for _ in k..s {
        root.square_in_place();
    }
    Some(root)
}

fn domain<F: PrimeField>(size: usize) -> Result<Radix2EvaluationDomain<F>, SynthesisError> {
    let mut domain = Radix2EvaluationDomain::<F>::new(size).ok_or(SynthesisError::PolynomialDegreeTooLarge)?;
    let generator = snarkjs_root::<F>(domain.log_size_of_group).ok_or(SynthesisError::PolynomialDegreeTooLarge)?;
    domain.group_gen = generator;
    domain.group_gen_inv = generator.inverse().ok_or(SynthesisError::UnexpectedIdentity)?;
    Ok(domain)
}

/// snarkjs's zkey holds the H bases in the Lagrange form of a domain twice as
/// large, so the witness map is (AB - C) evaluated at that domain's odd points.
/// Same algorithm as circom-compat's CircomReduction; only the domain differs.
pub struct SnarkjsReduction;

impl R1CSToQAP for SnarkjsReduction {
    #[allow(clippy::type_complexity)]
    fn instance_map_with_evaluation<F: PrimeField, D: EvaluationDomain<F>>(
        cs: ConstraintSystemRef<F>,
        t: &F,
    ) -> Result<(Vec<F>, Vec<F>, Vec<F>, F, usize, usize), SynthesisError> {
        LibsnarkReduction::instance_map_with_evaluation::<F, D>(cs, t)
    }

    fn witness_map_from_matrices<F: PrimeField, D: EvaluationDomain<F>>(
        matrices: &ConstraintMatrices<F>,
        num_inputs: usize,
        num_constraints: usize,
        full_assignment: &[F],
    ) -> Result<Vec<F>, SynthesisError> {
        let domain = domain::<F>(num_constraints + num_inputs)?;
        let size = domain.size();

        let mut a = vec![F::zero(); size];
        let mut b = vec![F::zero(); size];
        for (i, (at, bt)) in matrices.a.iter().zip(&matrices.b).enumerate().take(num_constraints) {
            a[i] = evaluate_constraint(at, full_assignment);
            b[i] = evaluate_constraint(bt, full_assignment);
        }
        a[num_constraints..num_constraints + num_inputs].clone_from_slice(&full_assignment[..num_inputs]);
        let mut c: Vec<F> = a.iter().zip(&b).take(num_constraints).map(|(a, b)| *a * b).collect();
        c.resize(size, F::zero());

        let shift = snarkjs_root::<F>(domain.log_size_of_group + 1).ok_or(SynthesisError::PolynomialDegreeTooLarge)?;
        let to_odd_points = |values: &mut Vec<F>| {
            domain.ifft_in_place(values);
            Radix2EvaluationDomain::<F>::distribute_powers_and_mul_by_const(values, shift, F::one());
            domain.fft_in_place(values);
        };
        to_odd_points(&mut a);
        to_odd_points(&mut b);
        to_odd_points(&mut c);

        Ok(a.iter().zip(&b).zip(&c).map(|((a, b), c)| *a * b - c).collect())
    }

    fn h_query_scalars<F: PrimeField, D: EvaluationDomain<F>>(
        _: usize,
        _: F,
        _: F,
        _: F,
    ) -> Result<Vec<F>, SynthesisError> {
        // The H bases come from the zkey; this crate never runs a setup.
        Err(SynthesisError::AssignmentMissing)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ark_bls12_381::Fr;
    use std::str::FromStr;

    // Printed by ffjavascript 0.3 (`buildBls12381().Fr.w[32]`), the library
    // snarkjs 0.7.5 proves with.
    const SNARKJS_W32: &str = "937917089079007706106976984802249742464848817460758522850752807661925904159";

    #[test]
    fn the_largest_root_is_the_one_snarkjs_uses() {
        assert_eq!(snarkjs_root::<Fr>(32), Some(Fr::from_str(SNARKJS_W32).unwrap()));
    }

    #[test]
    fn and_it_is_not_the_one_arkworks_picks() {
        use ark_ff::FftField;
        assert_ne!(snarkjs_root::<Fr>(32), Some(Fr::TWO_ADIC_ROOT_OF_UNITY));
    }
}
