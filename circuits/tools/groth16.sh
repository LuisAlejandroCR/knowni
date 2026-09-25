#!/usr/bin/env bash
# groth16.sh: the whole Groth16 pipeline over BLS12-381, from source to a
# verified proof. Writes the development verifying key, the proof and the
# public signals into circuits/groth16/, which the tests and the contract read.
#
#   bash circuits/tools/groth16.sh <path-to-circomlib/circuits>
#
# The circuit is compiled from a staging copy. circom resolves an include in
# the including file's own directory before any -l path, so compiling in place
# with `-l <bls dir>` silently keeps the BN254 Poseidon and domain constants.

set -euo pipefail

CIRCOMLIB="${1:?usage: groth16.sh <circomlib/circuits>}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
WORK="${WORK:-$(mktemp -d)}"
OUT="$HERE/groth16"
snarkjs() { node "$ROOT/node_modules/snarkjs/build/cli.cjs" "$@"; }

mkdir -p "$WORK/src" "$OUT"
cp "$HERE"/*.circom "$WORK/src/"
cp "$HERE/poseidon_knowni_bls12381.circom" "$WORK/src/poseidon_knowni.circom"
cp "$HERE/domains_bls12381.circom" "$WORK/src/domains.circom"

circom "$WORK/src/eligibility.circom" -l "$CIRCOMLIB" -p bls12381 --r1cs --wasm --sym --output "$WORK"

node --experimental-strip-types "$HERE/tools/write-eligibility-input.ts" bls12381 > "$WORK/input.json"

# Development setup, one contributor per phase. Whoever holds these
# contributions can forge proofs for this circuit: never a production key.
snarkjs powersoftau new bls12-381 14 "$WORK/pot_0.ptau"
snarkjs powersoftau contribute "$WORK/pot_0.ptau" "$WORK/pot_1.ptau" --name=dev -e="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
snarkjs powersoftau prepare phase2 "$WORK/pot_1.ptau" "$WORK/pot_final.ptau"
snarkjs groth16 setup "$WORK/eligibility.r1cs" "$WORK/pot_final.ptau" "$WORK/eligibility_0.zkey"
snarkjs zkey contribute "$WORK/eligibility_0.zkey" "$WORK/eligibility.zkey" --name=dev -e="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
snarkjs zkey export verificationkey "$WORK/eligibility.zkey" "$OUT/verification_key.json"

start=$(date +%s%3N)
snarkjs groth16 fullprove "$WORK/input.json" "$WORK/eligibility_js/eligibility.wasm" "$WORK/eligibility.zkey" \
  "$OUT/proof.json" "$OUT/public.json"
echo "proved in $(( $(date +%s%3N) - start )) ms"

snarkjs groth16 verify "$OUT/verification_key.json" "$OUT/public.json" "$OUT/proof.json"
echo "work dir: $WORK"
