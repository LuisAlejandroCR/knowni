<!-- contracts/knowni-verifier/README.md
     Qué hace el contrato Soroban, sus tres reglas de política y la lista previa a
     cualquier despliegue. Se distingue de circuits/README.md, que cubre el lado
     de la prueba y no el de la verificación on-chain. -->

# `knowni-verifier`

The on-chain half: verify a Groth16 proof over BLS12-381, apply the policy,
record that the nullifier is spent.

## Status

**Compiles, and its policy is tested. Not deployed.** `cargo test` runs nine
tests over the three rules below, and the `wasm32-unknown-unknown` release
artifact is built in CI. No fee, proof-verification time or deployment address
is claimed anywhere in this repository, and no real Groth16 proof has been
verified against this contract: every test is refused *before* the pairing,
which is the order the contract promises.

`Cargo.lock` is committed. `soroban-env-host` asks for `ed25519-dalek
>= 2.0.0` with no upper bound, and 3.0.0 does not compile against it — an
unpinned build of this contract fails on a clean machine.

What it is written against:
[`stellar/soroban-examples/groth16_verifier`](https://github.com/stellar/soroban-examples/tree/main/groth16_verifier),
the canonical implementation, plus the three policy rules that example
deliberately leaves to the application.

## The three rules, and why each one is in the contract

**The verifying key is pinned at deployment.** A `verify(vk, proof, signals)`
entry point is cryptographically sound and practically useless: whoever
supplies the key can also supply a proof that matches it. Pinning is what
makes a proof a statement about *this* circuit.

**The public signals are checked for what they say.** A valid proof shows
only that *some* witness satisfies the circuit. Which issuer root? Which
session? Which subject? Unchecked, a proof about a different root — one the
prover published themselves — verifies perfectly.

**The nullifier is marked spent before any effect.** Proofs are files;
without a spent set, one proof rents fifty apartments.

## Before deploying anything

- [ ] The signal order in `signals_match` matches
      `circuits/eligibility.circom` — asserted against a circuit-generated
      fixture, not by reading. `src/test.rs` pins the order the contract
      believes in; only the circuit can say it is the right one.
- [ ] Resource fees measured by simulation (`--send=no`) at realistic sizes.
      Pairing checks are the expensive operation; budget before committing
      to per-transaction verification.
- [ ] The verifying key comes from a **multi-party** phase-2 ceremony.
      Groth16's per-circuit setup is toxic waste.
- [ ] `register_issuer_root` is behind an admin the deployment actually
      controls, and the key-rotation story is written down.
