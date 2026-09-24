// poseidon-params.ts: the Grain LFSR that generates Poseidon's round constants.
// A port of the reference `generate_parameters_grain.sage` that circomlib's own
// constants were produced with. It exists so the constants for BLS12-381 can be
// generated here instead of trusted from somewhere, and it is only worth
// anything because the test reproduces circomlib's BN254 constants with it.
//
// Three rules here cannot be guessed and are why the test exists: the LFSR's
// gate bit, rejection sampling for the round constants, and NO rejection for
// the matrix — which is reduced instead. Getting the last one wrong shifts
// every bit that follows.

export const BN254_PRIME = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
export const BLS12_381_PRIME = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n;

export interface GrainSpec {
  /// The prime the constants must be reduced into.
  readonly prime: bigint;
  /// Its width in bits, as the reference script takes it.
  readonly bits: number;
  /// State width: one more than the number of inputs.
  readonly width: number;
  readonly fullRounds: number;
  readonly partialRounds: number;
}

function initialState(spec: GrainSpec): number[] {
  const bits: number[] = [];
  const push = (value: number, width: number) => {
    for (let i = width - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };
  push(1, 2); // field: GF(p)
  push(0, 4); // s-box: x^5
  push(spec.bits, 12);
  push(spec.width, 12);
  push(spec.fullRounds, 10);
  push(spec.partialRounds, 10);
  for (let i = 0; i < 30; i += 1) bits.push(1);
  return bits;
}

/// The bit rule is the part that cannot be guessed: a bit is produced only when
/// the preceding one was a 1, and the pair is consumed either way. Reading
/// every bit instead gives a sequence that looks just as random and is wrong.
function bitStream(spec: GrainSpec): () => number {
  const state = initialState(spec);
  const step = (): number => {
    const next = state[62]! ^ state[51]! ^ state[38]! ^ state[23]! ^ state[13]! ^ state[0]!;
    state.shift();
    state.push(next);
    return next;
  };
  for (let i = 0; i < 160; i += 1) step();
  return () => {
    for (;;) {
      const gate = step();
      const value = step();
      if (gate === 1) return value;
    }
  };
}

/// Candidates at or above the prime are discarded, not reduced: reducing would
/// bias the constants towards the bottom of the field.
function fieldElements(next: () => number, spec: GrainSpec, count: number): bigint[] {
  const out: bigint[] = [];
  while (out.length < count) {
    let value = 0n;
    for (let i = 0; i < spec.bits; i += 1) value = (value << 1n) | BigInt(next());
    if (value < spec.prime) out.push(value);
  }
  return out;
}

function rawElement(next: () => number, spec: GrainSpec): bigint {
  let value = 0n;
  for (let i = 0; i < spec.bits; i += 1) value = (value << 1n) | BigInt(next());
  return value;
}

/// The round constants, in the order the unoptimised permutation consumes them:
/// `width` per round, `fullRounds + partialRounds` rounds.
export function roundConstants(spec: GrainSpec): bigint[] {
  return fieldElements(bitStream(spec), spec, spec.width * (spec.fullRounds + spec.partialRounds));
}

export interface PoseidonParameters {
  readonly constants: readonly bigint[];
  /// `mds[i][j]`, in the reference script's orientation: a state is mixed by
  /// multiplying it on the left. circomlib publishes the transpose of this,
  /// because its `Mix` template indexes `M[j][i]`.
  readonly mds: readonly (readonly bigint[])[];
}

/// The matrix is a Cauchy matrix over 2·width elements drawn after the round
/// constants. Unlike the constants, an element at or above the prime is
/// **reduced**, not discarded — the reference script builds it with `F(bits)`.
/// A whole draw is redrawn if it repeats a value or if any `x + y` is zero.
/// Keyed by everything that changes the answer. Deriving is deterministic and
/// slow — a Grain LFSR over hundreds of elements — and every hash of the same
/// width wants the same result.
const derived = new Map<string, PoseidonParameters>();

export function parameters(spec: GrainSpec): PoseidonParameters {
  const key = `${spec.prime}/${spec.bits}/${spec.width}/${spec.fullRounds}/${spec.partialRounds}`;
  const cached = derived.get(key);
  if (cached !== undefined) return cached;
  const computed = derive(spec);
  derived.set(key, computed);
  return computed;
}

function derive(spec: GrainSpec): PoseidonParameters {
  const next = bitStream(spec);
  const constants: bigint[] = [];
  while (constants.length < spec.width * (spec.fullRounds + spec.partialRounds)) {
    let value = rawElement(next, spec);
    while (value >= spec.prime) value = rawElement(next, spec);
    constants.push(value);
  }

  for (;;) {
    let drawn = draw(next, spec);
    while (new Set(drawn).size !== drawn.length) drawn = draw(next, spec);
    const xs = drawn.slice(0, spec.width);
    const ys = drawn.slice(spec.width);
    if (xs.some((x) => ys.some((y) => (x + y) % spec.prime === 0n))) continue;
    const mds = xs.map((x) => ys.map((y) => inverse((x + y) % spec.prime, spec.prime)));
    return { constants, mds };
  }
}

function draw(next: () => number, spec: GrainSpec): bigint[] {
  return Array.from({ length: 2 * spec.width }, () => rawElement(next, spec) % spec.prime);
}

/// The prime is prime, so Fermat gives the inverse and the file keeps its one
/// arithmetic idea instead of an extended Euclid nobody will reread.
function inverse(value: bigint, prime: bigint): bigint {
  let result = 1n;
  let base = value % prime;
  let exponent = prime - 2n;
  while (exponent > 0n) {
    if (exponent & 1n) result = (result * base) % prime;
    base = (base * base) % prime;
    exponent >>= 1n;
  }
  return result;
}

/// The parameters the reference script publishes for each width. `partialRounds`
/// is circomlib's table, rounded up to a multiple that divides the width.
export const CIRCOMLIB_PARTIAL_ROUNDS = [56, 57, 56, 60, 60, 63, 64, 63, 60, 66, 60, 65, 70, 60, 64, 68] as const;

export function circomlibSpec(prime: bigint, bits: number, width: number): GrainSpec {
  const partialRounds = CIRCOMLIB_PARTIAL_ROUNDS[width - 2];
  if (partialRounds === undefined) throw new RangeError("no published round count for this width");
  return { prime, bits, width, fullRounds: 8, partialRounds };
}
