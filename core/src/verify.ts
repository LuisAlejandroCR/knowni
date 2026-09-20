// core/src/verify.ts
// The one function that turns held claims into the envelope a relying party
// receives. It is the narrow waist of the whole system: above it sit the
// sources that produce claims, below it the chains that anchor outcomes, and
// nothing crosses without passing through here.
//
// It is pure and synchronous. Everything that could fail, wait or cost money
// — fetching a claim, generating a proof, writing an anchor — happens on
// either side of it, which is what lets the disclosure invariant be tested
// as a property of a function rather than of a running system.

import type { Claim, FormalityClaim, IdentityClaim, IncomeClaim, StandingClaim } from "./claims.ts";
import type { Disclosure, PredicateResult } from "./disclosure.ts";
import type { FieldHash } from "./hash.ts";
import { SolvencyTier, proveFormality, provePersonhood, proveSolvency, proveStanding } from "./predicates.ts";
import type { FormalityParams, PersonhoodParams, SolvencyParams, StandingParams } from "./predicates.ts";
import { deriveNullifier, isExpired, sessionId, type SessionRequest, type SubjectSecret } from "./session.ts";

// What the relying party asked. Every field is public — the subject reads
// this before deciding to answer, and a question they cannot read is a
// question they cannot refuse.
export interface VerificationRequest {
  readonly session: SessionRequest;
  readonly personhood?: Omit<PersonhoodParams, "expectedSubjectRef">;
  readonly solvency?: Omit<SolvencyParams, "expectedSubjectRef">;
  readonly formality?: Omit<FormalityParams, "expectedSubjectRef">;
  readonly standing?: Omit<StandingParams, "expectedSubjectRef">;
}

// What the subject holds. A missing claim is not a failure — it produces
// `unavailable`, and the relying party decides what to do about it.
export interface HeldClaims {
  readonly subjectRef: string;
  readonly secret: SubjectSecret;
  readonly identity?: { readonly claim: IdentityClaim; readonly issuerRoot: string };
  readonly income?: { readonly claim: IncomeClaim; readonly issuerRoot: string };
  readonly formality?: { readonly claim: FormalityClaim; readonly issuerRoot: string };
  readonly standing?: { readonly claim: StandingClaim; readonly issuerRoot: string };
}

// An expired session is refused outright rather than answered negatively:
// the subject did not fail anything, the window closed.
export type VerificationResult =
  | { readonly status: "disclosed"; readonly disclosure: Disclosure }
  | { readonly status: "refused"; readonly reason: "session_expired" | "subject_mismatch" };

export function verify(
  h: FieldHash,
  request: VerificationRequest,
  held: HeldClaims,
  nowUnix: number,
): VerificationResult {
  if (isExpired(request.session, nowUnix)) {
    return { status: "refused", reason: "session_expired" };
  }

  // Every claim must be about the same subject. A bundle that mixes two
  // people is not a partial answer to be scored — it is malformed, and
  // answering it at all would let a solvent guarantor's income ride along
  // with someone else's identity.
  const claims: (Claim | undefined)[] = [
    held.identity?.claim,
    held.income?.claim,
    held.formality?.claim,
    held.standing?.claim,
  ];
  for (const claim of claims) {
    if (claim !== undefined && claim.subjectRef.hex !== held.subjectRef) {
      return { status: "refused", reason: "subject_mismatch" };
    }
  }

  const ref = held.subjectRef;

  const personhood: PredicateResult =
    request.personhood === undefined || held.identity === undefined
      ? "unavailable"
      : provePersonhood(held.identity.claim, { ...request.personhood, expectedSubjectRef: ref });

  const solvency: SolvencyTier | "unavailable" =
    request.solvency === undefined || held.income === undefined
      ? "unavailable"
      : proveSolvency(held.income.claim, { ...request.solvency, expectedSubjectRef: ref });

  const formality: PredicateResult =
    request.formality === undefined || held.formality === undefined
      ? "unavailable"
      : proveFormality(held.formality.claim, { ...request.formality, expectedSubjectRef: ref });

  const standing: PredicateResult =
    request.standing === undefined || held.standing === undefined
      ? "unavailable"
      : proveStanding(held.standing.claim, { ...request.standing, expectedSubjectRef: ref });

  const id = sessionId(h, request.session);

  // Only the roots that actually backed an answer. Listing a root for a
  // predicate that came back `unavailable` would tell the relying party
  // which issuers the subject is enrolled with — a fact about them that no
  // predicate disclosed.
  const issuerRoots = [
    personhood !== "unavailable" ? held.identity?.issuerRoot : undefined,
    solvency !== "unavailable" ? held.income?.issuerRoot : undefined,
    formality !== "unavailable" ? held.formality?.issuerRoot : undefined,
    standing !== "unavailable" ? held.standing?.issuerRoot : undefined,
  ].filter((root): root is string => root !== undefined);

  return {
    status: "disclosed",
    disclosure: {
      sessionId: id,
      relyingPartyId: request.session.relyingPartyId,
      purpose: request.session.purpose,
      decidedAt: nowUnix,
      personhood,
      solvency,
      formality,
      standing,
      issuerRoots: [...new Set(issuerRoots)],
      nullifier: deriveNullifier(h, held.secret, id),
    },
  };
}
