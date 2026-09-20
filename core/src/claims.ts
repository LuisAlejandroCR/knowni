// core/src/claims.ts
// What a source is willing to swear to, and nothing more.
//
// Every field here is chosen against one test: could a Colombian source
// actually produce it today, and is it the smallest fact that still answers
// the counterparty's question? A claim never carries a name, an address, a
// document image or an account number — not because those are unavailable,
// but because a field that is never collected is a field that can never
// leak. See docs/PREDICATES.md for the disclosure table per predicate.

// Which kind of document the subject's identifier came from. The number
// itself is never in a claim — only a salted hash of it (see subjectRef).
export type DocumentKind = "CC" | "CE" | "PA" | "NIT" | "PEP" | "OTHER";

// ISO 3166-1 alpha-2. Present so a predicate can say "this claim was made
// under Colombian rules" without the verifier learning anything else, and
// so the same predicate catalogue serves the next country unchanged.
export type Jurisdiction = string;

// A stable, salted reference to a person that is NOT their document number.
// The salt is issued once per subject and never leaves their device, so the
// same cédula produces a different ref for every relying party and the refs
// cannot be joined across landlords to rebuild a rental history.
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

// Predicate B — solvency. The monthly figure a source computed, in minor
// units of `currency`, so no floating point ever touches a commitment.
//
// `basis` matters legally, not just technically: an IBC read off social
// security contributions (PILA) is a different assertion from a credit
// bureau's modelled income, and a landlord in a dispute needs to know which
// one backed the tier they accepted.
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

// Predicate C — formality. How recent and how continuous the subject's
// social-security contributions are. This is the question "certificación
// laboral" is really asking, and PILA answers it without an employer
// letter.
//
// `lastContributionMonth` is YYYYMM as an integer: comparable, orderable,
// and carrying no day-level precision that could help re-identify someone.
export interface FormalityClaim {
  readonly kind: "formality";
  readonly jurisdiction: Jurisdiction;
  readonly subjectRef: SubjectRef;
  readonly lastContributionMonth: number; // YYYYMM
  readonly monthsContributedLast12: number; // 0..12
  readonly attestedAt: number;
}

// Predicate D — standing. Whether the subject appears on any restrictive
// list the relying party cares about (OFAC, UN, Procuraduría, Contraloría,
// Policía). `listSetRoot` names WHICH published snapshot was searched, so
// "clean" is never an unfalsifiable claim: an auditor can re-run the same
// search against the same root.
export interface StandingClaim {
  readonly kind: "standing";
  readonly jurisdiction: Jurisdiction;
  readonly subjectRef: SubjectRef;
  readonly listed: boolean;
  readonly listSetRoot: string; // hex root of the snapshot that was searched
  readonly attestedAt: number;
}


// Predicate E — capacity. "No legal restriction relevant to signing this
// act is on record." Colombia's SICAAC answers the insolvency half of that
// question, and it is the half a notary asks about in a conveyance.
//
// `restricted` is the answer, and `basis` says which register produced it —
// because "no insolvency proceeding" is a narrower statement than "has
// capacity", and a counterparty is entitled to know which one they got.
export type CapacityBasis = "insolvency_proceeding" | "interdiction" | "corporate_status";

export interface CapacityClaim {
  readonly kind: "capacity";
  readonly jurisdiction: Jurisdiction;
  readonly subjectRef: SubjectRef;
  readonly restricted: boolean; // true = a restriction IS on record
  readonly basis: CapacityBasis;
  readonly attestedAt: number;
}

// Predicate F — assetStanding. The only claim in this file that is not
// about a person: it is about the thing being sold.
//
// `subjectRef` here is the salted reference of the ASSET — the plate, not
// the owner — which is what keeps a vehicle check from becoming a way to
// look up who owns it. Ownership is a separate question and a separate
// claim; this one says the asset exists and is unencumbered.
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
