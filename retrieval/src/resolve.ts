// resolve.ts: turns candidate rows into one resolution — matched, ambiguous or none.
// A floor and a margin against the runner-up, so two close candidates are
// ambiguous rather than a coin flip.

import type { Candidate } from "./types.ts";

export interface ResolutionPolicy {
  // Below this, the best candidate is not a match at all.
  readonly floor: number;
  readonly margin: number;
}

export const SCREENING_POLICY: ResolutionPolicy = { floor: 0.75, margin: 0.15 };

export type Resolution =
  | { readonly status: "matched"; readonly candidate: Candidate }
  // Several plausible records. Carries them all, so a reviewer sees what the
  // index saw rather than being asked to trust a verdict.
  | { readonly status: "ambiguous"; readonly candidates: readonly Candidate[] }
  | { readonly status: "none" };

export function resolve(
  candidates: readonly Candidate[],
  policy: ResolutionPolicy = SCREENING_POLICY,
): Resolution {
  if (candidates.length === 0) return { status: "none" };

  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  const best = ranked[0]!;
  if (best.score < policy.floor) return { status: "none" };

  const runnerUp = ranked[1];
  if (runnerUp !== undefined && best.score - runnerUp.score < policy.margin) {
    // Everything still above the floor is plausible; hand the reviewer all
    // of it, not just the two that were compared.
    return { status: "ambiguous", candidates: ranked.filter((c) => c.score >= policy.floor) };
  }

  return { status: "matched", candidate: best };
}

export function screen(resolution: Resolution): {
  readonly listed: boolean;
  readonly needsReview: boolean;
} {
  switch (resolution.status) {
    case "matched":
      return { listed: true, needsReview: false };
    case "ambiguous":
      return { listed: true, needsReview: true };
    case "none":
      return { listed: false, needsReview: false };
  }
}
