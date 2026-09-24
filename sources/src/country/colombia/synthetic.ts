// synthetic.ts: synthetic Colombian sources, for tests and demos. A Colombia that answers
// offline.

import type { IdentityClaim } from "@knowni/core";
import type { CromaClient, CromaOutcome } from "../../providers/croma/client.ts";
import { CONTADURIA_PATH, CONTRALORIA_PATH, PROCURADURIA_PATH } from "./sanctions.ts";
import type { PilaClient, PilaContribution } from "./pila.ts";
import type { SourcePort, SourceResult, SubjectLookup } from "../../types.ts";
import { degraded } from "../../types.ts";

export interface SyntheticSubject {
  readonly documentNumber: string;
  readonly name: string;
  readonly documentValid: boolean;
  readonly subjectAlive: boolean;
  readonly ofAge: boolean;
  readonly contributions: readonly PilaContribution[];
  // Which of the three disqualification registers name this person. Absent
  // means none of them, which is the ordinary case and not a missing answer.
  readonly listedIn?: readonly ("procuraduria" | "contraloria" | "contaduria")[];
}

export function createSyntheticPilaClient(subjects: readonly SyntheticSubject[]): PilaClient {
  const byDocument = new Map(subjects.map((s) => [s.documentNumber, s]));
  return {
    async contributions(_documentKind, documentNumber) {
      return byDocument.get(documentNumber)?.contributions ?? [];
    },
  };
}

export function createSyntheticRegistraduriaSource(
  subjects: readonly SyntheticSubject[],
): SourcePort {
  const byDocument = new Map(subjects.map((s) => [s.documentNumber, s]));
  return {
    id: "co-registraduria-synthetic",
    jurisdiction: "CO",
    produces: "identity",
    async fetch(subject: SubjectLookup, nowUnix: number): Promise<SourceResult> {
      const found = byDocument.get(subject.documentNumber);
      if (found === undefined) return degraded("not_found");

      const claim: IdentityClaim = {
        kind: "identity",
        jurisdiction: "CO",
        documentKind: "CC",
        subjectRef: { hex: subject.subjectRef },
        documentValid: found.documentValid,
        subjectAlive: found.subjectAlive,
        ofAge: found.ofAge,
        attestedAt: nowUnix,
      };
      return { status: "claimed", claim };
    },
  };
}

// The stamp each register publishes with its answer. Fixed strings, because a
// snapshot the relying party accepts has to be reproducible in a test: what it
// stands for is "this verdict, read against this version of this list".
export const SYNTHETIC_LIST_STAMPS = ["proc-2026-09", "contr-2026-09", "cont-2026-09"] as const;

// A Croma that answers the three sanctions endpoints offline. It replaces the
// vector index the journey used to screen names against: the real source is a
// typed API asked by document number, and the test now exercises that path
// rather than one production never takes — B3.
export function createSyntheticSanctionsClient(subjects: readonly SyntheticSubject[]): CromaClient {
  const byDocument = new Map(subjects.map((subject) => [subject.documentNumber, subject]));
  const answer = (listed: boolean, field: string, stamp: string): CromaOutcome => ({
    status: "data",
    data: { [field]: listed, verification_code: stamp },
  });

  return {
    async call(path, body) {
      const documentNumber = body["document_number"];
      const subject = typeof documentNumber === "string" ? byDocument.get(documentNumber) : undefined;
      // A register that does not know the document says so; it does not say
      // the person is clean.
      if (subject === undefined) return { status: "degraded", reason: "not_found" };
      const listedIn = subject.listedIn ?? [];
      switch (path) {
        case PROCURADURIA_PATH:
          return answer(listedIn.includes("procuraduria"), "has_records", SYNTHETIC_LIST_STAMPS[0]);
        case CONTRALORIA_PATH:
          return answer(listedIn.includes("contraloria"), "is_fiscal_responsible", SYNTHETIC_LIST_STAMPS[1]);
        case CONTADURIA_PATH:
          return answer(listedIn.includes("contaduria"), "reported", SYNTHETIC_LIST_STAMPS[2]);
        default:
          return { status: "degraded", reason: "not_found" };
      }
    },
  };
}
