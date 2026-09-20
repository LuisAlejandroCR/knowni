// sicaac.ts: capacity from SICAAC's insolvency register.
// Answers "no insolvency proceeding is on record" — the half of capacity a
// notary asks about in a conveyance, and no more than that.

import type { CapacityClaim } from "@knowni/core";
import type { SourcePort, SourceResult, SubjectLookup } from "../types.ts";
import { degraded } from "../types.ts";
import type { CromaClient } from "./client.ts";

export const INSOLVENCY_PATH = "/co/sicaac/insolvency-cases/v1";

// Only the count matters. The response lists the conciliation centre, the
// party type and the filing date of every case; reducing to "are there
// any" is what keeps a bankruptcy history out of the credential.
function caseCount(data: unknown): number | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const cases = (data as Record<string, unknown>).cases;
  return Array.isArray(cases) ? cases.length : undefined;
}

export function createSicaacCapacitySource(client: CromaClient): SourcePort {
  return {
    id: "co-sicaac-insolvency",
    jurisdiction: "CO",
    produces: "capacity",
    async fetch(subject: SubjectLookup, nowUnix: number): Promise<SourceResult> {
      const outcome = await client.call(INSOLVENCY_PATH, {
        document_number: subject.documentNumber,
        document_type: subject.documentKind,
      });
      if (outcome.status === "degraded") {
        // An empty register is the normal, good answer here: nobody is in
        // insolvency proceedings. The route says so with `cases: []`, but a
        // `data: null` would arrive as not_found and must not be read as a
        // restriction either way.
        return degraded(outcome.reason);
      }

      const count = caseCount(outcome.data);
      if (count === undefined) return degraded("invalid_response");

      const claim: CapacityClaim = {
        kind: "capacity",
        jurisdiction: "CO",
        subjectRef: { hex: subject.subjectRef },
        restricted: count > 0,
        basis: "insolvency_proceeding",
        attestedAt: nowUnix,
      };
      return { status: "claimed", claim };
    },
  };
}
