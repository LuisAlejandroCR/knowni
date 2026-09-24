// index.ts: The public surface of @knowni/core: claims, predicates, the commitment and Merkle
// machinery, session binding, and the disclosure envelope.

export type {
  AssetStandingClaim,
  CapacityBasis,
  CapacityClaim,
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

export type { Digest, FieldHash } from "./hash.ts";
export { createFieldHash } from "./hash.ts";
export {
  concatBytes,
  equalBytes,
  fromHex,
  lengthPrefixed,
  toHex,
  u32be,
  u64be,
  utf8,
} from "./bytes.ts";
export type { RandomSource } from "./random.ts";
export { randomBytes, setRandomSource } from "./random.ts";

export {
  SolvencyTier,
  monthsBetween,
  proveAssetStanding,
  proveCapacity,
  proveFormality,
  provePersonhood,
  proveSolvency,
  proveStanding,
} from "./predicates.ts";
export type {
  AssetStandingParams,
  CapacityParams,
  FormalityParams,
  PersonhoodParams,
  SolvencyParams,
  StandingParams,
} from "./predicates.ts";

export type { MerkleProof, MerkleTree } from "./merkle.ts";
export { buildMerkleTree, constantTimeEqualHex, hashLeaf, verifyInclusion } from "./merkle.ts";

export type { Blinding, BlindedCommitment, Outcome, Salt } from "./commitment.ts";
export { commitClaim, commitOutcome, randomSalt, verifyOutcomeCommitment } from "./commitment.ts";
export { CLAIM_WIDTH, KIND_TAG, encodeClaimFields } from "./claim-fields.ts";
export { DOMAINS, type DomainName } from "./domains.ts";
export {
  BLS12_381_PRIME,
  BN254_PRIME,
  CIRCOMLIB_PARTIAL_ROUNDS,
  circomlibSpec,
  parameters,
  roundConstants,
  type GrainSpec,
  type PoseidonParameters,
} from "./poseidon-params.ts";
export { poseidon } from "./poseidon.ts";
export { createPoseidonHasher, type FieldHasher } from "./field-hasher.ts";
export {
  NotInFieldError,
  fieldFromBoolean,
  fieldFromHex,
  fieldFromString,
  fieldFromUint,
  randomFieldElement,
} from "./field.ts";

export type { Purpose, SessionRequest, SubjectSecret } from "./session.ts";
export { deriveNullifier, isExpired, isPurpose, sessionId } from "./session.ts";

export type { Disclosure, PredicateResult } from "./disclosure.ts";
export { meetsAll, outcomeOf } from "./disclosure.ts";

export type { HeldClaims, VerificationRequest, VerificationResult } from "./verify.ts";
export { verify } from "./verify.ts";
