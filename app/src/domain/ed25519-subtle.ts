// ed25519-subtle.ts: the four WebCrypto calls Cavos's control key makes, in plain JS.
// React Native has no crypto.subtle, so Cavos refused to open a wallet. This covers
// Ed25519 only — generateKey, exportKey raw, importKey pkcs8, sign — and nothing else.
// Trade-off (D-87): the seed lives in JS memory, not in a non-extractable key. Testnet only.

import { ed25519 } from "@noble/curves/ed25519";

const SEED = Symbol("ed25519-seed");

// Seeds this shim generated, held until cavos-control seals the one of the
// account Cavos registered; the kit itself cannot keep them (D-88).
const generated: Uint8Array[] = [];
const GENERATED_MAX = 4;

export function drainGeneratedSeeds(): Uint8Array[] {
  return generated.splice(0, generated.length);
}

interface ShimKey {
  readonly type: "private" | "public";
  readonly algorithm: { readonly name: "Ed25519" };
  readonly extractable: boolean;
  readonly usages: readonly string[];
  readonly [SEED]?: Uint8Array;
  readonly raw?: Uint8Array;
}

const bytes = (data: ArrayBuffer | ArrayBufferView): Uint8Array =>
  data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

const buffer = (view: Uint8Array): ArrayBuffer => view.slice().buffer;

function requireEd25519(algorithm: unknown): void {
  const name = typeof algorithm === "string" ? algorithm : (algorithm as { name?: string } | undefined)?.name;
  if (name !== "Ed25519") throw new Error(`ed25519-subtle: only Ed25519 is supported, not ${String(name)}`);
}

function privateKey(seed: Uint8Array, usages: readonly string[]): ShimKey {
  return { type: "private", algorithm: { name: "Ed25519" }, extractable: false, usages, [SEED]: seed };
}

function publicKey(raw: Uint8Array): ShimKey {
  return { type: "public", algorithm: { name: "Ed25519" }, extractable: true, usages: ["verify"], raw };
}

export function createEd25519Subtle() {
  return {
    async generateKey(algorithm: unknown, _extractable: boolean, usages: readonly string[]) {
      requireEd25519(algorithm);
      const seed = ed25519.utils.randomPrivateKey();
      generated.push(seed.slice());
      if (generated.length > GENERATED_MAX) generated.shift()?.fill(0);
      return { privateKey: privateKey(seed, usages), publicKey: publicKey(ed25519.getPublicKey(seed)) };
    },

    async exportKey(format: string, key: ShimKey) {
      if (format !== "raw" || key.type !== "public" || key.raw === undefined) {
        throw new Error("ed25519-subtle: only the raw public key can be exported");
      }
      return buffer(key.raw);
    },

    // PKCS#8 for Ed25519 is a fixed 16-byte prefix followed by the 32-byte seed.
    async importKey(format: string, data: ArrayBuffer | ArrayBufferView, algorithm: unknown, _extractable: boolean, usages: readonly string[]) {
      requireEd25519(algorithm);
      const der = bytes(data);
      if (format !== "pkcs8" || der.length !== 48) throw new Error("ed25519-subtle: expected a 48-byte Ed25519 PKCS#8 key");
      return privateKey(der.slice(16), usages);
    },

    async sign(algorithm: unknown, key: ShimKey, data: ArrayBuffer | ArrayBufferView) {
      requireEd25519(algorithm);
      const seed = key[SEED];
      if (seed === undefined) throw new Error("ed25519-subtle: sign needs a private key");
      return buffer(ed25519.sign(bytes(data), seed));
    },
  };
}

// Installs the shim only where crypto.subtle is missing: a browser or Node keeps
// its own, non-extractable implementation. A crypto object that refuses new
// properties is replaced by one that keeps its getRandomValues and adds subtle.
export function installEd25519Subtle(target: { crypto?: { subtle?: unknown } } = globalThis as never): boolean {
  const current = target.crypto as { subtle?: unknown; getRandomValues?: unknown } | undefined;
  if (current?.subtle !== undefined) return true;
  const subtle = createEd25519Subtle();
  if (current !== undefined) {
    try {
      Object.defineProperty(current, "subtle", { value: subtle, configurable: true, enumerable: true, writable: true });
    } catch {
      // Not extensible: fall through and replace the object.
    }
    if (current.subtle !== undefined) return true;
  }
  const getRandomValues = current?.getRandomValues;
  const replacement = {
    ...(typeof getRandomValues === "function" ? { getRandomValues: getRandomValues.bind(current) } : {}),
    subtle,
  };
  try {
    Object.defineProperty(target, "crypto", { value: replacement, configurable: true, enumerable: true, writable: true });
  } catch {
    (target as { crypto: unknown }).crypto = replacement;
  }
  return target.crypto?.subtle !== undefined;
}
