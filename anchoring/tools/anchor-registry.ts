// anchor-registry.ts: publishes one registry document and anchors its digest on
// Stellar testnet, then reads it back the way a verifier would. Prints the
// transaction hash and its Explorer link.
//
// It lives beside anchor-testnet.ts because what it does is anchor; the
// document it anchors comes from `attestation/`, which is why that package is a
// dev dependency of this one and not a dependency of anything under src/.
//
//   node --experimental-strip-types anchoring/tools/anchor-registry.ts

import { toHex } from "@knowni/core";
import { sha256Hash } from "@knowni/core/node";
import {
  createChainRegistry,
  createStellarRegistryReader,
  generateIssuerKeypair,
  registryDigest,
  signRegistry,
  type RegistryDocument,
} from "@knowni/attestation";
import { nodeSignatures } from "@knowni/attestation/node";
import { accountIdOf, createHorizonMemoSubmitter, demoSeedFrom } from "../src/adapters/stellar-horizon.ts";

const HORIZON = "https://horizon-testnet.stellar.org";
const passphrase = process.env["KNOWNI_DEMO_SEED_PHRASE"] ?? "knowni testnet demo account";
const seed = demoSeedFrom(passphrase);
const accountId = accountIdOf(seed);
console.log("authority account", accountId);

const probe = await fetch(`${HORIZON}/accounts/${accountId}`);
if (!probe.ok) throw new Error(`the authority account is not on testnet: ${probe.status}`);

// A registry the way a registry authority would publish one: issuer keys and
// revoked roots, signed, with an expiry. The keys are generated here because
// this is a demo authority; nothing about the exercise depends on which they
// are, only on the document being one document.
const issuer = generateIssuerKeypair(nodeSignatures);
const authority = generateIssuerKeypair(nodeSignatures);
const now = Math.floor(Date.now() / 1000);
const document: RegistryDocument = {
  registryId: "knowni-co-demo",
  issuedAt: now,
  expiresAt: now + 30 * 86_400,
  issuers: [{ issuerId: "knowni-demo-issuer", publicKey: toHex(issuer.publicKey) }],
  revoked: [],
};
const signed = signRegistry(nodeSignatures, authority.privateKeySeed, document);
const digest = registryDigest(sha256Hash, signed);
console.log("registry digest", digest);

const submitter = createHorizonMemoSubmitter(seed, { horizonUrl: HORIZON });
const submitted = await submitter.sendMemoHash(Uint8Array.from(digest.match(/../g)!.map((p) => Number.parseInt(p, 16))));
console.log("anchored in", submitted.hash);
console.log(`explorer https://stellar.expert/explorer/testnet/tx/${submitted.hash}`);

// And now the verifier's side, against the same network: the reader finds the
// digest on the account, and the chain registry refuses any document whose
// digest is not the one anchored. The document itself is served from memory
// here — nothing is published over HTTPS yet, and this does not pretend it is.
const reader = createStellarRegistryReader({ authorityAccountId: accountId, horizonUrl: HORIZON });
const anchored = await reader.current();
console.log("read back", anchored);
if (anchored?.digest !== digest) throw new Error("the digest read from the chain is not the one anchored");

const mirror: typeof fetch = async () => new Response(JSON.stringify(signed), { status: 200 });
const port = createChainRegistry({
  h: sha256Hash,
  reader,
  documentUrl: "memory://registry.json",
  fetchImpl: mirror,
});
const resolution = await port.resolve(now + 60);
console.log("resolution", resolution.status, resolution.status === "resolved" ? resolution.snapshot.trustedVia : resolution.reason);
if (resolution.status !== "resolved") throw new Error("the registry did not resolve against the anchored digest");

// The tampering check, on the real anchor: another document, same chain.
const forged = signRegistry(nodeSignatures, authority.privateKeySeed, { ...document, registryId: "knowni-co-other" });
const tampered = createChainRegistry({
  h: sha256Hash,
  reader,
  documentUrl: "memory://registry.json",
  fetchImpl: async () => new Response(JSON.stringify(forged), { status: 200 }),
});
const refused = await tampered.resolve(now + 60);
console.log("tampered document ->", refused.status === "unavailable" ? refused.reason : "RESOLVED (wrong)");
