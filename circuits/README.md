<!-- circuits/README.md
     Estado real de los circuitos, el hueco de toolchain que decide el cronograma
     y cómo se construyen. Se distingue de docs/ROADMAP.md, que ordena todo el
     trabajo pendiente y no solo el de circuitos. -->

# `circuits/`

The predicate as a Circom circuit, and an honest account of what has been run.

## Status — read this first

| Artifact | State |
|---|---|
| `eligibility.circom`, `merkle.circom` | **Written, and compiled** — 2026-09-23, circom 2.2.3. |
| Compiled R1CS | **Built.** 10 932 non-linear and 12 212 linear constraints, 8 public inputs, 5 public outputs, 23 194 wires. Not committed: it is generated. |
| Public signal order | **`eligibility.signals.txt`, written by the compiler's symbol table** and asserted by the contract's tests. CI regenerates it and refuses a fixture that drifted. |
| WASM prover, trusted setup, proving key | **Not run.** |
| On-chain verification against Soroban | **Not run.** No real proof has ever been produced or verified. |
| The same predicates, evaluated and tested | **Done** — in `core/`. |

Compiling found one thing, and it is the kind this file warned about: the
contract read `listSetRoot` from index 11 of the public signal vector. Index
11 is `minMonthsPaid`. See `docs/memoria.md` D-51.

Nothing here claims a measured proof time or a verified on-chain proof. The
constraint counts above are from the command in "Building", run on this
repository.

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
  attestation primitive from our own prior ZK project
  ports here and a BabyJubjub gadget does not. See
  `docs/ARCHITECTURE.md`, "Two ways to trust an issuer".
- **Do not compile with the default `bn128`.** A BN254 proof cannot be
  verified on Stellar until CAP-0074 lands. Mismatching the curve is the
  failure that looks like everything working until the contract call.
- **`-p bls12381` compiling is not `-p bls12381` being correct.** Measured
  2026-09-23: the circuit compiles on both curves, to byte-identical
  constraint counts and the same signal order. That is the danger, not the
  good news. circomlib's Poseidon round constants are field elements derived
  for BN254; compiled against another field they are still *some* constants,
  so the compiler has nothing to complain about and the result is a
  permutation nobody analysed. The gap is silent, which is why it is written
  down here twice.

This is why the architecture keeps the proof system behind a port and ships
an attested path first. See `docs/ROADMAP.md`.

## Building, once the toolchain is in place

What was actually run, and what it produced:

```bash
git clone --depth 1 https://github.com/iden3/circomlib.git
circom eligibility.circom -l circomlib/circuits -l . --r1cs --sym --output build

# The public signal order, straight from the symbol table. This is what
# `circuits/eligibility.signals.txt` holds and what CI diffs against.
head -13 build/eligibility.sym | cut -d, -f4 | sed 's/^main\.//'
```

The rest still needs the Poseidon parameters for BLS12-381, which circomlib
does not ship:

```bash
circom eligibility.circom --r1cs --wasm -p bls12381 -l circomlib/circuits

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

## Poseidon over BLS12-381 — what is done and what is not

The blocker is not the toolchain. It is that circomlib's Poseidon round
constants are derived for BN254's field, and `-p bls12381` recompiles them
into another field without complaining.

`tools/poseidon-params.ts` is a port of the reference
`generate_parameters_grain.sage` — the script circomlib's own header names as
the source of its constants. It is not trusted because it looks right:
`test/unit/poseidon-params.spec.ts` regenerates circomlib's published BN254
constants with it, for state widths 2 and 3, and compares them. They match.

| Piece | State |
|---|---|
| Grain LFSR and the round constants | **Reproduces circomlib's BN254 values exactly.** Same generator answers for BLS12-381. |
| The MDS matrix | **Not reproduced.** A plain Cauchy matrix over the same generated `x`/`y` matches circomlib's published matrix in its first row and one other, and disagrees elsewhere. Until that is understood, no matrix here is trustworthy. |
| A Poseidon permutation, in or out of circuit | **Not written.** Without the matrix there is nothing to write it against. |
| `core/`'s `FieldHash` | Still SHA-256, which is what the port exists to let us change. |

The ground truth for whatever comes next, produced by the gadget itself
(`circom --wasm` and a witness for inputs `1, 2` on BN254):

```
Poseidon(1, 2) = 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a
```

An implementation that does not reproduce that number is wrong, whatever else
it reproduces.

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
