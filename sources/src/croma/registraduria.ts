// registraduria.ts: personhood from the Registraduría's vital status.
// Answers "this document exists and belongs to a living person" and refuses
// to answer anything else. Route and schema: docs/CROMA.md.

import type { IdentityClaim } from "@knowni/core";
import type { SourcePort, SourceResult, SubjectLookup } from "../types.ts";
import { degraded } from "../types.ts";
import type { CromaClient } from "./client.ts";

export const VITAL_STATUS_PATH = "/co/registraduria/vital-status/v1";

// The whole of what this route returns: a flag, the echoed document number
// and a normalized status. The echoed number is read past and never kept —
// it is the one field in the response that could leak the subject.
interface VitalStatus {
  readonly found: boolean;
  readonly status: "ALIVE" | "DECEASED" | "UNKNOWN" | null;
}

function parse(data: unknown): VitalStatus | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const record = data as Record<string, unknown>;
  if (typeof record.found !== "boolean") return undefined;
  const status = record.status;
  if (status !== null && status !== "ALIVE" && status !== "DECEASED" && status !== "UNKNOWN") {
    return undefined;
  }
  return { found: record.found, status };
}

export function createRegistraduriaPersonhoodSource(client: CromaClient): SourcePort {
  return {
    id: "co-registraduria-vital-status",
    jurisdiction: "CO",
    produces: "identity",
    async fetch(subject: SubjectLookup, nowUnix: number): Promise<SourceResult> {
      const outcome = await client.call(VITAL_STATUS_PATH, {
        document_number: subject.documentNumber,
      });
      if (outcome.status === "degraded") return degraded(outcome.reason);

      const status = parse(outcome.data);
      if (status === undefined) return degraded("invalid_response");
      // A cédula that is not in the register is not a failed lookup and not
      // a dead person: it is an absent record, and it says so.
      if (!status.found) return degraded("not_found");
      // UNKNOWN is an upstream value Croma could not normalize. Reading it
      // as "alive" would turn an unparsed string into an attestation.
      if (status.status === "UNKNOWN" || status.status === null) return degraded("invalid_response");
      // This route only knows the cédula register. For any other document
      // kind it cannot speak to majority of age, and a claim with `ofAge`
      // quietly false would read as "this person is a minor" — which is a
      // statement the source never made.
      if (subject.documentKind !== "CC") return degraded("needs_human_review");

      const claim: IdentityClaim = {
        kind: "identity",
        jurisdiction: "CO",
        documentKind: subject.documentKind as IdentityClaim["documentKind"],
        subjectRef: { hex: subject.subjectRef },
        // "Vigente" as this route can see it: the register holds the number
        // and does not report the holder as deceased.
        documentValid: status.status === "ALIVE",
        subjectAlive: status.status === "ALIVE",
        // A Colombian cédula de ciudadanía is only issued to adults, so
        // holding a current one IS the majority-of-age fact — and the date
        // of birth never has to be read to establish it.
        ofAge: true,
        attestedAt: nowUnix,
      };
      return { status: "claimed", claim };
    },
  };
}
