// acceptance.spec.ts: The whole acceptance, in order: request, binding, evidence, revocation,
// and one atomic claim of the nullifier at the end — never before.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { SessionRequest } from "@knowni/core";
import { SolvencyTier, deriveNullifier, sessionId } from "@knowni/core";
import { sha256Hash } from "@knowni/core/node";
import {
  acceptAnswer,
  attestResults,
  createMemoryNullifierLedger,
  createMemoryRegistry,
  generateIssuerKeypair,
  signRequest,
  type AttestedAnswer,
  type RevocationOracle,
  type RevocationPolicy,
} from "../../src/index.ts";
import { nodeSignatures } from "../../src/node.ts";

const NOW = 1_760_000_000;
const ISSUER = "knowni-demo-issuer";
const AGENCY = "notaria-17";
const ROOT = "0f".repeat(32);
const SECRET = { hex: "7".repeat(64) };

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
    doesNotEstimate: "no dice quién es",
  },
  {
    predicate: "capacity",
    value: true,
    source: "sicaac",
    provenance: "observed",
    doesNotEstimate: "no afirma capacidad jurídica universal",
  },
];

const strict: RevocationPolicy = { maxSnapshotAgeSeconds: 3_600, onUnknown: "refuse" };
const tolerant: RevocationPolicy = { maxSnapshotAgeSeconds: 3_600, onUnknown: "accept_with_note" };

const liveOracle: RevocationOracle = { stateOf: () => ({ status: "live", checkedAt: NOW - 60 }) };

function setup() {
  const issuer = generateIssuerKeypair(nodeSignatures);
  const counterparty = generateIssuerKeypair(nodeSignatures);
  const registry = createMemoryRegistry({
    [ISSUER]: issuer.publicKey,
    [AGENCY]: counterparty.publicKey,
  });
  const session = sessionId(sha256Hash, request);
  return {
    registry,
    signedRequest: signRequest(nodeSignatures, counterparty.privateKeySeed, request),
    results: attestResults(sha256Hash, nodeSignatures, issuer.privateKeySeed, {
      issuerId: ISSUER,
      request,
      answers,
      issuedAt: NOW - 30,
      expiresAt: NOW + 300,
    }),
    disclosure: {
      sessionId: session,
      relyingPartyId: AGENCY,
      purpose: request.purpose,
      decidedAt: NOW,
      personhood: true as const,
      solvency: SolvencyTier.STRONG,
      formality: true as const,
      standing: true as const,
      capacity: "unavailable" as const,
      assetStanding: "unavailable" as const,
      issuerRoots: [ROOT],
      nullifier: deriveNullifier(sha256Hash, SECRET, session),
    },
  };
}

const inputOf = (over: Record<string, unknown> = {}) => {
  const base = setup();
  return {
    ...base,
    signatures: nodeSignatures,
    audience: AGENCY,
    presentationId: "pres-1",
    ledger: createMemoryNullifierLedger(),
    revocation: liveOracle,
    policy: strict,
    nowUnix: NOW,
    issuerRoot: ROOT,
    ...over,
  };
};

test("a well-formed answer with a fresh live revocation is accepted, unqualified", () => {
  const result = acceptAnswer(sha256Hash, inputOf());
  assert.deepEqual(result, { status: "accepted", idempotent: false, notes: [] });
});

test("a revoked root is refused whatever the policy says", () => {
  const revoked: RevocationOracle = { stateOf: () => ({ status: "revoked", checkedAt: NOW - 10 }) };
  for (const policy of [strict, tolerant]) {
    assert.deepEqual(acceptAnswer(sha256Hash, inputOf({ revocation: revoked, policy })), {
      status: "refused",
      reason: "revoked",
    });
  }
});

test("unknown revocation is its own outcome, and the policy decides out loud", () => {
  const silent: RevocationOracle = { stateOf: () => ({ status: "unknown" }) };
  assert.deepEqual(acceptAnswer(sha256Hash, inputOf({ revocation: silent, policy: strict })), {
    status: "refused",
    reason: "revocation_unknown",
  });
  assert.deepEqual(acceptAnswer(sha256Hash, inputOf({ revocation: silent, policy: tolerant })), {
    status: "accepted",
    idempotent: false,
    notes: ["revocation_unknown"],
  });
});

test("no oracle at all is unknown, not live", () => {
  assert.deepEqual(acceptAnswer(sha256Hash, inputOf({ revocation: undefined, policy: strict })), {
    status: "refused",
    reason: "revocation_unknown",
  });
});

test("a stale snapshot is refused by a strict counterparty and noted by a tolerant one", () => {
  const stale: RevocationOracle = { stateOf: () => ({ status: "live", checkedAt: NOW - 90_000 }) };
  assert.deepEqual(acceptAnswer(sha256Hash, inputOf({ revocation: stale, policy: strict })), {
    status: "refused",
    reason: "revocation_stale",
  });
  assert.deepEqual(acceptAnswer(sha256Hash, inputOf({ revocation: stale, policy: tolerant })), {
    status: "accepted",
    idempotent: false,
    notes: ["revocation_stale"],
  });
});

test("an unsigned or forged request never reaches the evidence checks", () => {
  const impostor = generateIssuerKeypair(nodeSignatures);
  const forged = signRequest(nodeSignatures, impostor.privateKeySeed, request);
  assert.deepEqual(acceptAnswer(sha256Hash, inputOf({ signedRequest: forged })), {
    status: "refused",
    reason: "bad_signature",
  });
});

test("an answer addressed to one counterparty does not fit another, and fails on the address", () => {
  const base = inputOf();
  const elsewhere = { ...request, relyingPartyId: "otra-notaria" };
  const counterparty = generateIssuerKeypair(nodeSignatures);
  const registry = createMemoryRegistry({ "otra-notaria": counterparty.publicKey });
  assert.deepEqual(
    acceptAnswer(sha256Hash, {
      ...base,
      registry,
      signedRequest: signRequest(nodeSignatures, counterparty.privateKeySeed, elsewhere),
      audience: "otra-notaria",
    }),
    // Caught at the address, before the session id is even recomputed: the
    // disclosure names who it was for, and it was not this notary.
    { status: "refused", reason: "wrong_audience" },
  );
});

test("a missing predicate refuses the whole answer", () => {
  assert.deepEqual(
    acceptAnswer(sha256Hash, inputOf({ requiredPredicates: ["personhood", "assetStanding"] })),
    { status: "refused", reason: "results_unauthenticated" },
  );
});

// ─── the consumption step ─────────────────────────────────────────────────

test("the same presentation twice is idempotent, not a second acceptance", () => {
  const input = inputOf();
  assert.deepEqual(acceptAnswer(sha256Hash, input), {
    status: "accepted",
    idempotent: false,
    notes: [],
  });
  // A retried request, a double tap: the acknowledgement repeats and says so.
  assert.deepEqual(acceptAnswer(sha256Hash, input), {
    status: "accepted",
    idempotent: true,
    notes: [],
  });
});

test("a different presentation under the same nullifier is a replay", () => {
  const input = inputOf();
  acceptAnswer(sha256Hash, input);
  assert.deepEqual(acceptAnswer(sha256Hash, { ...input, presentationId: "pres-2" }), {
    status: "refused",
    reason: "replayed",
  });
});

test("nothing before the last step consumes the nullifier", () => {
  const ledger = createMemoryNullifierLedger();
  const silent: RevocationOracle = { stateOf: () => ({ status: "unknown" }) };
  const impostor = generateIssuerKeypair(nodeSignatures);

  for (const broken of [
    inputOf({ ledger, revocation: silent, policy: strict }),
    inputOf({ ledger, signedRequest: signRequest(nodeSignatures, impostor.privateKeySeed, request) }),
    inputOf({ ledger, requiredPredicates: ["assetStanding"] }),
    inputOf({ ledger, nowUnix: request.expiresAt + 1 }),
  ]) {
    assert.equal(acceptAnswer(sha256Hash, broken).status, "refused");
  }

  assert.deepEqual(acceptAnswer(sha256Hash, inputOf({ ledger })), {
    status: "accepted",
    idempotent: false,
    notes: [],
  });
});

test("an expired window refuses before anything else is looked at", () => {
  assert.deepEqual(acceptAnswer(sha256Hash, inputOf({ nowUnix: request.expiresAt + 1 })), {
    status: "refused",
    reason: "session_expired",
  });
});
