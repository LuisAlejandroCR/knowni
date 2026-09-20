// offline.spec.ts: the journey with the network taken away and the chain switched off.
// `fetch` is replaced by something that throws, so any code path reaching for a
// network fails the test rather than passing quietly. Criteria A11 and A12.

import { test } from "node:test";
import assert from "node:assert/strict";

import { SolvencyTier, deriveNullifier, sessionId, type SessionRequest } from "@knowni/core";
import { sha256Hash } from "@knowni/core/node";
import { issueClaimSet } from "@knowni/sources";
import {
  acceptAnswer,
  attestResults,
  attestRoot,
  createMemoryNullifierLedger,
  createMemoryRegistry,
  generateIssuerKeypair,
  signRequest,
  verifyCredential,
  type AttestedAnswer,
  type RevocationOracle,
} from "@knowni/attestation";
import { nodeSignatures } from "@knowni/attestation/node";
import { createMemoryAnchor, createStellarMemoAnchor } from "@knowni/anchoring";

const h = sha256Hash;
const NOW = 1_760_000_000;
const ISSUER = "co-operador-demo";
const NOTARY = "notaria-17";
const ROOT_AGE = 86_400;

// Anything that tries to reach the network during this file fails loudly.
function withoutNetwork<T>(run: () => T): T {
  const saved = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("airplane mode: no network available");
  }) as unknown as typeof fetch;
  try {
    return run();
  } finally {
    globalThis.fetch = saved;
  }
}

const request: SessionRequest = {
  relyingPartyId: NOTARY,
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

// Issued before the phone lost signal; everything after this point is offline.
function issuedBeforehand() {
  const issuer = generateIssuerKeypair(nodeSignatures);
  const counterparty = generateIssuerKeypair(nodeSignatures);
  const set = issueClaimSet(h, {
    issuerId: ISSUER,
    claims: [
      {
        kind: "capacity",
        jurisdiction: "CO",
        subjectRef: { hex: "a".repeat(64) },
        restricted: false,
        basis: "insolvency_proceeding",
        attestedAt: NOW - 300,
      },
    ],
    issuedAt: NOW - 120,
    padTo: 64,
  });
  return {
    issuer,
    counterparty,
    registry: createMemoryRegistry({
      [ISSUER]: issuer.publicKey,
      [NOTARY]: counterparty.publicKey,
    }),
    credential: {
      ...set.credentials[0]!,
      attestation: attestRoot(nodeSignatures, issuer.privateKeySeed, {
        issuerId: set.issuerId,
        root: set.root,
        issuedAt: set.issuedAt,
        size: set.size,
      }),
    },
  };
}

test("the wallet verifies its own credential with no network at all", () => {
  const { credential, registry } = issuedBeforehand();
  const result = withoutNetwork(() =>
    verifyCredential(h, credential, { signatures: nodeSignatures, registry, nowUnix: NOW, maxRootAgeSeconds: ROOT_AGE }),
  );
  assert.deepEqual(result, { status: "valid" });
});

test("a signed request is read and answered offline, and the counterparty accepts offline", () => {
  const { issuer, counterparty, registry } = issuedBeforehand();
  const outcome = withoutNetwork(() => {
    const signed = signRequest(nodeSignatures, counterparty.privateKeySeed, request);
    const results = attestResults(h, nodeSignatures, issuer.privateKeySeed, {
      issuerId: ISSUER,
      request: signed.request,
      answers,
      issuedAt: NOW - 30,
      expiresAt: NOW + 300,
    });
    const session = attestedSession(signed.request);
    const live: RevocationOracle = { stateOf: () => ({ status: "live", checkedAt: NOW - 60 }) };
    return acceptAnswer(h, {
      signatures: nodeSignatures,
      signedRequest: signed,
      audience: NOTARY,
      disclosure: session.disclosure,
      results,
      presentationId: "pres-offline-1",
      registry,
      ledger: createMemoryNullifierLedger(),
      revocation: live,
      policy: { maxSnapshotAgeSeconds: 3_600, onUnknown: "refuse" },
      nowUnix: NOW,
      issuerRoot: "f".repeat(64),
      requiredPredicates: ["personhood", "capacity"],
    });
  });
  assert.deepEqual(outcome, { status: "accepted", idempotent: false, notes: [] });
});

test("the chain being unreachable degrades the anchor and changes nothing else", async () => {
  const unreachable = {
    async sendMemoHash(): Promise<{ hash: string }> {
      throw new Error("horizon unreachable");
    },
  };
  const anchor = createStellarMemoAnchor(unreachable, { chain: "stellar:testnet" });
  const result = await anchor.anchor({ commitment: { hex: "ab".repeat(32) } });
  assert.equal(result.status, "degraded");
  // And the same commitment still anchors where a chain is not involved,
  // which is what "the chain is optional" has to mean in code.
  const memory = createMemoryAnchor();
  const local = await memory.anchor({ commitment: { hex: "ab".repeat(32) } });
  assert.equal(local.status, "anchored");
});

test("an accepted answer needed no anchor, and says so by not carrying one", () => {
  const { issuer, counterparty, registry } = issuedBeforehand();
  const signed = signRequest(nodeSignatures, counterparty.privateKeySeed, request);
  const session = attestedSession(signed.request);
  assert.equal(session.disclosure.anchor, undefined);
  const results = attestResults(h, nodeSignatures, issuer.privateKeySeed, {
    issuerId: ISSUER,
    request: signed.request,
    answers,
    issuedAt: NOW - 30,
    expiresAt: NOW + 300,
  });
  const outcome = withoutNetwork(() =>
    acceptAnswer(h, {
      signatures: nodeSignatures,
      signedRequest: signed,
      audience: NOTARY,
      disclosure: session.disclosure,
      results,
      presentationId: "pres-offline-2",
      registry,
      ledger: createMemoryNullifierLedger(),
      revocation: { stateOf: () => ({ status: "live", checkedAt: NOW - 30 }) },
      policy: { maxSnapshotAgeSeconds: 3_600, onUnknown: "refuse" },
      nowUnix: NOW,
      issuerRoot: "f".repeat(64),
    }),
  );
  assert.equal(outcome.status, "accepted");
});

function attestedSession(sessionRequest: SessionRequest) {
  const session = sessionId(h, sessionRequest);
  return {
    disclosure: {
      sessionId: session,
      relyingPartyId: sessionRequest.relyingPartyId,
      purpose: sessionRequest.purpose,
      decidedAt: NOW,
      personhood: true as const,
      solvency: SolvencyTier.STRONG,
      formality: true as const,
      standing: true as const,
      issuerRoots: ["f".repeat(64)],
      nullifier: deriveNullifier(h, { hex: "9".repeat(64) }, session),
    },
  };
}
