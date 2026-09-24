// verify.ts: turns held claims into the envelope a relying party receives.
// Pure and synchronous — fetching, proving and anchoring all happen outside it,
// which is what makes the disclosure invariant testable as a property.

import type {
  AssetStandingClaim,
  CapacityClaim,
  Claim,
  FormalityClaim,
  IdentityClaim,
  IncomeClaim,
  StandingClaim,
} from "./claims.ts";
import type { Disclosure, PredicateResult } from "./disclosure.ts";
import type { FieldHash } from "./hash.ts";
import {
  SolvencyTier,
  proveAssetStanding,
  proveCapacity,
  proveFormality,
  provePersonhood,
  proveSolvency,
  proveStanding,
} from "./predicates.ts";
import type {
  AssetStandingParams,
  CapacityParams,
  FormalityParams,
  PersonhoodParams,
  SolvencyParams,
  StandingParams,
} from "./predicates.ts";
import { deriveNullifier, isExpired, isPurpose, sessionId, type SessionRequest, type SubjectSecret } from "./session.ts";

export interface VerificationRequest {
  readonly session: SessionRequest;
  readonly personhood?: Omit<PersonhoodParams, "expectedSubjectRef">;
  readonly solvency?: Omit<SolvencyParams, "expectedSubjectRef">;
  readonly formality?: Omit<FormalityParams, "expectedSubjectRef">;
  readonly standing?: Omit<StandingParams, "expectedSubjectRef">;
  readonly capacity?: Omit<CapacityParams, "expectedSubjectRef">;
  // The asset's own reference travels with the request, not with the subject:
  // a car is not a person and must not be matched against one.
  readonly assetStanding?: AssetStandingParams;
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
  readonly capacity?: { readonly claim: CapacityClaim; readonly issuerRoot: string };
  // Held by the subject, but about the asset, so it is not checked against
  // `subjectRef` — `proveAssetStanding` matches it against the asset the
  // relying party named.
  readonly asset?: { readonly claim: AssetStandingClaim; readonly issuerRoot: string };
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
    held.capacity?.claim,
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

  const capacity: PredicateResult =
    request.capacity === undefined || held.capacity === undefined
      ? "unavailable"
      : proveCapacity(held.capacity.claim, { ...request.capacity, expectedSubjectRef: ref });

  const assetStanding: PredicateResult =
    request.assetStanding === undefined || held.asset === undefined
      ? "unavailable"
      : proveAssetStanding(held.asset.claim, request.assetStanding);

  const id = sessionId(h, request.session);

  const issuerRoots = [
    personhood !== "unavailable" ? held.identity?.issuerRoot : undefined,
    solvency !== "unavailable" ? held.income?.issuerRoot : undefined,
    formality !== "unavailable" ? held.formality?.issuerRoot : undefined,
    standing !== "unavailable" ? held.standing?.issuerRoot : undefined,
    capacity !== "unavailable" ? held.capacity?.issuerRoot : undefined,
    assetStanding !== "unavailable" ? held.asset?.issuerRoot : undefined,
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
      capacity,
      assetStanding,
      issuerRoots: [...new Set(issuerRoots)],
      nullifier: deriveNullifier(h, held.secret, id),
    },
  };
}
