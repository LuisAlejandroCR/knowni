// retrieval/src/resolve.ts
// Turning a list of candidates into a decision — and refusing to, when the
// honest answer is that the index cannot tell.
//
// The failure this module exists to prevent is specific and common: in
// Colombia, "MARIA RODRIGUEZ" matches thousands of records. A resolver that
// returns the top hit produces a sanctions match against a stranger who
// shares a name, and a person is refused a lease on it. So two rules, not
// one threshold:
//
//   floor   the best candidate must actually be a good match
//   margin  it must beat the runner-up by enough that the choice is not a
//           coin flip
//
// Failing the margin returns `ambiguous`, which is routed to a human, never
// silently to `none`. `ambiguous` is not an error — on a common name it is
// the correct answer, and the reason a StandingClaim can be trusted at all.

import type { Candidate } from "./types.ts";

export interface ResolutionPolicy {
  // Below this, the best candidate is not a match at all.
  readonly floor: number;
  // How far the best must beat the second-best. On a screening index this
  // should be generous: the cost of `ambiguous` is a review, the cost of a
  // wrong match is a person refused housing.
  readonly margin: number;
}

// Tuned for screening rather than for convenience. Documented here because
// a reviewer changing these numbers is changing the product's error
// profile, not a constant.
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

// The screening question, phrased so the unsafe default is impossible to
// reach by accident: an ambiguous result is NOT "not listed".
//
// It returns the flag plus whether a human still has to look, and a caller
// that ignores `needsReview` has to ignore it deliberately.
export function screen(resolution: Resolution): {
  readonly listed: boolean;
  readonly needsReview: boolean;
} {
  switch (resolution.status) {
    case "matched":
      return { listed: true, needsReview: false };
    case "ambiguous":
      // Treated as listed until a reviewer says otherwise. This is the
      // conservative direction for a sanctions check, and the opposite of
      // what a convenience-optimised system would do.
      return { listed: true, needsReview: true };
    case "none":
      return { listed: false, needsReview: false };
  }
}
