// types.ts: the port a jurisdiction plugs into.
// One adapter per (country, question), returning a claim or a typed
// degradation — never the registry's own response.

import type { Claim } from "@knowni/core";

export interface SubjectLookup {
  readonly documentKind: string;
  readonly documentNumber: string;
  readonly subjectRef: string;
}

export type SourceFailureReason =
  | "source_unavailable"
  | "not_found"
  | "consent_missing"
  | "needs_human_review"
  | "invalid_response";

export type SourceResult =
  | { readonly status: "claimed"; readonly claim: Claim }
  | { readonly status: "degraded"; readonly reason: SourceFailureReason };

export interface SourcePort {
  readonly id: string;
  readonly jurisdiction: string;
  // Which predicate this adapter can answer. A registry that can answer two
  // is registered twice, as two ports.
  readonly produces: Claim["kind"];
  fetch(subject: SubjectLookup, nowUnix: number): Promise<SourceResult>;
}

export function degraded(reason: SourceFailureReason): SourceResult {
  return { status: "degraded", reason };
}
