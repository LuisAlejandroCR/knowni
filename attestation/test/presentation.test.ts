// attestation/test/presentation.test.ts
// One answer, to one counterparty, once. The two attacks a working proof
// system still loses to — a moved presentation and a replayed one.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Disclosure, SessionRequest } from "@knowni/core";
import { SolvencyTier, deriveNullifier, sessionId, sha256Hash } from "@knowni/core";
import {
  acceptPresentation,
  createMemoryRegistry,
  createMemorySpentSet,
  generateIssuerKeypair,
  signRequest,
  verifyRequest,
} from "../src/index.ts";

const NOW = 1_760_000_000;
const AGENCY = "inmobiliaria-demo";
const NOTARY = "notaria-17";
const SECRET = { hex: "5".repeat(64) };

const requestFor = (over: Partial<SessionRequest> = {}): SessionRequest => ({
  relyingPartyId: AGENCY,
  purpose: "vehicle-sale",
  nonce: "ab".repeat(16),
  expiresAt: NOW + 600,
  paramsHash: "cd".repeat(32),
  ...over,
});

const disclosureFor = (request: SessionRequest): Disclosure => {
  const session = sessionId(sha256Hash, request);
  return {
    sessionId: session,
    relyingPartyId: request.relyingPartyId,
    purpose: request.purpose,
    decidedAt: NOW,
    personhood: true,
    solvency: SolvencyTier.STRONG,
    formality: true,
    standing: true,
    issuerRoots: ["f".repeat(64)],
    nullifier: deriveNullifier(sha256Hash, SECRET, session),
  };
};

// ─── the request the subject is asked to answer ───────────────────────────

test("a signed request from the expected counterparty is accepted", () => {
  const keypair = generateIssuerKeypair();
  const registry = createMemoryRegistry({ [AGENCY]: keypair.publicKey });
  const signed = signRequest(keypair.privateKeySeed, requestFor());
  assert.deepEqual(verifyRequest(registry, signed, AGENCY, NOW), { status: "accepted" });
});

test("a perfectly valid signature from the wrong party is still refused", () => {
  // The phishing case: the notary's key is real, the notary just is not who
  // the subject thinks they are answering.
  const notary = generateIssuerKeypair();
  const registry = createMemoryRegistry({ [NOTARY]: notary.publicKey });
  const signed = signRequest(notary.privateKeySeed, requestFor({ relyingPartyId: NOTARY }));
  assert.deepEqual(verifyRequest(registry, signed, AGENCY, NOW), {
    status: "refused",
    reason: "wrong_audience",
  });
});

test("a tampered request does not survive its own signature", () => {
  const keypair = generateIssuerKeypair();
  const registry = createMemoryRegistry({ [AGENCY]: keypair.publicKey });
  const signed = signRequest(keypair.privateKeySeed, requestFor());
  const tampered = { ...signed, request: { ...signed.request, paramsHash: "ee".repeat(32) } };
  assert.deepEqual(verifyRequest(registry, tampered, AGENCY, NOW), {
    status: "refused",
    reason: "bad_signature",
  });
});

test("an expired window is refused before any key is looked up", () => {
  const keypair = generateIssuerKeypair();
  const registry = createMemoryRegistry({ [AGENCY]: keypair.publicKey });
  const signed = signRequest(keypair.privateKeySeed, requestFor({ expiresAt: NOW - 1 }));
  assert.deepEqual(verifyRequest(registry, signed, AGENCY, NOW), {
    status: "refused",
    reason: "session_expired",
  });
});

test("a counterparty nobody published cannot ask anything", () => {
  const keypair = generateIssuerKeypair();
  const signed = signRequest(keypair.privateKeySeed, requestFor());
  assert.deepEqual(verifyRequest(createMemoryRegistry({}), signed, AGENCY, NOW), {
    status: "refused",
    reason: "unknown_relying_party",
  });
});

// ─── the answer, accepted once ────────────────────────────────────────────

test("an answer built for this request is accepted", () => {
  const request = requestFor();
  const spent = createMemorySpentSet();
  assert.deepEqual(
    acceptPresentation(sha256Hash, {
      disclosure: disclosureFor(request),
      request,
      audience: AGENCY,
      spent,
      nowUnix: NOW,
    }),
    { status: "accepted" },
  );
});

test("the same answer twice is refused the second time", () => {
  const request = requestFor();
  const disclosure = disclosureFor(request);
  const spent = createMemorySpentSet();
  const options = { disclosure, request, audience: AGENCY, spent, nowUnix: NOW };
  assert.equal(acceptPresentation(sha256Hash, options).status, "accepted");
  assert.deepEqual(acceptPresentation(sha256Hash, options), {
    status: "refused",
    reason: "replayed",
  });
});

test("an answer given to one counterparty does not work at another", () => {
  // The agency tries to present the subject's answer to a notary as its own
  // applicant. The session id carries the audience, so it does not fit.
  const forAgency = requestFor();
  const disclosure = disclosureFor(forAgency);
  const atNotary = requestFor({ relyingPartyId: NOTARY });
  assert.deepEqual(
    acceptPresentation(sha256Hash, {
      disclosure,
      request: atNotary,
      audience: NOTARY,
      spent: createMemorySpentSet(),
      nowUnix: NOW,
    }),
    { status: "refused", reason: "wrong_audience" },
  );
});

test("a fresh challenge makes yesterday's answer useless", () => {
  const disclosure = disclosureFor(requestFor({ nonce: "11".repeat(16) }));
  assert.deepEqual(
    acceptPresentation(sha256Hash, {
      disclosure,
      request: requestFor({ nonce: "22".repeat(16) }),
      audience: AGENCY,
      spent: createMemorySpentSet(),
      nowUnix: NOW,
    }),
    { status: "refused", reason: "session_mismatch" },
  );
});

test("an answer cannot be moved to a cheaper question", () => {
  // Same audience, same challenge, different parameters: a STRONG answer
  // about a three-million obligation is not an answer about a ten-million
  // one, and the params hash is inside the session id.
  const disclosure = disclosureFor(requestFor());
  assert.deepEqual(
    acceptPresentation(sha256Hash, {
      disclosure,
      request: requestFor({ paramsHash: "99".repeat(32) }),
      audience: AGENCY,
      spent: createMemorySpentSet(),
      nowUnix: NOW,
    }),
    { status: "refused", reason: "session_mismatch" },
  );
});

test("an answer for one purpose is not an answer for another", () => {
  const disclosure = disclosureFor(requestFor({ purpose: "lease" }));
  assert.deepEqual(
    acceptPresentation(sha256Hash, {
      disclosure,
      request: requestFor({ purpose: "vehicle-sale" }),
      audience: AGENCY,
      spent: createMemorySpentSet(),
      nowUnix: NOW,
    }),
    { status: "refused", reason: "session_mismatch" },
  );
});

test("the window closing refuses the answer rather than failing the subject", () => {
  const request = requestFor();
  assert.deepEqual(
    acceptPresentation(sha256Hash, {
      disclosure: disclosureFor(request),
      request,
      audience: AGENCY,
      spent: createMemorySpentSet(),
      nowUnix: request.expiresAt + 1,
    }),
    { status: "refused", reason: "session_expired" },
  );
});

test("the same subject at two counterparties leaves unlinkable nullifiers", () => {
  const atAgency = disclosureFor(requestFor());
  const atNotary = disclosureFor(requestFor({ relyingPartyId: NOTARY }));
  assert.notEqual(atAgency.nullifier, atNotary.nullifier);
  // And one counterparty's spent set says nothing about the other's.
  const spent = createMemorySpentSet([atAgency.nullifier]);
  assert.equal(spent.has(atNotary.nullifier), false);
});

test("a refused presentation does not spend the nullifier", () => {
  const request = requestFor();
  const disclosure = disclosureFor(request);
  const spent = createMemorySpentSet();
  acceptPresentation(sha256Hash, {
    disclosure,
    request: requestFor({ nonce: "33".repeat(16) }),
    audience: AGENCY,
    spent,
    nowUnix: NOW,
  });
  // The subject's answer was never accepted, so presenting it properly must
  // still work — a failed attempt that burned the nullifier would lock
  // someone out of their own credential.
  assert.deepEqual(
    acceptPresentation(sha256Hash, { disclosure, request, audience: AGENCY, spent, nowUnix: NOW }),
    { status: "accepted" },
  );
});
