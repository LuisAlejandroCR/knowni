#!/usr/bin/env bash
# build-ios.sh: builds the prover as a static library for iPhone and for the
# Apple-silicon simulator and packs both into KnowniProver.xcframework, which
# the Expo module's podspec vendors. Runs on macOS only.
#
#   KNOWNI_WITNESS_WASM_DIR=<groth16 work dir>/eligibility_js bash prover/tools/build-ios.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
: "${KNOWNI_WITNESS_WASM_DIR:?set KNOWNI_WITNESS_WASM_DIR (circuits/tools/groth16.sh writes it)}"
OUT="$ROOT/app/modules/knowni-prover/ios/KnowniProver.xcframework"
TARGET_DIR="${CARGO_TARGET_DIR:-$ROOT/prover/target}"

rustup target add aarch64-apple-ios aarch64-apple-ios-sim

cd "$ROOT/prover"
for target in aarch64-apple-ios aarch64-apple-ios-sim; do
  cargo build --release --locked --lib --target "$target"
done

rm -rf "$OUT"
xcodebuild -create-xcframework \
  -library "$TARGET_DIR/aarch64-apple-ios/release/libknowni_prover.a" -headers "$ROOT/prover/include" \
  -library "$TARGET_DIR/aarch64-apple-ios-sim/release/libknowni_prover.a" -headers "$ROOT/prover/include" \
  -output "$OUT"
