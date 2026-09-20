// sanctions.ts: standing from the three Colombian disqualification registers. Procuraduría
// (disciplinary), Contraloría (fiscal) and Contaduría (state debtors), reduced to one boolean
// plus the snapshot it was read against.

import type { StandingClaim } from "@knowni/core";
import { sha256Hash, utf8 } from "@knowni/core";
import type { SourcePort, SourceResult, SubjectLookup } from "../../types.ts";
import { degraded } from "../../types.ts";
import type { CromaClient } from "../../providers/croma/client.ts";

export const PROCURADURIA_PATH = "/co/procuraduria/disciplinary-records/v1";
export const CONTRALORIA_PATH = "/co/contraloria/fiscal-records/v1";
export const CONTADURIA_PATH = "/co/contaduria/state-delinquent-debtors/v1";

interface Verdict {
  readonly listed: boolean;
  readonly stamp: string;
}

function stampOf(record: Record<string, unknown>): string {
  for (const field of ["verification_code", "certified_at", "checked_at"]) {
    const value = record[field];
    if (typeof value === "string" && value !== "") return value;
  }
  return "";
}

function readVerdict(data: unknown, field: string): Verdict | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const record = data as Record<string, unknown>;
  const listed = record[field];
  if (typeof listed !== "boolean") return undefined;
  return { listed, stamp: stampOf(record) };
}

export function listSetRoot(stamps: readonly string[]): string {
  return sha256Hash.hash("knowni/co-sanctions/v1", [
    utf8(["procuraduria", "contraloria", "contaduria"].join("|")),
    utf8(stamps.join("|")),
  ]);
}

export function createSanctionsSource(client: CromaClient): SourcePort {
  return {
    id: "co-sanctions",
    jurisdiction: "CO",
    produces: "standing",
    async fetch(subject: SubjectLookup, nowUnix: number): Promise<SourceResult> {
      const body = { document_number: subject.documentNumber, document_type: subject.documentKind };
      const [disciplinary, fiscal, debtors] = await Promise.all([
        client.call(PROCURADURIA_PATH, body),
        client.call(CONTRALORIA_PATH, body),
        client.call(CONTADURIA_PATH, body),
      ]);

      const verdicts: Verdict[] = [];
      for (const [outcome, field] of [
        [disciplinary, "has_records"],
        [fiscal, "is_fiscal_responsible"],
        [debtors, "reported"],
      ] as const) {
        if (outcome.status === "degraded") return degraded(outcome.reason);
        const verdict = readVerdict(outcome.data, field);
        if (verdict === undefined) return degraded("invalid_response");
        verdicts.push(verdict);
      }

      const claim: StandingClaim = {
        kind: "standing",
        jurisdiction: "CO",
        subjectRef: { hex: subject.subjectRef },
        listed: verdicts.some((verdict) => verdict.listed),
        listSetRoot: listSetRoot(verdicts.map((verdict) => verdict.stamp)),
        attestedAt: nowUnix,
      };
      return { status: "claimed", claim };
    },
  };
}
