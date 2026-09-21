// pila.ts: turns a PILA contribution record into an income claim and a formality claim.
// Colombia's social-security contribution register.

import type { FormalityClaim, IncomeClaim } from "@knowni/core";
import type { SourcePort, SourceResult, SubjectLookup } from "../../types.ts";
import { degraded } from "../../types.ts";

export interface PilaContribution {
  readonly month: number; // YYYYMM
  readonly ibcMinor: number; // ingreso base de cotización, in COP cents
}

export interface PilaClient {
  // The last 12 months is what both predicates need; asking for more would
  // be collecting history nobody uses.
  contributions(documentKind: string, documentNumber: string): Promise<readonly PilaContribution[]>;
}

export interface PilaOptions {
  readonly logError?: (error: unknown) => void;
}

export function createPilaIncomeSource(client: PilaClient, options: PilaOptions = {}): SourcePort {
  const logError = options.logError ?? (() => {});
  return {
    id: "co-pila-income",
    jurisdiction: "CO",
    produces: "income",
    async fetch(subject: SubjectLookup, nowUnix: number): Promise<SourceResult> {
      let rows: readonly PilaContribution[];
      try {
        rows = await client.contributions(subject.documentKind, subject.documentNumber);
      } catch (error) {
        logError(error);
        return degraded("source_unavailable");
      }
      if (rows.length === 0) return degraded("not_found");

      const amounts = rows.map((r) => r.ibcMinor).filter((n) => Number.isSafeInteger(n) && n >= 0);
      if (amounts.length === 0) return degraded("invalid_response");

      const claim: IncomeClaim = {
        kind: "income",
        jurisdiction: "CO",
        subjectRef: { hex: subject.subjectRef },
        monthlyMinor: median(amounts),
        currency: "COP",
        basis: "contribution_base",
        periodsObserved: amounts.length,
        periodsWindow: 12,
        attestedAt: nowUnix,
      };
      return { status: "claimed", claim };
    },
  };
}

export function createPilaFormalitySource(client: PilaClient, options: PilaOptions = {}): SourcePort {
  const logError = options.logError ?? (() => {});
  return {
    id: "co-pila-formality",
    jurisdiction: "CO",
    produces: "formality",
    async fetch(subject: SubjectLookup, nowUnix: number): Promise<SourceResult> {
      let rows: readonly PilaContribution[];
      try {
        rows = await client.contributions(subject.documentKind, subject.documentNumber);
      } catch (error) {
        logError(error);
        return degraded("source_unavailable");
      }
      if (rows.length === 0) return degraded("not_found");

      const months = rows.map((r) => r.month).filter(isYyyymm);
      if (months.length === 0) return degraded("invalid_response");

      const claim: FormalityClaim = {
        kind: "formality",
        jurisdiction: "CO",
        subjectRef: { hex: subject.subjectRef },
        lastContributionMonth: Math.max(...months),
        // Distinct months, not rows: planilla "N" files corrections after the
        // initial payment, so one month can appear twice (D-15).
        monthsContributedLast12: new Set(months).size,
        attestedAt: nowUnix,
      };
      return { status: "claimed", claim };
    },
  };
}

// Lower median on an even count: understating by one position is a tolerable
// error for the relying party, overstating is not.
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

function isYyyymm(value: number): boolean {
  if (!Number.isSafeInteger(value) || value < 100001 || value > 999912) return false;
  const month = value % 100;
  return month >= 1 && month <= 12;
}
