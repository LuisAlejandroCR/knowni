// journey.spec.ts: The whole thing, end to end, with no network and no mocks: a Colombian
// tenant applies for a lease, and the agency learns four answers.

import { test } from "node:test";
import assert from "node:assert/strict";

import { SolvencyTier, commitOutcome, meetsProfile, outcomeOf, verify, verifyInclusion, verifyOutcomeCommitment, type HeldClaims, type VerificationProfile, type VerificationRequest } from "@knowni/core";
import { poseidonHash, sha256Hash } from "@knowni/core/node";
import {
  createPilaFormalitySource,
  createPilaIncomeSource,
  createSanctionsSource,
  createSyntheticPilaClient,
  createSyntheticRegistraduriaSource,
  createSyntheticSanctionsClient,
  issueClaimSet,
  listSetRoot,
  SYNTHETIC_LIST_STAMPS,
  type SyntheticSubject,
} from "@knowni/sources";
import { createMemoryAnchor, createStellarMemoAnchor, createAnchorRegistry } from "@knowni/anchoring";

const h = sha256Hash;
/// El camino reclamo/Merkle hashea en elementos; el resto sigue en bytes.
const fh = poseidonHash;
const NOW = 1_760_000_000; // 2025-10-09
const NOW_MONTH = 202_510;
const DAY = 86_400;

// A tenant who contributes to social security on about COP 4,200,000 a
// month and is on no restrictive list.
const ANA: SyntheticSubject = {
  documentNumber: "1020304050",
  name: "Ana María Rodríguez Peña",
  documentValid: true,
  subjectAlive: true,
  ofAge: true,
  contributions: Array.from({ length: 11 }, (_, i) => ({
    month: 202_411 + (i < 2 ? i : i + 88), // Nov, Dec 2024 then Jan..Sep 2025
    ibcMinor: 420_000_000 + i * 1_000_000,
  })),
};

const SUBJECT = {
  documentKind: "CC",
  documentNumber: ANA.documentNumber,
  // In the product this is H(documentKind, documentNumber, per-relying-party
  // salt); pinned here so the test is deterministic.
  subjectRef: "07".repeat(32),
};

// The snapshot the three registers were read against, as the relying party
// knows it. A "clean" answer against a list nobody published is not an answer,
// so the root travels with the verdict — see proveStanding.
const snapshotRoot = listSetRoot(poseidonHash, [...SYNTHETIC_LIST_STAMPS]);

async function issueForSubject(subject = ANA) {
  const pila = createSyntheticPilaClient([subject]);

  const sources = [
    createSyntheticRegistraduriaSource([subject]),
    createPilaIncomeSource(pila),
    createPilaFormalitySource(pila),
    // The same source production runs, with Croma answering offline: the
    // registers are asked by document number, not screened by name — B3.
    createSanctionsSource(createSyntheticSanctionsClient([subject]), poseidonHash),
  ];

  const results = await Promise.all(
    sources.map((source) => source.fetch({ ...SUBJECT, documentNumber: subject.documentNumber }, NOW)),
  );
  const claims = results.flatMap((r) => (r.status === "claimed" ? [r.claim] : []));

  // One issuer, one published root. Padded to 1024 leaves so the root does
  // not tell an observer how many claims were written this round.
  const issued = issueClaimSet(fh, {
    issuerId: "co-operador-pila",
    claims,
    issuedAt: NOW,
    padTo: 1024,
  });
  return { issued, results, snapshotRoot };
}

test("a tenant proves four things and the agency learns nothing else", async () => {
  const { issued, snapshotRoot } = await issueForSubject();
  assert.equal(issued.credentials.length, 4, "all four sources answered");
  assert.equal(issued.size, 1024, "the published tree is padded");

  for (const credential of issued.credentials) {
    assert.equal(verifyInclusion(fh, credential.proof), true);
    assert.equal(credential.proof.root, issued.root);
  }

  const by = (kind: string) => issued.credentials.find((c) => c.claim.kind === kind)!;

  // Step 2 — the agency asks. Every parameter is public; the tenant reads
  // this before deciding to answer.
  const request: VerificationRequest = {
    session: {
      relyingPartyId: "inmobiliaria-chapinero",
      purpose: "lease",
      nonce: "3f".repeat(16),
      expiresAt: NOW + 900,
      paramsHash: "9c".repeat(32),
    },
    personhood: { jurisdiction: "CO", nowUnix: NOW, maxAgeSeconds: 30 * DAY },
    solvency: {
      // Rent of COP 1,300,000/month.
      monthlyObligationMinor: 130_000_000,
      currency: "COP",
      nowUnix: NOW,
      maxAgeSeconds: 30 * DAY,
      acceptedBases: ["contribution_base"],
      acceptedProvenance: ["observed"],
    minPeriodsObserved: 6,
    },
    formality: {
      nowMonth: NOW_MONTH,
      maxMonthsSinceLastContribution: 2,
      minMonthsContributedLast12: 6,
    },
    standing: { acceptedListSetRoot: snapshotRoot, nowUnix: NOW, maxAgeSeconds: 7 * DAY },
  };

  const held: HeldClaims = {
    subjectRef: SUBJECT.subjectRef,
    secret: { hex: "5e".repeat(32) },
    identity: { claim: by("identity").claim as never, issuerRoot: issued.root },
    income: { claim: by("income").claim as never, issuerRoot: issued.root },
    formality: { claim: by("formality").claim as never, issuerRoot: issued.root },
    standing: { claim: by("standing").claim as never, issuerRoot: issued.root },
  };

  // Step 3 — the tenant answers.
  const result = verify(h, request, held, NOW);
  assert.equal(result.status, "disclosed");
  const disclosure = result.status === "disclosed" ? result.disclosure : undefined!;

  assert.equal(disclosure.personhood, true);
  assert.equal(disclosure.formality, true);
  assert.equal(disclosure.standing, true);
  // COP ~4,200,000 against COP 1,300,000 of rent: comfortably over 3x.
  assert.equal(disclosure.solvency, SolvencyTier.STRONG);
  // The agency composes what its contract needs; core is not asked to know it.
  const lease: VerificationProfile = [
    { answer: "personhood", mustBe: true },
    { answer: "formality", mustBe: true },
    { answer: "standing", mustBe: true },
    { answer: "solvency", atLeast: SolvencyTier.COMFORTABLE },
  ];
  assert.deepEqual(meetsProfile(disclosure, lease), { status: "meets" });

  // Step 4 — the agency's whole record of this application.
  const record = JSON.stringify(disclosure);
  for (const leak of [
    ANA.name,
    "Ana",
    "Rodriguez",
    ANA.documentNumber,
    "420000000",
    "4200000",
    "COP",
    "contribution_base",
    "202509",
    SUBJECT.subjectRef,
  ]) {
    assert.equal(record.includes(leak), false, `the agency's record leaked ${leak}: ${record}`);
  }
});

test("the outcome anchors on any registered chain, and opens only for the tenant", async () => {
  const { issued, snapshotRoot } = await issueForSubject();
  const by = (kind: string) => issued.credentials.find((c) => c.claim.kind === kind)!;

  const request: VerificationRequest = {
    session: {
      relyingPartyId: "inmobiliaria-chapinero",
      purpose: "lease",
      nonce: "3f".repeat(16),
      expiresAt: NOW + 900,
      paramsHash: "9c".repeat(32),
    },
    personhood: { jurisdiction: "CO", nowUnix: NOW, maxAgeSeconds: 30 * DAY },
    solvency: {
      monthlyObligationMinor: 130_000_000,
      currency: "COP",
      nowUnix: NOW,
      maxAgeSeconds: 30 * DAY,
      acceptedBases: ["contribution_base"],
      acceptedProvenance: ["observed"],
    minPeriodsObserved: 6,
    },
    formality: { nowMonth: NOW_MONTH, maxMonthsSinceLastContribution: 2, minMonthsContributedLast12: 6 },
    standing: { acceptedListSetRoot: snapshotRoot, nowUnix: NOW, maxAgeSeconds: 7 * DAY },
  };

  const result = verify(
    h,
    request,
    {
      subjectRef: SUBJECT.subjectRef,
      secret: { hex: "5e".repeat(32) },
      identity: { claim: by("identity").claim as never, issuerRoot: issued.root },
      income: { claim: by("income").claim as never, issuerRoot: issued.root },
      formality: { claim: by("formality").claim as never, issuerRoot: issued.root },
      standing: { claim: by("standing").claim as never, issuerRoot: issued.root },
    },
    NOW,
  );
  assert.equal(result.status, "disclosed");
  const disclosure = result.status === "disclosed" ? result.disclosure : undefined!;

  const outcome = outcomeOf(disclosure);
  const { commitment, blinding } = commitOutcome(h, outcome);

  // The same commitment, anchored on two chains, with no branch on chain
  // name above the registry. Stellar is one adapter, not the interface.
  const registry = createAnchorRegistry();
  registry.register(createMemoryAnchor("memory"));
  registry.register(
    createStellarMemoAnchor(
      { async sendMemoHash(bytes) { assert.equal(bytes.length, 32); return { hash: "STELLAR_TX" }; } },
      { chain: "stellar:testnet" },
    ),
  );

  for (const chain of registry.chains()) {
    const anchored = await registry.get(chain)!.anchor({
      commitment: { hex: commitment },
      nullifier: { hex: disclosure.nullifier },
    });
    assert.equal(anchored.status, "anchored", `${chain} should anchor`);
    assert.equal(
      anchored.status === "anchored" && anchored.receipt.commitment.hex,
      commitment,
      "the anchor carries the commitment, not the outcome",
    );
  }

  // Later, in a dispute: the tenant opens the anchor to a court. Nobody
  // else can, because only they kept the blinding factor.
  assert.equal(verifyOutcomeCommitment(h, outcome, blinding, commitment), true);
  assert.equal(
    verifyOutcomeCommitment(h, { ...outcome, solvencyTier: 1 }, blinding, commitment),
    false,
    "the anchor does not open to a verdict that was not reached",
  );
});

test("a replay of the same proof in the same session is refused on-chain", async () => {
  const anchor = createMemoryAnchor("stellar-like");
  const commitment = { hex: "ab".repeat(32) };
  const nullifier = { hex: "cd".repeat(32) };

  assert.equal((await anchor.anchor({ commitment, nullifier })).status, "anchored");
  const replay = await anchor.anchor({ commitment, nullifier });
  assert.equal(replay.status, "degraded");
  assert.equal(replay.status === "degraded" && replay.degraded.reason, "nullifier_already_spent");
});

test("a tenant named by one register is claimed as listed, not left unanswered", async () => {
  // One register out of three is enough: `listed` is their disjunction, and a
  // clean answer from the other two does not cancel a disciplinary record.
  const flagged: SyntheticSubject = { ...ANA, listedIn: ["procuraduria"] };
  const { results } = await issueForSubject(flagged);
  const standing = results.find(
    (r) => r.status === "claimed" && r.claim.kind === "standing",
  );
  assert.ok(standing, "a decisive match still produces a claim");
  assert.equal(
    standing.status === "claimed" && standing.claim.kind === "standing"
      ? standing.claim.listed
      : undefined,
    true,
  );
});

test("an informal worker is not reported as having zero income", async () => {
  // The coverage gap, stated as a test: no PILA record degrades to
  // not_found, so a landlord cannot read absence as insolvency.
  const informal: SyntheticSubject = { ...ANA, contributions: [] };
  const { results } = await issueForSubject(informal);
  const income = results.find((r) => r.status === "degraded" && r.reason === "not_found");
  assert.ok(income, "no contributions must degrade, not claim COP 0");
});
