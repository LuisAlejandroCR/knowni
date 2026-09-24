// node.ts: the Node bindings of the platform ports — sha256 and randomness.
// Imported by tests, tools and any server-side caller. React Native never
// reaches this file, which is the point of it being separate.

import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";
import { createFieldHash, type Digest, type FieldHash } from "./hash.ts";
import { createPoseidonHasher, type FieldHasher } from "./field-hasher.ts";
import { BN254_PRIME } from "./poseidon-params.ts";
import { toHex } from "./bytes.ts";
import { setRandomSource } from "./random.ts";

setRandomSource((byteLength) => Uint8Array.from(nodeRandomBytes(byteLength)));

const sha256: Digest = (bytes) => Uint8Array.from(createHash("sha256").update(bytes).digest());

export const sha256Hash: FieldHash = createFieldHash("sha256", sha256, toHex);

/// The hash the circuit uses. `sha256Hash` stays for what has not moved yet —
/// the outcome commitment and the session — and the two are not interchangeable
/// on purpose: one takes bytes, the other elements.
export const poseidonHash: FieldHasher = createPoseidonHasher(sha256, BN254_PRIME, 254);
