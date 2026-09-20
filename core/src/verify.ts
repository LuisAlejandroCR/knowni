// verify.ts: turns held claims into the envelope a relying party receives.
// Pure and synchronous — fetching, proving and anchoring all happen outside it,
// which is what makes the disclosure invariant testable as a property.

import type { Claim, FormalityClaim, IdentityClaim, IncomeClaim, StandingClaim } from "./claims.ts";
import type { Disclosure, PredicateResult } from "./disclosure.ts";
import type { FieldHash } from "./hash.ts";
import { SolvencyTier, proveFormality, provePersonhood, proveSolvency, proveStanding } from "./predicates.ts";
import type { FormalityParams, PersonhoodParams, SolvencyParams, StandingParams } from "./predicates.ts";
import { deriveNullifier, isExpired, isPurpose, sessionId, type SessionRequest, type SubjectSecret } from "./session.ts";

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
  | {
      readonly status: "refused";
      readonly reason: "session_expired" | "subject_mismatch" | "invalid_purpose";
    };

export function verify(
  h: FieldHash,
  request: VerificationRequest,
  held: HeldClaims,
  nowUnix: number,
): VerificationResult {
  if (!isPurpose(request.session.purpose)) {
    return { status: "refused", reason: "invalid_purpose" };
  }

  if (isExpired(request.session, nowUnix)) {
    return { status: "refused", reason: "session_expired" };
  }

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
