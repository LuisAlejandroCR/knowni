<!-- circuits/README.md
     Estado real de los circuitos, el hueco de toolchain que decide el cronograma
     y cómo se construyen. Se distingue de docs/ROADMAP.md, que ordena todo el
     trabajo pendiente y no solo el de circuitos. -->

# `circuits/`

The predicate as a Circom circuit, and an honest account of what has been run.

## Status — read this first

| Artifact | State |
|---|---|
| `eligibility.circom`, `merkle.circom` | **Written.** Source only. |
| Compiled R1CS / WASM prover | **Not built in this repository.** `circom` is not installed in the environment these were written in. |
| Trusted setup, proving key | **Not run.** |
| On-chain verification against Soroban | **Not run.** |
| The same predicates, evaluated and tested | **Done** — in `core/`, 57 passing tests. |

Nothing in this repository claims a measured proof time, a constraint count
or a verified on-chain proof. When those exist they go in this table with the
command that produced them.

## The gap that decides the schedule

Stellar verifies **Groth16 over BLS12-381** natively today
([CAP-0059](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0059.md),
Protocol 22+). Circom can target that field with `-p bls12381`. So the path
exists — but the gadget libraries do not follow automatically:

- **`circomlib` is built for BN254.** Its Poseidon constants, and the
  BabyJubjub curve its signature gadgets use, are defined over BN254's
  scalar field. `include "poseidon.circom"` compiled with `-p bls12381`
  needs Poseidon parameters generated for *that* field.
- The embedded curve for BLS12-381 is **Jubjub**, not BabyJubjub. This is
  the same pairing Midnight uses — which is why the Schnorr-over-Jubjub
  attestation primitive in [`creva-zk`](https://github.com/LuisAlejandroCR/creva-zk)
  ports here and a BabyJubjub gadget does not. See
  `docs/ARCHITECTURE.md`, "Two ways to trust an issuer".
- **Do not compile with the default `bn128`.** A BN254 proof cannot be
  verified on Stellar until CAP-0074 lands. Mismatching the curve is the
  failure that looks like everything working until the contract call.

This is why the architecture keeps the proof system behind a port and ships
an attested path first. See `docs/ROADMAP.md`.

## Building, once the toolchain is in place

```bash
# Poseidon parameters for BLS12-381 must be generated first; circomlib's
# shipped constants are BN254's.
circom eligibility.circom --r1cs --wasm -p bls12381 -l node_modules/circomlib/circuits

snarkjs powersoftau new bls12-381 16 pot16_0000.ptau
snarkjs powersoftau contribute pot16_0000.ptau pot16_0001.ptau --name="first"
snarkjs powersoftau prepare phase2 pot16_0001.ptau pot16_final.ptau
snarkjs groth16 setup eligibility.r1cs pot16_final.ptau eligibility.zkey
snarkjs zkey export verificationkey eligibility.zkey verification_key.json
```

A single-contributor phase-2 setup is a **development** key. Groth16's
per-circuit setup is toxic waste: whoever holds the contribution can forge
proofs for that circuit. Production needs a real multi-party ceremony, and
the verifying key is pinned in the contract's constructor so changing it is
a visible deployment event.

## What the circuit must keep agreeing with

`core/src/predicates.ts` is the reference implementation and
`core/test/predicates.test.ts` is the shared spec — same comparisons, same
encodings, same YYYYMM arithmetic. When the compiled circuit exists, the
next piece of work is a differential test that runs both over the same
inputs and asserts identical outcomes. Until then, the circuit's correctness
rests on review, and this sentence is here so nobody mistakes that for
verification.

## The two Circom footguns this source is written against

**Unconstrained booleans.** A signal the prover supplies is only a bit if the
circuit says `b * (b - 1) === 0`. Without it, `documentValid = 2` makes every
`AND` downstream meaningless. Every prover-supplied boolean here is
constrained at the top of the template.

**Comparators outside their bit width.** `LessThan(n)` and friends are
*unsound*, not merely wrong, for inputs at or above 2^n — they return an
attacker-chosen answer. The widths here (64 for money, 16 for month
distance, 8 for a count) are chosen with headroom, and the ranges are
enforced off-circuit by the encoders in `core/src/hash.ts`.
