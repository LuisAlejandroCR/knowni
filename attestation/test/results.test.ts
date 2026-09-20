// results.test.ts: What crosses the wire, and what must not: answers signed by the issuer and
// bound to one request, with the claim and its salt left in the wallet.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { SessionRequest } from "@knowni/core";
import { SolvencyTier, deriveNullifier, sessionId, sha256Hash } from "@knowni/core";
import { issueClaimSet } from "@knowni/sources";
import {
  acceptPresentation,
  attestResults,
  attestRoot,
  containsHeldSecrets,
  createMemoryRegistry,
  createMemorySpentSet,
  generateIssuerKeypair,
  verifyResults,
  type AttestedAnswer,
} from "../src/index.ts";

const NOW = 1_760_000_000;
const ISSUER = "knowni-demo-issuer";
const AGENCY = "notaria-17";
const SECRET = { hex: "5".repeat(64) };

const request: SessionRequest = {
  relyingPartyId: AGENCY,
  purpose: "vehicle-sale",
  nonce: "ab".repeat(16),
  expiresAt: NOW + 600,
  paramsHash: "cd".repeat(32),
};

const answers: AttestedAnswer[] = [
  {
    predicate: "personhood",
    value: true,
    source: "registraduria",
    provenance: "observed",
    doesNotEstimate: "no dice quién es, ni su edad, ni su domicilio",
  },
  {
    predicate: "capacity",
    value: true,
    source: "sicaac",
    provenance: "observed",
    doesNotEstimate: "no afirma capacidad jurídica universal, solo ausencia de insolvencia",
  },
  {
    predicate: "assetStanding",
    value: "unavailable",
    source: "runt+simit",
    provenance: "observed",
    doesNotEstimate: "sin respuesta de la fuente; no es un resultado negativo",
  },
];

function attested(over: Partial<Parameters<typeof attestResults>[2]> = {}) {
  const keypair = generateIssuerKeypair();
  const registry = createMemoryRegistry({ [ISSUER]: keypair.publicKey });
  const results = attestResults(sha256Hash, keypair.privateKeySeed, {
    issuerId: ISSUER,
    request,
    answers,
    issuedAt: NOW - 30,
    expiresAt: NOW + 300,
    ...over,
  });
  return { keypair, registry, results };
}

test("signed answers verify against the request the counterparty sent", () => {
  const { registry, results } = attested();
  const verified = verifyResults(sha256Hash, results, { registry, request, nowUnix: NOW });
  assert.equal(verified.status, "valid");
  assert.equal(verified.status === "valid" ? verified.answers.length : 0, 3);
});

test("what crosses the wire carries no claim, no salt and no subject reference", () => {
  const { results } = attested();
  assert.equal(containsHeldSecrets(results), false);
  const wire = JSON.stringify(results);
  for (const forbidden of ["claim", "salt", "subjectRef", "blinding", "monthlyMinor"]) {
    assert.ok(!wire.includes(forbidden), `${forbidden} leaked into the envelope`);
  }
});

test("the held credential still carries the secrets, which is why it is never sent", () => {
  // The guard is worth having precisely because the wallet-side object does
  // contain them: the difference between the two shapes IS the fix.
  const keypair = generateIssuerKeypair();
  const set = issueClaimSet(sha256Hash, {
    issuerId: ISSUER,
    claims: [
      {
        kind: "capacity",
        jurisdiction: "CO",
        subjectRef: { hex: "a".repeat(64) },
        restricted: false,
        basis: "insolvency_proceeding",
        attestedAt: NOW - 100,
      },
    ],
    issuedAt: NOW - 60,
  });
  const held = {
    ...set.credentials[0]!,
    attestation: attestRoot(keypair.privateKeySeed, {
      issuerId: set.issuerId,
      root: set.root,
      issuedAt: set.issuedAt,
      size: set.size,
    }),
  };
  assert.equal(containsHeldSecrets(held), true);
});

test("an answer cannot be re-labelled as a different predicate", () => {
  const { registry, results } = attested();
  const relabelled = {
    ...results,
    answers: [{ ...results.answers[2]!, predicate: "capacity" }, ...results.answers.slice(0, 2)],
  };
  assert.deepEqual(verifyResults(sha256Hash, relabelled, { registry, request, nowUnix: NOW }), {
    status: "invalid",
    reason: "bad_signature",
  });
});

test("flipping a value breaks the signature, and so does widening what it claims", () => {
  const { registry, results } = attested();
  const flipped = {
    ...results,
    answers: [{ ...results.answers[0]!, value: false }, ...results.answers.slice(1)],
  };
  const widened = {
    ...results,
    answers: [{ ...results.answers[1]!, doesNotEstimate: "" }, ...results.answers.slice(2)],
  };
  for (const tampered of [flipped, widened]) {
    assert.equal(
      verifyResults(sha256Hash, tampered, { registry, request, nowUnix: NOW }).status,
      "invalid",
    );
  }
});

test("answers do not move to another audience, purpose, challenge or parameters", () => {
  const { registry, results } = attested();
  const elsewhere = [
    { ...request, relyingPartyId: "otra-notaria" },
    { ...request, purpose: "lease" },
    { ...request, nonce: "11".repeat(16) },
    { ...request, paramsHash: "99".repeat(32) },
  ];
  for (const other of elsewhere) {
    assert.deepEqual(verifyResults(sha256Hash, results, { registry, request: other, nowUnix: NOW }), {
      status: "invalid",
      reason: "session_mismatch",
    });
  }
});

test("expired answers and answers from the future are both refused", () => {
  const { registry, results } = attested();
  assert.equal(
    verifyResults(sha256Hash, results, { registry, request, nowUnix: NOW + 3_600 }).reason,
    "expired",
  );
  assert.equal(
    verifyResults(sha256Hash, results, { registry, request, nowUnix: NOW - 3_600 }).reason,
    "expired",
  );
});

test("a missing predicate is incomplete, not partially acceptable", () => {
  const { registry, results } = attested();
  assert.deepEqual(
    verifyResults(sha256Hash, results, {
      registry,
      request,
      nowUnix: NOW,
      required: ["personhood", "sanctions"],
    }),
    { status: "invalid", reason: "answer_missing" },
  );
});

test("an issuer nobody published cannot answer anything", () => {
  const { results } = attested();
  assert.deepEqual(
    verifyResults(sha256Hash, results, { registry: createMemoryRegistry({}), request, nowUnix: NOW }),
    { status: "invalid", reason: "unknown_issuer" },
  );
});

// ─── acceptance now checks the evidence, not just the binding ─────────────

const disclosureFor = (session: string) => ({
  sessionId: session,
  relyingPartyId: AGENCY,
  purpose: request.purpose,
  decidedAt: NOW,
  personhood: true as const,
  solvency: SolvencyTier.STRONG,
  formality: true as const,
  standing: true as const,
  issuerRoots: ["f".repeat(64)],
  nullifier: deriveNullifier(sha256Hash, SECRET, session),
});

test("acceptance verifies the answers before spending the nullifier", () => {
  const { registry, results } = attested();
  const spent = createMemorySpentSet();
  assert.deepEqual(
    acceptPresentation(sha256Hash, {
      disclosure: disclosureFor(sessionId(sha256Hash, request)),
      request,
      audience: AGENCY,
      spent,
      nowUnix: NOW,
      results,
      registry,
      requiredPredicates: ["personhood", "capacity"],
    }),
    { status: "accepted" },
  );
});

test("tampered answers are refused AND leave the nullifier unspent", () => {
  const { registry, results } = attested();
  const spent = createMemorySpentSet();
  const disclosure = disclosureFor(sessionId(sha256Hash, request));
  const tampered = {
    ...results,
    answers: [{ ...results.answers[2]!, value: true }, ...results.answers.slice(0, 2)],
  };
  assert.deepEqual(
    acceptPresentation(sha256Hash, {
      disclosure,
      request,
      audience: AGENCY,
      spent,
      nowUnix: NOW,
      results: tampered,
      registry,
    }),
    { status: "refused", reason: "results_unauthenticated" },
  );
  // The subject did nothing wrong, so their credential must still work.
  assert.equal(spent.has(disclosure.nullifier), false);
});

test("presenting answers without a registry is refused rather than trusted", () => {
  const { results } = attested();
  assert.deepEqual(
    acceptPresentation(sha256Hash, {
      disclosure: disclosureFor(sessionId(sha256Hash, request)),
      request,
      audience: AGENCY,
      spent: createMemorySpentSet(),
      nowUnix: NOW,
      results,
    }),
    { status: "refused", reason: "results_unauthenticated" },
  );
});
