#!/usr/bin/env bash
# check.sh: builds and tests the native prover, proves the fixture input, and
# has snarkjs verify that proof independently against the zkey's own key.
#
#   bash prover/tools/check.sh <groth16 work dir>
#
# The work dir is what circuits/tools/groth16.sh leaves behind: the zkey, the
# witness input and eligibility_js/. Needs cargo, cmake, clang and node.

set -euo pipefail

WORK="${1:?usage: check.sh <groth16 work dir>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
snarkjs() { node "$ROOT/node_modules/snarkjs/build/cli.cjs" "$@"; }

export KNOWNI_WITNESS_WASM_DIR="$WORK/eligibility_js"
export KNOWNI_ZKEY="$WORK/eligibility.zkey"
export KNOWNI_INPUT="$WORK/input.json"

cd "$ROOT/prover"
cargo test --release --locked
cargo run --release --locked --bin knowni-prove -- "$KNOWNI_INPUT" "$KNOWNI_ZKEY" "$WORK/native"

snarkjs zkey export verificationkey "$KNOWNI_ZKEY" "$WORK/native/verification_key.json"
snarkjs groth16 verify "$WORK/native/verification_key.json" "$WORK/native/public.json" "$WORK/native/proof.json"
