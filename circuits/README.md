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
| Compiled R1CS | **Built.** 12 379 non-linear and 254 linear constraints, 8 public inputs, 5 public outputs, 12 693 wires — the same on both curves. The last move was carrying the Poseidon state as an expression instead of a signal per cell per round: 25 221 → 12 633 constraints, −50%, and the permutation is unchanged (D-74). Not committed: it is generated. |
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
- **`-p bls12381` compiling was never the same as `-p bls12381` being
  correct**, because circomlib's Poseidon round constants are derived for
  BN254 and compiling them against another field reinterprets them without
  complaint. That is why this repository derives its own —
  `tools/write-poseidon.ts` — and ships `poseidon_knowni.circom` and
  `poseidon_knowni_bls12381.circom`. They are drop-in for each other: same
  template names, different constants, so swapping curve is a directory on
  `-l`. CI compiles the circuit both ways.

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
| Grain LFSR and the round constants | **Reproduces circomlib's BN254 values exactly.** |
| The MDS matrix | **Reproduces circomlib's published matrix**, which is the reference script's matrix transposed — circomlib's `Mix` indexes `M[j][i]`, so it stores it turned around. |
| The Poseidon permutation, outside a circuit | **`tools/poseidon.ts`, and it computes what the gadget computes** for the same inputs. |
| The same over BLS12-381 | **Generated and deterministic.** Nothing has been proved about it: no second implementation exists to check it against, and no security review has been done. |
| `core/`'s `FieldHash` | Still SHA-256. Swapping it changes every commitment, so it is its own change. |
| The circuit and `core/` agreeing | **A CI step, not a copied value.** It builds a witness of `PoseidonKnowni2` on both curves and compares the output with `poseidon([1,2])` from `core/`. |

Three rules decide whether any of this is right, and none can be read off the
output:

1. The LFSR emits a bit only when the preceding bit was a `1`, consuming the
   pair either way.
2. Round constants use **rejection** sampling: a draw at or above the prime is
   thrown away.
3. The matrix's `x` and `y` use **reduction**, not rejection — the reference
   builds them with `F(bits)`. Rejecting there shifts every bit that follows
   and produces a matrix that is wrong in a way nothing complains about.

The ground truth for whatever comes next, produced by the gadget itself
(`circom --wasm` and a witness for inputs `1, 2` on BN254):

```
Poseidon(1, 2) = 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a
```

An implementation that does not reproduce that number is wrong, whatever else
it reproduces. `test/unit/poseidon.spec.ts` is that check.

## Domain separation, and what it cost

`core/` puts a domain string in front of every construction so a leaf can never
be read as a node. The circuit did not, and it also skipped the leaf hash
entirely — it folded starting from the bare commitment. Both are fixed here:
`MerkleLeaf` and `MerkleLevel` take a domain element as their first input, and
`MerklePath` takes the commitment and hashes it itself, so a caller cannot
forget to.

The constants are generated, not typed: `tools/domains.ts` derives one field
element per domain string and `domains.circom` is its output. CI regenerates it
and refuses a file that drifted.

| | Non-linear constraints |
|---|---|
| Before | 10 932 |
| After | 12 258 |

**+12.1%**, of which +840 is the node domain over 40 levels and +486 is the two
leaf hashes that were missing. An estimate made before implementing said +7.7%:
it counted the domains and not the absent leaf hash.

`core/` hashes with Poseidon too, and `claims.circom` computes a claim
commitment element for element the way `core/src/claim-fields.ts` orders them.
A commitment made in `core/` and one made in the circuit are **the same
number** — pinned in `test/unit/claim-commitment.spec.ts` against witnesses of
the compiled gadgets.

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
