#!/usr/bin/env bash
# build-android.sh: cross-compiles the prover to Android's arm64 and x86_64 ABIs
# and drops each libknowni_prover.so where the Expo module's Gradle build looks
# for it. Needs ANDROID_NDK_HOME, cmake and clang (for the witness transpiler).
#
#   KNOWNI_WITNESS_WASM_DIR=<groth16 work dir>/eligibility_js bash prover/tools/build-android.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
: "${ANDROID_NDK_HOME:?set ANDROID_NDK_HOME to the NDK}"
: "${KNOWNI_WITNESS_WASM_DIR:?set KNOWNI_WITNESS_WASM_DIR (circuits/tools/groth16.sh writes it)}"

command -v cargo-ndk >/dev/null || cargo install --locked cargo-ndk@3.5.4
rustup target add aarch64-linux-android x86_64-linux-android

cd "$ROOT/prover"
cargo ndk --platform 24 -t arm64-v8a -t x86_64 \
  -o "$ROOT/app/modules/knowni-prover/android/src/main/jniLibs" \
  build --release --locked --lib
ls -la "$ROOT"/app/modules/knowni-prover/android/src/main/jniLibs/*/libknowni_prover.so
