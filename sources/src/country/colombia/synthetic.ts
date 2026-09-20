// synthetic.ts: synthetic Colombian sources, for tests and demos. A Colombia that answers
// offline.

import type { IdentityClaim } from "@knowni/core";
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

export function createSyntheticNameResolver(subjects: readonly SyntheticSubject[]) {
  const byDocument = new Map(subjects.map((s) => [s.documentNumber, s]));
  return async (subject: SubjectLookup): Promise<string | undefined> =>
    byDocument.get(subject.documentNumber)?.name;
}
