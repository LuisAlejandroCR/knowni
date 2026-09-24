// poseidon.ts: the Poseidon permutation, outside a circuit.
// It exists so `core/` can hash the way the circuit hashes — the swap the
// `FieldHash` port was written for. Its only claim to correctness is the test:
// it reproduces the value circomlib's own gadget computes for the same inputs.

import { parameters, type GrainSpec } from "./poseidon-params.ts";

function power5(value: bigint, prime: bigint): bigint {
  const squared = (value * value) % prime;
  return (((squared * squared) % prime) * value) % prime;
}

/// Hashes `inputs` with a state one wider than them, which is the arrangement
/// circomlib's `Poseidon(n)` uses: the extra cell starts at zero and the first
/// cell of the final state is the output.
export function poseidon(inputs: readonly bigint[], spec: GrainSpec): bigint {
  if (inputs.length + 1 !== spec.width) {
    throw new RangeError("the state is one wider than the inputs, no more and no less");
  }
  const { prime, width, fullRounds, partialRounds } = spec;
  const { constants, mds } = parameters(spec);

  let state = [0n, ...inputs.map((value) => value % prime)];
  const mix = (current: readonly bigint[]): bigint[] =>
    mds.map((row) => row.reduce((sum, factor, j) => (sum + factor * current[j]!) % prime, 0n));

  for (let round = 0; round < fullRounds + partialRounds; round += 1) {
    state = state.map((value, i) => (value + constants[round * width + i]!) % prime);
    // A partial round raises only the first cell. That is the whole reason
    // Poseidon is affordable in a circuit, and it is one character away from
    // being a different hash.
    const isFull = round < fullRounds / 2 || round >= fullRounds / 2 + partialRounds;
    state = isFull
      ? state.map((value) => power5(value, prime))
      : [power5(state[0]!, prime), ...state.slice(1)];
    state = mix(state);
  }

  return state[0]!;
}
