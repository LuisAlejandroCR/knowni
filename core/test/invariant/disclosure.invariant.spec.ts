// disclosure.invariant.spec.ts: The invariant the whole product rests on: what the relying
// party receives carries no fact about the subject beyond the answers they asked for.

import { test } from "node:test";
import assert from "node:assert/strict";

import { sha256Hash } from "../../src/node.ts";
import { outcomeOf, meetsProfile, type VerificationProfile } from "../../src/disclosure.ts";
import { SolvencyTier } from "../../src/predicates.ts";
import { verify, type HeldClaims, type VerificationRequest } from "../../src/verify.ts";
import { DAY, LIST_ROOT, NOW, SUBJECT_REF, formality, identity, income, standing } from "../support/fixtures.ts";

// The lease profile, composed here because composing it is the caller's job.
const LEASE = (atLeast: SolvencyTier): VerificationProfile => [
  { answer: "personhood", mustBe: true },
  { answer: "formality", mustBe: true },
  { answer: "standing", mustBe: true },
  { answer: "solvency", atLeast },
];

const h = sha256Hash;
const IDENTITY_ROOT = "1".repeat(64);
const INCOME_ROOT = "2".repeat(64);

const request: VerificationRequest = {
  session: {
    relyingPartyId: "agencia-inmobiliaria-bogota",
    purpose: "lease",
    nonce: "ab".repeat(16),
    expiresAt: NOW + 600,
    paramsHash: "cd".repeat(32),
  },
  personhood: { jurisdiction: "CO", nowUnix: NOW, maxAgeSeconds: 30 * DAY },
  solvency: {
    monthlyObligationMinor: 150_000_000,
    currency: "COP",
    nowUnix: NOW,
    maxAgeSeconds: 30 * DAY,
    acceptedBases: ["contribution_base"],
    acceptedProvenance: ["observed"],
  minPeriodsObserved: 6,
  },
  formality: {
    nowMonth: 202_509,
    maxMonthsSinceLastContribution: 2,
    minMonthsContributedLast12: 6,
  },
  standing: { acceptedListSetRoot: LIST_ROOT, nowUnix: NOW, maxAgeSeconds: 7 * DAY },
};

const held: HeldClaims = {
  subjectRef: SUBJECT_REF,
  secret: { hex: "9".repeat(64) },
  identity: { claim: identity, issuerRoot: IDENTITY_ROOT },
  income: { claim: income, issuerRoot: INCOME_ROOT },
  formality: { claim: formality, issuerRoot: IDENTITY_ROOT },
  standing: { claim: standing, issuerRoot: IDENTITY_ROOT },
};

function disclose(r = request, hc = held) {
  const result = verify(h, r, hc, NOW);
  assert.equal(result.status, "disclosed");
  return result.status === "disclosed" ? result.disclosure : undefined!;
}

test("a full verification answers every predicate", () => {
  const d = disclose();
  assert.equal(d.personhood, true);
  assert.equal(d.solvency, SolvencyTier.STRONG);
  assert.equal(d.formality, true);
  assert.equal(d.standing, true);
  assert.deepEqual(meetsProfile(d, LEASE(SolvencyTier.COMFORTABLE)), { status: "meets" });
});

const DIGEST_FIELDS = ["sessionId", "nullifier", "issuerRoots"] as const;

test("every disclosed digest is a digest, with nothing hiding in it", () => {
  const d = disclose();
  const hex64 = /^[0-9a-f]{64}$/;
  assert.match(d.sessionId, hex64);
  assert.match(d.nullifier, hex64);
  for (const root of d.issuerRoots) assert.match(root, hex64);
});

test("the envelope carries exactly the fields it is allowed to carry", () => {
  assert.deepEqual(Object.keys(disclose()).sort(), [
    "assetStanding",
    "capacity",
    "decidedAt",
    "formality",
    "issuerRoots",
    "nullifier",
    "personhood",
    "purpose",
    "relyingPartyId",
    "sessionId",
    "solvency",
    "standing",
  ]);
});

test("the envelope leaks no value from the claims that produced it", () => {
  const d = disclose();
  const searchable = { ...d } as Record<string, unknown>;
  for (const field of DIGEST_FIELDS) delete searchable[field];
  const serialised = JSON.stringify(searchable);

  // The income figure, in every shape a careless implementation might emit.
  const forbidden = [
    String(income.monthlyMinor), // 481230000
    "4812300",
    "4812300.00",
    income.currency,
    income.basis,
    identity.documentKind,
    identity.jurisdiction,
    String(formality.lastContributionMonth),
    String(identity.attestedAt),
    SUBJECT_REF,
    held.secret.hex,
    standing.listSetRoot,
  ];

  for (const needle of forbidden) {
    assert.equal(
      serialised.includes(needle),
      false,
      `disclosure leaked ${JSON.stringify(needle)}: ${serialised}`,
    );
  }
});

test("the subject reference never becomes the nullifier", () => {
  // If it did, two relying parties could join their records on it.
  const d = disclose();
  assert.notEqual(d.nullifier, SUBJECT_REF);
  assert.equal(d.nullifier.includes(SUBJECT_REF), false);
});

test("an unanswered predicate does not reveal which issuers the subject uses", () => {
  // Income withheld: the income issuer's root must not appear either, or the
  // relying party learns the subject is enrolled with a payroll provider.
  const withoutIncome: HeldClaims = { ...held, income: undefined };
  const d = disclose(request, withoutIncome);
  assert.equal(d.solvency, "unavailable");
  assert.equal(d.issuerRoots.includes(INCOME_ROOT), false);
  assert.equal(d.issuerRoots.includes(IDENTITY_ROOT), true);
});

test("a predicate that was not asked is not answered", () => {
  const { solvency: _dropped, ...withoutSolvency } = request;
  const d = disclose(withoutSolvency);
  assert.equal(d.solvency, "unavailable");
});

test("unavailable is not folded into a negative outcome for the relying party", () => {
  // But it IS a negative for what gets committed: a commitment is a claim
  // about what was proven, and nothing was.
  const d = disclose(request, { ...held, standing: undefined });
  assert.equal(d.standing, "unavailable");
  assert.notEqual(d.standing, false);
  assert.equal(outcomeOf(d).standing, false);
  assert.deepEqual(meetsProfile(d, LEASE(SolvencyTier.BASIC)), {
    status: "short",
    missing: [{ answer: "standing", reason: "unavailable" }],
  });
});

test("an expired session is refused, not answered negatively", () => {
  const result = verify(h, request, held, request.session.expiresAt + 1);
  assert.equal(result.status, "refused");
  assert.equal(result.status === "refused" ? result.reason : undefined, "session_expired");
});

test("a bundle mixing two subjects is refused rather than partly scored", () => {
  const mixed: HeldClaims = {
    ...held,
    income: {
      claim: { ...income, subjectRef: { hex: "0f".repeat(32) } },
      issuerRoot: INCOME_ROOT,
    },
  };
  const result = verify(h, request, mixed, NOW);
  assert.equal(result.status, "refused");
  assert.equal(result.status === "refused" ? result.reason : undefined, "subject_mismatch");
});

test("a malformed purpose is refused, not thrown", () => {
  // The purpose is caller-supplied and reaches a hash. A throw here would
  // take the whole verification down over a field the relying party typed.
  const result = verify(h, { ...request, session: { ...request.session, purpose: "Vehicle Sale" } }, held, NOW);
  assert.equal(result.status, "refused");
  assert.equal(result.status === "refused" ? result.reason : undefined, "invalid_purpose");
});

test("the same claims answer any contract type", () => {
  // The contract is an application of the product, not a branch in it: the
  // held credentials do not change when the purpose does.
  for (const purpose of ["lease", "vehicle-sale", "guarantee"]) {
    const result = verify(h, { ...request, session: { ...request.session, purpose } }, held, NOW);
    assert.equal(result.status, "disclosed");
    const d = result.status === "disclosed" ? result.disclosure : undefined!;
    assert.equal(d.purpose, purpose);
    assert.deepEqual(meetsProfile(d, LEASE(SolvencyTier.COMFORTABLE)), { status: "meets" });
  }
});
