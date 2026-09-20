<!-- contracts/knowni-verifier/README.md
     Qué hace el contrato Soroban, sus tres reglas de política y la lista previa a
     cualquier despliegue. Se distingue de circuits/README.md, que cubre el lado
     de la prueba y no el de la verificación on-chain. -->

# `knowni-verifier`

The on-chain half: verify a Groth16 proof over BLS12-381, apply the policy,
record that the nullifier is spent.

## Status

Source only. **Not compiled and not deployed from this repository** —
`soroban-sdk` is not vendored in the environment it was written in, and the
`wasm32` target is not installed. No fee, proof-verification time or
deployment address is claimed anywhere in this repository.

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
      fixture, not by reading.
- [ ] Resource fees measured by simulation (`--send=no`) at realistic sizes.
      Pairing checks are the expensive operation; budget before committing
      to per-transaction verification.
- [ ] The verifying key comes from a **multi-party** phase-2 ceremony.
      Groth16's per-circuit setup is toxic waste.
- [ ] `register_issuer_root` is behind an admin the deployment actually
      controls, and the key-rotation story is written down.
