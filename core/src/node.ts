// node.ts: the Node bindings of the platform ports — sha256 and randomness.
// Imported by tests, tools and any server-side caller. React Native never
// reaches this file, which is the point of it being separate.

import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";
import { createFieldHash, type FieldHash } from "./hash.ts";
import { toHex } from "./bytes.ts";
import { setRandomSource } from "./random.ts";

setRandomSource((byteLength) => Uint8Array.from(nodeRandomBytes(byteLength)));

export const sha256Hash: FieldHash = createFieldHash(
  "sha256",
  (bytes) => Uint8Array.from(createHash("sha256").update(bytes).digest()),
  toHex,
);
