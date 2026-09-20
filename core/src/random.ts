// random.ts: the one source of randomness, injectable and platform-neutral.
// Web Crypto covers Node and React Native (with expo-crypto installed); a
// deployment with neither must say so rather than silently weaken a salt.

export type RandomSource = (byteLength: number) => Uint8Array;

let source: RandomSource | undefined;

export function setRandomSource(next: RandomSource): void {
  source = next;
}

export function randomBytes(byteLength: number): Uint8Array {
  if (source !== undefined) return source(byteLength);
  const webCrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (webCrypto?.getRandomValues === undefined) {
    throw new Error("no random source: call setRandomSource() before issuing or committing");
  }
  return webCrypto.getRandomValues(new Uint8Array(byteLength));
}
