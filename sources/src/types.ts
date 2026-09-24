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

// What a holder may be told about why an answer is missing. The internal
// reasons are operational and some of them name the source's own trouble; this
// is the reduced, public taxonomy — criterio A7. It travels beside the signed
// answers and never inside them: the counterparty receives a verdict-free
// `unavailable` and learns nothing more, while the person whose verification it
// is can tell "el registro no tiene el dato" from "la fuente no respondió".
export type PublicSourceState =
  | "answered"
  | "not_found"
  | "degraded"
  | "failed"
  | "consent_missing"
  | "needs_human_review";

export function publicStateOf(result: SourceResult): PublicSourceState {
  if (result.status === "claimed") return "answered";
  switch (result.reason) {
    case "not_found":
      return "not_found";
    // Nothing usable came back: a shape we do not accept is the source
    // failing, not the register being silent about this subject.
    case "invalid_response":
      return "failed";
    case "consent_missing":
      return "consent_missing";
    case "needs_human_review":
      return "needs_human_review";
    default:
      return "degraded";
  }
}
