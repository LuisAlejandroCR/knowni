// presentation.fuzz.spec.ts: malformed envelopes at the acceptance boundary.
// Everything here arrives from outside the process, so the rule is that a
// refusal is typed, nothing throws, and no failure ever spends the nullifier.

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
} from "../../src/index.ts";
import { nodeSignatures } from "../../src/node.ts";

const NOW = 1_760_000_000;
const ISSUER = "issuer";
const AUDIENCE = "notaria-17";
const FAILURES = new Set([
  "wrong_audience",
  "unknown_relying_party",
  "bad_signature",
  "invalid_purpose",
  "session_expired",
  "session_mismatch",
  "results_unauthenticated",
  "replayed",
  "revocation_unknown",
  "revocation_stale",
  "revoked",
]);

const request: SessionRequest = {
  relyingPartyId: AUDIENCE,
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
];

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

// Mutations a hostile or broken client could produce. None may throw.
const MUTATIONS: ((value: Record<string, unknown>) => Record<string, unknown>)[] = [
  (v) => ({ ...v, signature: "" }),
  (v) => ({ ...v, signature: "zz" }),
  (v) => ({ ...v, signature: "00".repeat(64) }),
  (v) => ({ ...v, issuerId: "" }),
  (v) => ({ ...v, issuerId: "../../etc/passwd" }),
  (v) => ({ ...v, sessionId: "not-a-session" }),
  (v) => ({ ...v, issuedAt: Number.MAX_SAFE_INTEGER }),
  (v) => ({ ...v, expiresAt: -1 }),
  (v) => ({ ...v, answers: [] }),
  (v) => ({ ...v, answers: [{ predicate: "personhood" }] }),
  (v) => ({ ...v, answers: "not-an-array" }),
  (v) => {
    const { signature: _dropped, ...rest } = v;
    return rest;
  },
];

test("no mutated envelope throws, and every refusal names a known reason", () => {
  const issuer = generateIssuerKeypair(nodeSignatures);
  const counterparty = generateIssuerKeypair(nodeSignatures);
  const registry = createMemoryRegistry({
    [ISSUER]: issuer.publicKey,
    [AUDIENCE]: counterparty.publicKey,
  });
  const signed = signRequest(nodeSignatures, counterparty.privateKeySeed, request);
  const session = sessionId(sha256Hash, request);
  const disclosure = {
    sessionId: session,
    relyingPartyId: AUDIENCE,
    purpose: request.purpose,
    decidedAt: NOW,
    personhood: true as const,
    solvency: SolvencyTier.STRONG,
    formality: true as const,
    sanctions: true as const,
    capacity: "unavailable" as const,
    assetStanding: "unavailable" as const,
    issuerRoots: ["0f".repeat(32)],
    nullifier: deriveNullifier(sha256Hash, { hex: "5".repeat(64) }, session),
  };
  const good = attestResults(sha256Hash, nodeSignatures, issuer.privateKeySeed, {
    issuerId: ISSUER,
    request,
    answers,
    issuedAt: NOW - 30,
    expiresAt: NOW + 300,
  });

  const ledger = createMemoryNullifierLedger();
  const random = lcg(4242);
  for (let i = 0; i < 200; i += 1) {
    const mutate = MUTATIONS[Math.floor(random() * MUTATIONS.length)]!;
    const results = mutate({ ...(good as unknown as Record<string, unknown>) });
    let outcome;
    try {
      outcome = acceptAnswer(sha256Hash, {
        signatures: nodeSignatures,
        signedRequest: signed,
        audience: AUDIENCE,
        disclosure,
        results: results as never,
        presentationId: `pres-${i}`,
        registry,
        ledger,
        revocation: { stateOf: () => ({ status: "live", checkedAt: NOW - 10 }) },
        policy: { maxSnapshotAgeSeconds: 3_600, onUnknown: "refuse" },
        nowUnix: NOW,
        issuerRoot: "0f".repeat(32),
      });
    } catch (error) {
      assert.fail(`threw on mutation ${i}: ${String(error)}`);
    }
    assert.equal(outcome.status, "refused", `mutation ${i} was accepted`);
    if (outcome.status === "refused") {
      assert.ok(FAILURES.has(outcome.reason), `unknown reason ${outcome.reason}`);
    }
  }

  // Two hundred malformed attempts later, the honest answer still works:
  // no failure spent the subject's nullifier.
  const accepted = acceptAnswer(sha256Hash, {
    signatures: nodeSignatures,
    signedRequest: signed,
    audience: AUDIENCE,
    disclosure,
    results: good,
    presentationId: "pres-good",
    registry,
    ledger,
    revocation: { stateOf: () => ({ status: "live", checkedAt: NOW - 10 }) },
    policy: { maxSnapshotAgeSeconds: 3_600, onUnknown: "refuse" },
    nowUnix: NOW,
    issuerRoot: "0f".repeat(32),
  });
  assert.deepEqual(accepted, { status: "accepted", idempotent: false, notes: [] });
});

test("arbitrary purposes are validated rather than hashed", () => {
  const counterparty = generateIssuerKeypair(nodeSignatures);
  const registry = createMemoryRegistry({ [AUDIENCE]: counterparty.publicKey });
  for (const purpose of ["", " ", "LEASE", "vehicle sale", "a".repeat(200), "../lease", "🙂"]) {
    const bad = { ...request, purpose };
    const signed = signRequest(nodeSignatures, counterparty.privateKeySeed, bad);
    const outcome = acceptAnswer(sha256Hash, {
      signatures: nodeSignatures,
      signedRequest: signed,
      audience: AUDIENCE,
      disclosure: {
        sessionId: "0".repeat(64),
        relyingPartyId: AUDIENCE,
        purpose,
        decidedAt: NOW,
        personhood: true,
        solvency: SolvencyTier.NONE,
        formality: true,
        sanctions: true,
        capacity: "unavailable",
        assetStanding: "unavailable",
        issuerRoots: [],
        nullifier: "1".repeat(64),
      },
      results: undefined as never,
      presentationId: "x",
      registry,
      ledger: createMemoryNullifierLedger(),
      policy: { maxSnapshotAgeSeconds: 3_600, onUnknown: "refuse" },
      nowUnix: NOW,
      issuerRoot: "0f".repeat(32),
    });
    assert.equal(outcome.status, "refused");
  }
});
