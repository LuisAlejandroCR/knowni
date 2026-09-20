// listas.ts: restrictive-list screening for Colombia, as a source.
// The search happens at issuance, with the subject's name and consent; what
// leaves is a boolean and the snapshot root it was read against.

import type { StandingClaim } from "@knowni/core";
import type { RecordIndexPort, ResolutionPolicy } from "@knowni/retrieval";
import { SCREENING_POLICY, resolve, screen } from "@knowni/retrieval";
import type { SourcePort, SourceResult, SubjectLookup } from "../../types.ts";
import { degraded } from "../../types.ts";

export const CO_DEFAULT_LISTS = [
  "ofac-sdn",
  "un-consolidated",
  "co-procuraduria",
  "co-contraloria",
] as const;

export interface ListScreeningOptions {
  readonly index: RecordIndexPort;
  readonly resolveName: (subject: SubjectLookup) => Promise<string | undefined>;
  readonly sources?: readonly string[];
  readonly policy?: ResolutionPolicy;
  readonly logError?: (error: unknown) => void;
}

export function createListScreeningSource(options: ListScreeningOptions): SourcePort {
  const sources = options.sources ?? [...CO_DEFAULT_LISTS];
  const policy = options.policy ?? SCREENING_POLICY;
  const logError = options.logError ?? (() => {});

  return {
    id: "co-listas-restrictivas",
    jurisdiction: "CO",
    produces: "standing",
    async fetch(subject: SubjectLookup, nowUnix: number): Promise<SourceResult> {
      let name: string | undefined;
      let candidates: Awaited<ReturnType<RecordIndexPort["search"]>>;
      let snapshotRoot: string;
      try {
        name = await options.resolveName(subject);
        // No name means no consent to screen, or a registry that would not
        // answer. Either way there is nothing to swear to.
        if (name === undefined || name.trim() === "") return degraded("consent_missing");

        candidates = await options.index.search({ text: name, sources: [...sources] });
        snapshotRoot = await options.index.snapshotRoot();
      } catch (error) {
        logError(error);
        return degraded("source_unavailable");
      }

      const { listed, needsReview } = screen(resolve(candidates, policy));
      // A coin flip between two registry rows is not a fact about a person.
      if (needsReview) return degraded("needs_human_review");

      const claim: StandingClaim = {
        kind: "standing",
        jurisdiction: "CO",
        subjectRef: { hex: subject.subjectRef },
        listed,
        listSetRoot: snapshotRoot,
        attestedAt: nowUnix,
      };
      return { status: "claimed", claim };
    },
  };
}
