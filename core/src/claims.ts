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

// Three different facts that a single "income" would quietly merge:
//
//   contribution_base  what was declared as the base for social-security
//                      contributions. A floor, and a declaration — not what
//                      anyone was paid and not what they have.
//   verified_income    what an employer or a tax document says was paid.
//   cashflow           what actually arrived in a consented account.
//
// They answer different questions and they are wrong in different directions,
// so each one is its own basis and a relying party names which it accepts.
export type IncomeBasis = "contribution_base" | "verified_income" | "cashflow";

// How the figure was learned, which is a different question from what it
// measures. The same basis reaches us by different routes — a contribution
// base read from an operator's records is observed; the same base read off a
// statement the holder handed us is documentary — and a relying party that
// cannot tell them apart is trusting whichever is weakest.
//
//   observed       a source this system queried answered with it
//   documentary    a document was produced, and a human read it
//   self_declared  the subject said so, and nobody checked
export type IncomeProvenance = "observed" | "documentary" | "self_declared";

// What each basis does NOT say, travelling with the claim so a counterparty
// cannot widen it by reading it generously.
export const BASIS_DOES_NOT_ESTIMATE: Record<IncomeBasis, string> = {
  contribution_base:
    "Base declarada para aportes. No estima ingreso neto, liquidez ni probabilidad de pago.",
  verified_income:
    "Pago laboral o tributario observado. No prueba liquidez actual ni continuidad.",
  cashflow: "Entradas observadas en una cuenta consentida. No prueba empleo ni aportes.",
};

export interface IncomeClaim {
  readonly kind: "income";
  readonly jurisdiction: Jurisdiction;
  readonly subjectRef: SubjectRef;
  readonly monthlyMinor: number; // e.g. COP cents
  readonly currency: string; // ISO 4217
  readonly basis: IncomeBasis;
  readonly provenance: IncomeProvenance;
  // How many periods had data, and over how many the source looked: "one good
  // month" and "a year of them" stop looking identical. How many are enough is
  // the relying party's threshold, not the source's.
  readonly periodsObserved: number;
  readonly periodsWindow: number;
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

export interface SanctionsClaim {
  readonly kind: "sanctions";
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
  | SanctionsClaim
  | CapacityClaim
  | AssetStandingClaim;
export type ClaimKind = Claim["kind"];
