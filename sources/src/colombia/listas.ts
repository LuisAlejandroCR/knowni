// sources/src/colombia/listas.ts
// Restrictive-list screening, as a source.
//
// This is the one adapter that calls the retrieval port, and the reason the
// boundary in retrieval/src/types.ts is written the way it is: the search
// happens HERE, at issuance, with the subject's name and consent, and what
// leaves is a StandingClaim carrying a boolean and the snapshot root. The
// relying party never sees the name, the candidate rows or the index.
//
// An ambiguous resolution does NOT become "listed: true" in a claim. It
// becomes `needs_human_review`, and no claim is issued at all — because a
// claim is a statement a source is willing to stand behind, and "probably
// this person" is not one. A landlord waiting on a review is a worse
// experience and the only honest one.

import type { StandingClaim } from "@knowni/core";
import type { RecordIndexPort, ResolutionPolicy } from "@knowni/retrieval";
import { SCREENING_POLICY, resolve, screen } from "@knowni/retrieval";
import type { SourcePort, SourceResult, SubjectLookup } from "../types.ts";
import { degraded } from "../types.ts";

// The lists a Colombian counterparty is normally expected to check. OFAC and
// the UN list are the international obligation; the Procuraduría and
// Contraloría bulletins are the domestic ones that block public contracting.
export const CO_DEFAULT_LISTS = [
  "ofac-sdn",
  "un-consolidated",
  "co-procuraduria",
  "co-contraloria",
] as const;

// The name is needed for the search and for nothing else. It is a parameter
// of fetch rather than a field on the port, so it cannot be retained: there
// is nowhere in this module to put it.
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
