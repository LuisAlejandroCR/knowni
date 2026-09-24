// publish-registry.ts: prints the two things a registry authority publishes —
// the signed document to serve over HTTPS, and the digest to anchor on a chain.
// Both come from the same bytes, which is the point: the web path and the chain
// path must be two roots of trust over one document, never two documents.
//
//   KNOWNI_REGISTRY_SEED=<64 hex> node --experimental-strip-types \
//     attestation/tools/publish-registry.ts registry.json > signed-registry.json
//
// The input is the document without its signature. The seed never leaves here:
// what is printed is the document, its signature and the digest on stderr.

import { readFileSync } from "node:fs";
import { sha256Hash } from "@knowni/core/node";
import { nodeSignatures } from "../src/node.ts";
import { parseRegistryDocument, registryDigest, signRegistry } from "../src/registry.ts";

const seedHex = process.env["KNOWNI_REGISTRY_SEED"];
if (seedHex === undefined || !/^[0-9a-f]{64}$/.test(seedHex)) {
  throw new Error("KNOWNI_REGISTRY_SEED must be 64 lowercase hex characters");
}
const path = process.argv[2];
if (path === undefined) throw new Error("usage: publish-registry.ts <document.json>");

const seed = Uint8Array.from(seedHex.match(/../g)!.map((pair) => Number.parseInt(pair, 16)));
const document: unknown = JSON.parse(readFileSync(path, "utf8"));
const signed = signRegistry(nodeSignatures, seed, document as Parameters<typeof signRegistry>[2]);

// Sign, then read back what was signed through the same parser a verifier uses.
// A document this tool cannot parse is one nobody could have verified.
if (parseRegistryDocument(signed) === undefined) {
  throw new Error("the document signed is not one a verifier would accept");
}

process.stdout.write(`${JSON.stringify(signed, null, 2)}\n`);
// The digest goes to stderr so that piping the document into a file leaves it
// visible: it is what gets anchored, and it is not part of the document.
process.stderr.write(`anchor this digest as MEMO_HASH: ${registryDigest(sha256Hash, signed)}\n`);
