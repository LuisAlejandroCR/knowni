<!-- prover/README.md
     Qué es el prover nativo, cómo se construye y qué está probado de él.
     Se distingue de circuits/README.md, que cubre el circuito y el setup, no
     cómo se genera la prueba fuera de snarkjs. -->

# `prover/`

Groth16 over BLS12-381 for `eligibility.circom`, in Rust, so the phone can
prove without WebAssembly. Hermes, the engine the app runs on, has none, so
snarkjs cannot run there.

## Status

| Piece | State |
|---|---|
| Witness | **Native.** `rust-witness` transpiles circom's own WASM witness generator to C, so it computes over whatever prime the circuit was compiled for. Identical to snarkjs's witness, all 12 693 values, checked once by hand. |
| Proof | **Native, and snarkjs accepts it.** arkworks with a reduction over snarkjs's roots of unity (`src/reduction.rs`). 5–12 s in a Docker container on a laptop; never measured on a phone. |
| iOS / Android bindings | **Written, compiled in CI, never run on a phone.** `src/ffi.rs` exposes one call —input JSON and zkey path in, JSON out— as `knowni_prove` for Swift and as JNI for Kotlin. `app/modules/knowni-prover/` is the Expo module; `tools/build-android.sh` and `tools/build-ios.sh` build the `.so` and the xcframework. |
| Proving key on the phone | **Not delivered.** The zkey is 21 MB and must match the contract's pinned key; how it reaches the device is a separate decision. |

## Two things that fail silently

1. **The roots of unity.** snarkjs derives BLS12-381's from the generator 5,
   arkworks from 7. A domain of the same size lists different points, the
   quotient `h(x)` lands on the wrong ones, and the proof is simply invalid.
   circom-prover's own BLS12-381 path has this bug. `reduction.rs` builds the
   domain from snarkjs's generator, and a test pins its largest root against
   the value ffjavascript prints.
2. **Scalar inputs.** circom-prover keeps only array-valued signals and drops
   the rest, and the transpiled witness does not notice a missing input: it
   becomes a zero. `lib.rs` turns every signal into a list and refuses anything
   that is not a decimal string.

## Running it

```bash
WORK=/tmp/groth16 bash circuits/tools/groth16.sh <circomlib/circuits>
bash prover/tools/check.sh /tmp/groth16
```

`check.sh` runs the tests, proves the fixture input, and has snarkjs verify
that proof against the zkey's key. It needs cargo, cmake, clang and node. On
Windows with Smart App Control, run it in Docker (`rust:1-bookworm`).
