// sources/src/colombia/pila.ts
// PILA — Planilla Integrada de Liquidación de Aportes — as the replacement
// for the two documents every Colombian lease demands.
//
// A landlord asking for a "certificación laboral" and a "certificación
// bancaria" is asking two questions: does this person have income, and is it
// steady? Both are answered by the social-security contribution record,
// which already exists, is already monthly, and covers employees and
// independent contributors alike. The IBC — ingreso base de cotización — is
// the declared income the contribution was computed on.
//
// This is a better source than a bank certificate in three ways that matter:
// it is periodic rather than a snapshot, it is hard to fabricate because an
// employer paid real money against it, and it covers the independent
// workers a payroll letter structurally cannot.
//
// Two honest limits, stated here because a demo that hides them is a demo
// that misleads a jury:
//
//   coverage  an informal worker contributes nothing and looks identical to
//             someone with no income. Formality is a real predicate, not a
//             proxy for trustworthiness, and the product must not let a
//             landlord treat "no PILA record" as "not creditworthy". It is
//             why StandingClaim and IdentityClaim are separate answers.
//   floor     many independents contribute on the legal minimum regardless
//             of what they actually earn, so the IBC is a FLOOR on income,
//             not a measurement. The claim says `basis: "social_security"`
//             so the relying party knows which it accepted.
//
// Access is the open question, not the data model: today this runs against
// an operator with the subject's authorisation. See docs/COLOMBIA.md.

import type { FormalityClaim, IncomeClaim } from "@knowni/core";
import type { SourcePort, SourceResult, SubjectLookup } from "../types.ts";
import { degraded } from "../types.ts";

// One month's contribution as an operator reports it. Deliberately not the
// full PILA record: the employer's NIT, the ARL, the fund and the
// contributor's address are all in the real response and none of them are
// needed to answer either question.
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

// Income claim: the MEDIAN of the last 12 months, not the mean and not the
// latest.
//
// The mean is wrong because a single bonus month or a severance payment
// drags it up, and a landlord underwriting a 12-month lease against a
// one-off is the exact error this is meant to prevent. The latest month is
// wrong because contributions are filed late and a missing month would read
// as zero income. The median survives both.
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
        basis: "social_security",
        attestedAt: nowUnix,
      };
      return { status: "claimed", claim };
    },
  };
}

// Formality claim: how recent and how continuous. Same client, separate
// port, because a landlord may want one and not the other — and because a
// subject who declines to prove income can still prove they are formally
// employed.
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
        // Distinct months, not row count: an operator can file two rows for
        // one month (two employers, or a correction), and counting rows
        // would report 14 months of contributions in a 12-month year.
        monthsContributedLast12: new Set(months).size,
        attestedAt: nowUnix,
      };
      return { status: "claimed", claim };
    },
  };
}

// Lower median on an even count. The conservative direction: for a landlord
// deciding whether income covers rent, understating by one position is a
// tolerable error and overstating is not.
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

function isYyyymm(value: number): boolean {
  if (!Number.isSafeInteger(value) || value < 100001 || value > 999912) return false;
  const month = value % 100;
  return month >= 1 && month <= 12;
}
