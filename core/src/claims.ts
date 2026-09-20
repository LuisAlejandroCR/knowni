// claims.ts: what a source is willing to swear to, and nothing more.
// One interface per predicate, carrying the smallest fact that answers it —
// never a name, a document number, an address or an image.

// Which kind of document the subject's identifier came from. The number
// itself is never in a claim — only a salted hash of it (see subjectRef).
export type DocumentKind = "CC" | "CE" | "PA" | "NIT" | "PEP" | "OTHER";

export type Jurisdiction = string;

export interface SubjectRef {
  readonly hex: string; // FieldHash output over (documentKind, documentNumber, salt)
}

// Predicate A — personhood. "This document exists, is current, and belongs
// to a living adult." What a Registraduría-backed source can attest.
export interface IdentityClaim {
  readonly kind: "identity";
  readonly jurisdiction: Jurisdiction;
  readonly documentKind: DocumentKind;
  readonly subjectRef: SubjectRef;
  readonly documentValid: boolean; // vigente: not cancelled, not reported lost
  readonly subjectAlive: boolean; // not in the registry of deceased
  readonly ofAge: boolean; // >= 18 — the date of birth itself never appears
  readonly attestedAt: number; // unix seconds
}

export type IncomeBasis = "social_security" | "credit_bureau" | "payroll" | "declared";

export interface IncomeClaim {
  readonly kind: "income";
  readonly jurisdiction: Jurisdiction;
  readonly subjectRef: SubjectRef;
  readonly monthlyMinor: number; // e.g. COP cents
  readonly currency: string; // ISO 4217
  readonly basis: IncomeBasis;
  readonly attestedAt: number;
}

export interface FormalityClaim {
  readonly kind: "formality";
  readonly jurisdiction: Jurisdiction;
  readonly subjectRef: SubjectRef;
  readonly lastContributionMonth: number; // YYYYMM
  readonly monthsContributedLast12: number; // 0..12
  readonly attestedAt: number;
}

export interface StandingClaim {
  readonly kind: "standing";
  readonly jurisdiction: Jurisdiction;
  readonly subjectRef: SubjectRef;
  readonly listed: boolean;
  readonly listSetRoot: string; // hex root of the snapshot that was searched
  readonly attestedAt: number;
}

export type CapacityBasis = "insolvency_proceeding" | "interdiction" | "corporate_status";

export interface CapacityClaim {
  readonly kind: "capacity";
  readonly jurisdiction: Jurisdiction;
  readonly subjectRef: SubjectRef;
  readonly restricted: boolean; // true = a restriction IS on record
  readonly basis: CapacityBasis;
  readonly attestedAt: number;
}

export interface AssetStandingClaim {
  readonly kind: "assetStanding";
  readonly jurisdiction: Jurisdiction;
  readonly subjectRef: SubjectRef; // salted ref of the asset identifier
  readonly registered: boolean; // present in the asset registry
  readonly encumbered: boolean; // pledge, lien or ownership limitation on record
  readonly finesOutstanding: boolean; // unpaid infractions attached to it
  readonly attestedAt: number;
}

export type Claim =
  | IdentityClaim
  | IncomeClaim
  | FormalityClaim
  | StandingClaim
  | CapacityClaim
  | AssetStandingClaim;
export type ClaimKind = Claim["kind"];
