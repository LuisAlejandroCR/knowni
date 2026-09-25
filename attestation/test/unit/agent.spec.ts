// agent.spec.ts: an agent presents what the device built, within what the subject delegated.
// The counterparty learns "an authorized agent presented" and nothing more, the nullifier
// is spent once whoever presents, and a revoked delegation stops the next presentation.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Disclosure, SessionRequest } from "@knowni/core";
import { SolvencyTier, deriveNullifier, sessionId, toHex } from "@knowni/core";
import { sha256Hash } from "@knowni/core/node";
import {
  acceptAgentAnswer,
  acceptAnswer,
  attestResults,
  createMemoryNullifierLedger,
  createMemoryRegistry,
  generateIssuerKeypair,
  prepareForAgent,
  presentAsAgent,
  signDelegation,
  signRequest,
  type DelegationRevocationOracle,
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

const strict: RevocationPolicy = { maxSnapshotAgeSeconds: 3_600, onUnknown: "refuse" };
const tolerant: RevocationPolicy = { maxSnapshotAgeSeconds: 3_600, onUnknown: "accept_with_note" };
const liveRoot: RevocationOracle = { stateOf: () => ({ status: "live", checkedAt: NOW - 60 }) };
const liveDelegation: DelegationRevocationOracle = { stateOf: () => ({ status: "live", checkedAt: NOW - 60 }) };

function world() {
  const issuer = generateIssuerKeypair(nodeSignatures);
  const counterparty = generateIssuerKeypair(nodeSignatures);
  const delegationSeed = nodeSignatures.randomSeed();
  const agentSeed = nodeSignatures.randomSeed();
  const registry = createMemoryRegistry({ [ISSUER]: issuer.publicKey, [AGENCY]: counterparty.publicKey });
  const session = sessionId(sha256Hash, request);
  const disclosure: Disclosure = {
    sessionId: session,
    relyingPartyId: AGENCY,
    purpose: request.purpose,
    decidedAt: NOW,
    personhood: true,
    solvency: SolvencyTier.STRONG,
    formality: true,
    sanctions: true,
    capacity: "unavailable",
    assetStanding: "unavailable",
    issuerRoots: [ROOT],
    nullifier: deriveNullifier(sha256Hash, SECRET, session),
  };
  const results = attestResults(sha256Hash, nodeSignatures, issuer.privateKeySeed, {
    issuerId: ISSUER,
    request,
    answers: [
      { predicate: "personhood", value: true, source: "registraduria", provenance: "observed", doesNotEstimate: "no dice quién es" },
    ],
    issuedAt: NOW - 30,
    expiresAt: NOW + 300,
  });
  const delegation = signDelegation(nodeSignatures, delegationSeed, {
    id: "1e".repeat(16),
    subjectKey: toHex(nodeSignatures.publicKeyOf(delegationSeed)),
    agentKey: toHex(nodeSignatures.publicKeyOf(agentSeed)),
    purpose: request.purpose,
    relyingPartyId: AGENCY,
    notBefore: NOW - 60,
    expiresAt: NOW + 3_600,
  });
  const bundle = prepareForAgent(nodeSignatures, delegationSeed, { disclosure, results, delegation });
  const presentation = presentAsAgent(nodeSignatures, agentSeed, bundle, "pres-agent");
  const common = {
    signatures: nodeSignatures,
    signedRequest: signRequest(nodeSignatures, counterparty.privateKeySeed, request),
    audience: AGENCY,
    registry,
    ledger: createMemoryNullifierLedger(),
    revocation: liveRoot,
    policy: strict,
    nowUnix: NOW,
    issuerRoot: ROOT,
  };
  return { common, disclosure, results, delegation, delegationSeed, agentSeed, bundle, presentation };
}

const agentInput = (w: ReturnType<typeof world>, over: Record<string, unknown> = {}) => ({
  ...w.common,
  presentation: w.presentation,
  delegationRevocation: liveDelegation,
  delegationPolicy: strict,
  ...over,
});

test("G3: an agent's answer is accepted and says only that an authorized agent presented it", () => {
  const w = world();
  const result = acceptAgentAnswer(sha256Hash, agentInput(w));
  assert.deepEqual(result, { status: "accepted", idempotent: false, notes: [], presentedBy: "authorized_agent" });
  assert.ok(!JSON.stringify(result).includes(w.delegation.agentKey));
  assert.ok(!JSON.stringify(result).includes(w.delegation.id));
});

test("G1: what reaches the agent is a built presentation, never the secret, a claim or a salt", () => {
  const w = world();
  const serialized = JSON.stringify(w.bundle);
  assert.ok(!serialized.includes(SECRET.hex));
  assert.ok(!serialized.includes(toHex(w.delegationSeed)));
  assert.deepEqual(Object.keys(w.bundle).sort(), ["delegation", "disclosure", "endorsement", "results"]);
  assert.throws(() =>
    prepareForAgent(nodeSignatures, w.delegationSeed, {
      disclosure: { ...w.disclosure, claim: { hex: "00" } } as unknown as Disclosure,
      results: w.results,
      delegation: w.delegation,
    }),
  );
});

test("the device refuses to endorse an answer outside its delegation, or with a key that is not the delegation's", () => {
  const w = world();
  assert.throws(() =>
    prepareForAgent(nodeSignatures, w.delegationSeed, {
      disclosure: { ...w.disclosure, purpose: "lease" },
      results: w.results,
      delegation: w.delegation,
    }),
  );
  assert.throws(() =>
    prepareForAgent(nodeSignatures, nodeSignatures.randomSeed(), { disclosure: w.disclosure, results: w.results, delegation: w.delegation }),
  );
});

test("G4: the nullifier is spent once, whether the subject or the agent presents first", () => {
  const agentFirst = world();
  assert.equal(acceptAgentAnswer(sha256Hash, agentInput(agentFirst)).status, "accepted");
  assert.deepEqual(
    acceptAnswer(sha256Hash, { ...agentFirst.common, disclosure: agentFirst.disclosure, results: agentFirst.results, presentationId: "pres-subject" }),
    { status: "refused", reason: "replayed" },
  );

  const subjectFirst = world();
  assert.equal(
    acceptAnswer(sha256Hash, { ...subjectFirst.common, disclosure: subjectFirst.disclosure, results: subjectFirst.results, presentationId: "pres-subject" }).status,
    "accepted",
  );
  assert.deepEqual(acceptAgentAnswer(sha256Hash, agentInput(subjectFirst)), { status: "refused", reason: "replayed" });

  const twice = world();
  const again = presentAsAgent(nodeSignatures, twice.agentSeed, twice.bundle, "pres-agent-2");
  assert.equal(acceptAgentAnswer(sha256Hash, agentInput(twice)).status, "accepted");
  assert.deepEqual(acceptAgentAnswer(sha256Hash, agentInput(twice, { presentation: again })), { status: "refused", reason: "replayed" });
});

test("G5: a revoked delegation stops the next presentation, and unknown is decided by the policy", () => {
  const revoked: DelegationRevocationOracle = { stateOf: () => ({ status: "revoked", checkedAt: NOW - 1 }) };
  const silent: DelegationRevocationOracle = { stateOf: () => ({ status: "unknown" }) };
  const stale: DelegationRevocationOracle = { stateOf: () => ({ status: "live", checkedAt: NOW - 7_200 }) };
  for (const policy of [strict, tolerant]) {
    assert.deepEqual(acceptAgentAnswer(sha256Hash, agentInput(world(), { delegationRevocation: revoked, delegationPolicy: policy })), {
      status: "refused",
      reason: "delegation_revoked",
    });
  }
  assert.deepEqual(acceptAgentAnswer(sha256Hash, agentInput(world(), { delegationRevocation: silent })), {
    status: "refused",
    reason: "delegation_revocation_unknown",
  });
  assert.deepEqual(acceptAgentAnswer(sha256Hash, agentInput(world(), { delegationRevocation: stale })), {
    status: "refused",
    reason: "delegation_revocation_stale",
  });
  const noted = acceptAgentAnswer(sha256Hash, agentInput(world(), { delegationRevocation: silent, delegationPolicy: tolerant }));
  assert.equal(noted.status, "accepted");
  assert.ok(noted.status === "accepted" && noted.notes.includes("delegation_revocation_unknown"));
});

test("a refused agent presentation never spends the nullifier", () => {
  const w = world();
  const revoked: DelegationRevocationOracle = { stateOf: () => ({ status: "revoked", checkedAt: NOW - 1 }) };
  assert.equal(acceptAgentAnswer(sha256Hash, agentInput(w, { delegationRevocation: revoked })).status, "refused");
  assert.equal(
    acceptAnswer(sha256Hash, { ...w.common, disclosure: w.disclosure, results: w.results, presentationId: "pres-subject" }).status,
    "accepted",
  );
});

test("an agent cannot move a delegation to another answer, nor sign for another agent", () => {
  const w = world();
  const otherAnswer = { ...w.disclosure, nullifier: deriveNullifier(sha256Hash, { hex: "8".repeat(64) }, w.disclosure.sessionId) };
  const moved = presentAsAgent(nodeSignatures, w.agentSeed, { ...w.bundle, disclosure: otherAnswer }, "pres-x");
  assert.deepEqual(acceptAgentAnswer(sha256Hash, agentInput(w, { presentation: moved })), { status: "refused", reason: "bad_endorsement" });
  const impostor = presentAsAgent(nodeSignatures, nodeSignatures.randomSeed(), w.bundle, "pres-y");
  assert.deepEqual(acceptAgentAnswer(sha256Hash, agentInput(w, { presentation: impostor })), {
    status: "refused",
    reason: "bad_agent_signature",
  });
  const relabeled = { ...w.presentation, presentationId: "pres-z" };
  assert.deepEqual(acceptAgentAnswer(sha256Hash, agentInput(w, { presentation: relabeled })), {
    status: "refused",
    reason: "bad_agent_signature",
  });
});

test("a delegation for another counterparty or purpose is refused before anything else", () => {
  const w = world();
  const elsewhere = signDelegation(nodeSignatures, w.delegationSeed, { ...w.delegation, relyingPartyId: "notaria-18" });
  assert.deepEqual(
    acceptAgentAnswer(sha256Hash, agentInput(w, { presentation: { ...w.presentation, delegation: elsewhere } })),
    { status: "refused", reason: "relying_party_mismatch" },
  );
});
