// core/src/index.ts
// The public surface of @knowni/core: claims, predicates, the commitment
// and Merkle machinery, session binding, and the disclosure envelope.
//
// Nothing in this workspace imports a chain SDK, an HTTP client or a vector
// database. That is checked, not merely intended — see
// core/test/no-vendor-imports.test.ts.

export type {
  Claim,
  ClaimKind,
  DocumentKind,
  FormalityClaim,
  IdentityClaim,
  IncomeBasis,
  IncomeClaim,
  Jurisdiction,
  StandingClaim,
  SubjectRef,
} from "./claims.ts";

export type { FieldHash } from "./hash.ts";
export { fromHex, sha256Hash, u32be, u64be, utf8 } from "./hash.ts";

export {
  SolvencyTier,
  monthsBetween,
  proveFormality,
  provePersonhood,
  proveSolvency,
  proveStanding,
} from "./predicates.ts";
export type {
  FormalityParams,
  PersonhoodParams,
  SolvencyParams,
  StandingParams,
} from "./predicates.ts";

export type { MerkleProof, MerkleTree } from "./merkle.ts";
export { buildMerkleTree, constantTimeEqualHex, hashLeaf, verifyInclusion } from "./merkle.ts";

export type { Blinding, BlindedCommitment, Outcome, Salt } from "./commitment.ts";
export { commitClaim, commitOutcome, randomSalt, verifyOutcomeCommitment } from "./commitment.ts";

export type { Purpose, SessionRequest, SubjectSecret } from "./session.ts";
export { deriveNullifier, isExpired, sessionId } from "./session.ts";

export type { Disclosure, PredicateResult } from "./disclosure.ts";
export { meetsAll, outcomeOf } from "./disclosure.ts";

export type { HeldClaims, VerificationRequest, VerificationResult } from "./verify.ts";
export { verify } from "./verify.ts";
