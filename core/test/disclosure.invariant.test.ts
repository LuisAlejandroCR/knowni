// core/test/disclosure.invariant.test.ts
// The invariant the whole product rests on: what the relying party receives
// carries no fact about the subject beyond the answers they asked for.
//
// Written as a search over the SERIALISED envelope rather than as a check on
// its type, because the failure this guards against is someone widening the
// type — adding a "debug" field, spreading the claim in for convenience —
// and a structural assertion would be updated along with it. A landlord's
// system serialises this envelope to store it; so does this test.

import { test } from "node:test";
import assert from "node:assert/strict";

import { sha256Hash } from "../src/hash.ts";
import { outcomeOf, meetsAll } from "../src/disclosure.ts";
import { SolvencyTier } from "../src/predicates.ts";
import { verify, type HeldClaims, type VerificationRequest } from "../src/verify.ts";
import { DAY, LIST_ROOT, NOW, SUBJECT_REF, formality, identity, income, standing } from "./support/fixtures.ts";

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
    acceptedBases: ["social_security"],
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
  assert.equal(meetsAll(d, SolvencyTier.COMFORTABLE), true);
});

// The three fields that are hash outputs by construction. They are excluded
// from the substring search below and checked separately, because a 64-char
// digest will contain a short needle like "11" by chance — which would make
// the search flaky rather than strict. Their opacity is asserted by shape.
const DIGEST_FIELDS = ["sessionId", "nullifier", "issuerRoots"] as const;

test("every disclosed digest is a digest, with nothing hiding in it", () => {
  const d = disclose();
  const hex64 = /^[0-9a-f]{64}$/;
  assert.match(d.sessionId, hex64);
  assert.match(d.nullifier, hex64);
  for (const root of d.issuerRoots) assert.match(root, hex64);
});

test("the envelope carries exactly the fields it is allowed to carry", () => {
  // A substring search cannot catch a leak someone deliberately widens the
  // type for. This can: a new field fails here before it can ever be
  // populated with something revealing.
  assert.deepEqual(Object.keys(disclose()).sort(), [
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
  const d = disclose(withoutSolvency as VerificationRequest);
  assert.equal(d.solvency, "unavailable");
});

test("unavailable is not folded into a negative outcome for the relying party", () => {
  // But it IS a negative for what gets committed: a commitment is a claim
  // about what was proven, and nothing was.
  const d = disclose(request, { ...held, standing: undefined });
  assert.equal(d.standing, "unavailable");
  assert.notEqual(d.standing, false);
  assert.equal(outcomeOf(d).standing, false);
  assert.equal(meetsAll(d, SolvencyTier.BASIC), false);
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
      claim: { ...income, subjectRef: { hex: "f".repeat(64) } },
      issuerRoot: INCOME_ROOT,
    },
  };
  const result = verify(h, request, mixed, NOW);
  assert.equal(result.status, "refused");
  assert.equal(result.status === "refused" ? result.reason : undefined, "subject_mismatch");
});
