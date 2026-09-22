// ugpp.ts: the contribution base from a document the subject brought.
// UGPP's Estado Único de Cuenta is not an API: the holder requests it, receives
// it and hands it over. This reduces it to a claim and forgets the rest.

import type { FieldHash, IncomeClaim } from "@knowni/core";
import { utf8 } from "@knowni/core";
import type { SourcePort, SourceResult, SubjectLookup } from "../../types.ts";
import { degraded } from "../../types.ts";

// The window the document covers. Four months is what UGPP delivers, and it is
// the reason this source can never answer a twelve-month continuity question.
export const UGPP_WINDOW_MONTHS = 4;

export interface UgppPeriod {
  readonly month: number; // YYYYMM
  readonly ibcMinor: number;
}

// What a parsed Estado Único de Cuenta yields. The parsing itself belongs to
// whoever reads the PDF; this port takes the fields and nothing else, so the
// document never travels further in.
export interface UgppStatement {
  readonly periods: readonly UgppPeriod[];
  // Whatever the document publishes to be checked against the source: a
  // verification code, a CUFE-like id, a QR payload.
  readonly verificationCode: string;
  readonly issuedAtMonth: number; // YYYYMM the statement was produced
}

export interface UgppOptions {
  // Confirms the document is the one UGPP issued. Absent, the source refuses:
  // a statement nobody checked is a PDF, and a PDF is not evidence.
  readonly checkAuthenticity: (statement: UgppStatement) => Promise<boolean>;
  // How stale a statement may be, in months, before it stops being current.
  readonly maxAgeMonths?: number;
  readonly logError?: (error: unknown) => void;
}

// The documentary path: the subject provides the statement, the issuer checks
// it, reduces it and throws it away. Provenance is `documentary`, never
// `observed` — nobody queried a register here, and the claim must not pretend
// otherwise.
export function createUgppContributionSource(
  h: FieldHash,
  read: (subject: SubjectLookup) => Promise<UgppStatement | undefined>,
  options: UgppOptions,
): SourcePort {
  const maxAgeMonths = options.maxAgeMonths ?? 2;
  const logError = options.logError ?? (() => {});

  return {
    id: "co-ugpp-estado-unico-cuenta",
    jurisdiction: "CO",
    produces: "income",
    async fetch(subject: SubjectLookup, nowUnix: number): Promise<SourceResult> {
      let statement: UgppStatement | undefined;
      try {
        statement = await read(subject);
      } catch (error) {
        logError(error);
        return degraded("source_unavailable");
      }
      if (statement === undefined) return degraded("consent_missing");
      if (statement.periods.length === 0) return degraded("not_found");

      let authentic: boolean;
      try {
        authentic = await options.checkAuthenticity(statement);
      } catch (error) {
        logError(error);
        return degraded("source_unavailable");
      }
      // An unverified document is not a weaker claim, it is no claim: reading
      // one would let anybody type their own income.
      if (!authentic) return degraded("needs_human_review");

      const nowMonth = monthOf(nowUnix);
      if (monthsBetween(statement.issuedAtMonth, nowMonth) > maxAgeMonths) {
        return degraded("not_found");
      }

      const amounts = statement.periods
        .map((period) => period.ibcMinor)
        .filter((value) => Number.isSafeInteger(value) && value >= 0);
      if (amounts.length === 0) return degraded("invalid_response");

      const claim: IncomeClaim = {
        kind: "income",
        jurisdiction: "CO",
        subjectRef: { hex: subject.subjectRef },
        monthlyMinor: median(amounts),
        currency: "COP",
        basis: "contribution_base",
        periodsObserved: amounts.length,
        periodsWindow: UGPP_WINDOW_MONTHS,
        attestedAt: nowUnix,
      };
      return { status: "claimed", claim };
    },
  };
}

// Names which statement backed a claim without carrying it: an auditor can ask
// the holder for the same code, and nobody else learns anything from it.
export function statementRef(h: FieldHash, statement: UgppStatement): string {
  return h.hash("knowni/ugpp-statement/v1", [utf8(statement.verificationCode)]);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : Math.floor((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function monthOf(unixSeconds: number): number {
  const date = new Date(unixSeconds * 1000);
  return date.getUTCFullYear() * 100 + (date.getUTCMonth() + 1);
}

function monthsBetween(fromYyyymm: number, toYyyymm: number): number {
  const fy = Math.floor(fromYyyymm / 100);
  const fm = fromYyyymm % 100;
  const ty = Math.floor(toYyyymm / 100);
  const tm = toYyyymm % 100;
  return (ty - fy) * 12 + (tm - fm);
}
