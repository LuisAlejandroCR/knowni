// registraduria.ts: personhood from the Registraduría's vital status. Answers "this document
// exists and belongs to a living person" and refuses to answer anything else.

import type { IdentityClaim } from "@knowni/core";
import type { SourcePort, SourceResult, SubjectLookup } from "../../types.ts";
import { degraded } from "../../types.ts";
import type { CromaClient } from "../../providers/croma/client.ts";

export const VITAL_STATUS_PATH = "/co/registraduria/vital-status/v1";

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
      if (subject.documentKind !== "CC") return degraded("needs_human_review");

      const claim: IdentityClaim = {
        kind: "identity",
        jurisdiction: "CO",
        documentKind: subject.documentKind,
        subjectRef: { hex: subject.subjectRef },
        // "Vigente" as this route can see it: the register holds the number
        // and does not report the holder as deceased.
        documentValid: status.status === "ALIVE",
        subjectAlive: status.status === "ALIVE",
        ofAge: true,
        attestedAt: nowUnix,
      };
      return { status: "claimed", claim };
    },
  };
}
