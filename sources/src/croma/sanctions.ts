// sanctions.ts: standing from the three Colombian disqualification registers.
// Procuraduría (disciplinary), Contraloría (fiscal) and Contaduría (state
// debtors), reduced to one boolean plus the snapshot it was read against.

import type { StandingClaim } from "@knowni/core";
import { sha256Hash, utf8 } from "@knowni/core";
import type { SourcePort, SourceResult, SubjectLookup } from "../types.ts";
import { degraded } from "../types.ts";
import type { CromaClient } from "./client.ts";

export const PROCURADURIA_PATH = "/co/procuraduria/disciplinary-records/v1";
export const CONTRALORIA_PATH = "/co/contraloria/fiscal-records/v1";
export const CONTADURIA_PATH = "/co/contaduria/state-delinquent-debtors/v1";

// One register's verdict, reduced the moment it arrives. `stamp` is
// whatever the source published to identify its own snapshot — a checked_at
// or a verification code — and it is the only thing besides the boolean
// that survives the parse.
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

// The root names WHICH snapshots produced a "clean": three source ids and
// the stamps they published, hashed in a fixed order. A verifier that
// accepts a root is accepting those three reads and no others, and an
// auditor can re-run them.
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
        // Two of three registers is not a screening. A register that could
        // not be read makes the whole answer unavailable, because "clean"
        // would then mean "clean where we managed to look".
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
