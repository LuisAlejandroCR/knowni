// sources/src/synthetic/co.ts
// A Colombia that answers offline.
//
// Every demo of this kind eventually shows a screen that says "connecting to
// Registraduría…" and nothing behind it. This module is the opposite
// commitment: the journey runs end to end with no network, no credentials
// and no registry agreement, against data that is obviously synthetic.
//
// It is a SOURCE, not a mock: it implements the same port the real adapters
// do, so swapping it for an operator integration changes one line of
// composition. The tests in this repository run against it for the same
// reason a reviewer should trust it — it is the real code path.

import type { IdentityClaim } from "@knowni/core";
import type { PilaClient, PilaContribution } from "../colombia/pila.ts";
import type { SourcePort, SourceResult, SubjectLookup } from "../types.ts";
import { degraded } from "../types.ts";

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

// The name lookup the screening source needs. Separate from the identity
// source on purpose: producing an IdentityClaim requires no name, and this
// is the only function in the repository that returns one.
export function createSyntheticNameResolver(subjects: readonly SyntheticSubject[]) {
  const byDocument = new Map(subjects.map((s) => [s.documentNumber, s]));
  return async (subject: SubjectLookup): Promise<string | undefined> =>
    byDocument.get(subject.documentNumber)?.name;
}
