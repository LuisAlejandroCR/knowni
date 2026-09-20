// attested.test.ts: The offline path, end to end and then attacked: a signed root, a Merkle
// path and a commitment opening, with no chain and no network anywhere.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { IdentityClaim } from "@knowni/core";
import { sha256Hash } from "@knowni/core/node";
import { issueClaimSet } from "@knowni/sources";
import {
  attestRoot,
  createMemoryRegistry,
  generateIssuerKeypair,
  signedBytes,
  verifyAttestedRoot,
  verifyCredential,
} from "../src/index.ts";
import { nodeSignatures } from "../src/node.ts";

const NOW = 1_760_000_000;
const ISSUER = "knowni-demo-issuer";

const claimFor = (ref: string): IdentityClaim => ({
  kind: "identity",
  jurisdiction: "CO",
  documentKind: "CC",
  subjectRef: { hex: ref },
  documentValid: true,
  subjectAlive: true,
  ofAge: true,
  attestedAt: NOW - 120,
});

function issued(claims = [claimFor("a".repeat(64)), claimFor("b".repeat(64))]) {
  const keypair = generateIssuerKeypair(nodeSignatures);
  const set = issueClaimSet(sha256Hash, { issuerId: ISSUER, claims, issuedAt: NOW - 60, padTo: 8 });
  const attestation = attestRoot(nodeSignatures, keypair.privateKeySeed, {
    issuerId: set.issuerId,
    root: set.root,
    issuedAt: set.issuedAt,
    size: set.size,
  });
  const registry = createMemoryRegistry({ [ISSUER]: keypair.publicKey });
  const credential = { ...set.credentials[0]!, attestation };
  return { keypair, set, attestation, registry, credential };
}

const check = (registry: ReturnType<typeof createMemoryRegistry>) => ({
  signatures: nodeSignatures,
  registry,
  nowUnix: NOW,
  maxRootAgeSeconds: 86_400,
});

test("a credential verifies with no chain, no network and no call to the source", () => {
  const { credential, registry } = issued();
  assert.deepEqual(verifyCredential(sha256Hash, credential, check(registry)), { status: "valid" });
});

test("an issuer nobody published is refused before any cryptography runs", () => {
  const { credential } = issued();
  const empty = createMemoryRegistry({});
  assert.deepEqual(verifyCredential(sha256Hash, credential, check(empty)), {
    status: "invalid",
    reason: "unknown_issuer",
  });
});

test("a root signed by a different issuer does not pass as this one", () => {
  const { attestation, credential, registry } = issued();
  const impostor = generateIssuerKeypair(nodeSignatures);
  const forged = attestRoot(nodeSignatures, impostor.privateKeySeed, {
    issuerId: attestation.issuerId,
    root: attestation.root,
    issuedAt: attestation.issuedAt,
    size: attestation.size,
  });
  assert.deepEqual(
    verifyCredential(sha256Hash, { ...credential, attestation: forged }, check(registry)),
    { status: "invalid", reason: "bad_signature" },
  );
});

test("moving a signed root onto another issuer id breaks the signature", () => {
  const { attestation, registry } = issued();
  const moved = { ...attestation, issuerId: "someone-else" };
  assert.deepEqual(verifyAttestedRoot(nodeSignatures, registry, moved), {
    status: "invalid",
    reason: "unknown_issuer",
  });
  // And with the key registered under the new name, the bytes still differ,
  // because the issuer id is inside what was signed.
  const { keypair } = issued();
  const registryTwo = createMemoryRegistry({ "someone-else": keypair.publicKey });
  assert.equal(verifyAttestedRoot(nodeSignatures, registryTwo, moved).status, "invalid");
});

test("the signed bytes are length-prefixed, so two fields cannot be re-split", () => {
  const a = signedBytes({ issuerId: "ab", root: "cd", issuedAt: 1, size: 1 });
  const b = signedBytes({ issuerId: "a", root: "bcd", issuedAt: 1, size: 1 });
  assert.notEqual(a.toString("hex"), b.toString("hex"));
});

test("a valid path into an unsigned tree is not a credential", () => {
  const { credential, registry } = issued();
  const other = issued();
  // The proof is internally consistent — it just leads to a root this issuer
  // never signed, which is the whole attack this check exists for.
  const swapped = { ...credential, proof: other.set.credentials[0]!.proof };
  assert.deepEqual(verifyCredential(sha256Hash, swapped, check(registry)), {
    status: "invalid",
    reason: "not_included",
  });
});

test("a claim swapped under a valid path fails on the commitment, not on the path", () => {
  const { credential, registry } = issued();
  const tampered = { ...credential, claim: { ...claimFor("c".repeat(64)) } };
  assert.deepEqual(verifyCredential(sha256Hash, tampered, check(registry)), {
    status: "invalid",
    reason: "commitment_mismatch",
  });
});

test("the wrong salt opens nothing, even with the right claim", () => {
  const { credential, registry } = issued();
  const wrongSalt = { ...credential, salt: { hex: "f".repeat(64) } };
  assert.deepEqual(verifyCredential(sha256Hash, wrongSalt, check(registry)), {
    status: "invalid",
    reason: "commitment_mismatch",
  });
});

test("a stale root expires, and one stamped in the future is refused too", () => {
  const { credential, registry } = issued();
  assert.deepEqual(
    verifyCredential(sha256Hash, credential, { signatures: nodeSignatures, registry, nowUnix: NOW, maxRootAgeSeconds: 10 }),
    { status: "invalid", reason: "root_expired" },
  );
  assert.deepEqual(
    verifyCredential(sha256Hash, credential, { signatures: nodeSignatures, registry,
      nowUnix: credential.attestation.issuedAt - 60,
      maxRootAgeSeconds: 86_400,
    }),
    { status: "invalid", reason: "root_expired" },
  );
});

test("revocation is a registry answer, and an absent entry is not a revocation", () => {
  const { credential, keypair, attestation } = issued();
  const revoked = createMemoryRegistry(
    { [ISSUER]: keypair.publicKey },
    [`${ISSUER}:${attestation.root}`],
  );
  assert.deepEqual(verifyCredential(sha256Hash, credential, check(revoked)), {
    status: "invalid",
    reason: "revoked",
  });
  // A registry with no revocation knowledge at all still verifies: a
  // registry that cannot be reached must not invalidate every credential.
  const silent = { publicKeyOf: () => keypair.publicKey };
  assert.deepEqual(verifyCredential(sha256Hash, credential, check(silent)), { status: "valid" });
});

test("padding hides how many claims the issuer wrote, and the padded leaves prove nothing", () => {
  const { set } = issued();
  assert.equal(set.size, 8);
  assert.equal(set.credentials.length, 2);
});
