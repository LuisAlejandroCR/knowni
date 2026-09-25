#!/usr/bin/env sh
# testnet.sh: deploys the verifier to Stellar testnet with the committed
# development key, registers the fixture's issuer root, and anchors the
# committed proof — the pairing run by the network, not by a test host.
#
#   docker run --rm -v "$PWD:/w" -v knowni-stellar:/config \
#     --entrypoint sh stellar/stellar-cli:latest /w/contracts/knowni-verifier/tools/testnet.sh
#
# Expects /w/.stellar-out/ from circuits/tools/write-soroban-args.ts and the
# release wasm built for wasm32v1-none — see the contract's README. The identity is a testnet key funded by friendbot; it lives in
# the docker volume, never in the repository.

set -eu

OUT=/w/.stellar-out
NET="--network testnet"
ID=knowni-dev

stellar keys address "$ID" >/dev/null 2>&1 || stellar keys generate "$ID" $NET --fund
ADMIN="$(stellar keys address "$ID")"
echo "admin: $ADMIN"

# CONTRACT=<id> reuses a deployment instead of making a new one.
if [ -z "${CONTRACT:-}" ]; then
  CONTRACT="$(stellar contract deploy $NET --source "$ID" --wasm "$OUT/knowni_verifier.wasm" \
    -- --admin "$ADMIN" --vk-file-path "$OUT/vk.json")"
  ROOT="$(sed 's/.*"issuer_root":"\([0-9a-f]*\)".*/\1/' "$OUT/signals.json")"
  stellar contract invoke $NET --source "$ID" --id "$CONTRACT" -- register_issuer_root --root "$ROOT"
fi
echo "contract: $CONTRACT"

# The commitment is what the anchor stores for the session; any 32 bytes do for
# the fixture, since the proof binds the session and not this value.
stellar contract invoke $NET --source "$ID" --id "$CONTRACT" -- anchor \
  --proof-file-path "$OUT/proof.json" \
  --signals-file-path "$OUT/signals.json" \
  --raw_signals-file-path "$OUT/raw_signals.json" \
  --commitment 0707070707070707070707070707070707070707070707070707070707070707 \
  --min_tier 3

NULLIFIER="$(sed 's/.*"nullifier":"\([0-9a-f]*\)".*/\1/' "$OUT/signals.json")"
echo "spent: $(stellar contract invoke $NET --source "$ID" --id "$CONTRACT" --send=no -- spent --nullifier "$NULLIFIER")"
