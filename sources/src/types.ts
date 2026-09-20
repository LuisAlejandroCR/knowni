// sources/src/types.ts
// The port a jurisdiction plugs into.
//
// One adapter per (country, question), never per country: Colombia answers
// "is this document current?" from the Registraduría and "what does this
// person earn?" from social-security contributions, and those are different
// institutions with different availability, different latency and different
// legal bases for access. Bundling them into one "Colombia adapter" would
// make a PILA outage look like an identity failure.
//
// What an adapter returns is a CLAIM — the smallest fact that answers a
// predicate — not the registry's response. The response is parsed, reduced
// and discarded inside the adapter; nothing above this port ever sees the
// employer's name, the exact contribution history or the document image.

import type { Claim } from "@knowni/core";

// A subject as an adapter needs them: the identifier to look up, plus the
// salted reference every claim is filed under. The raw identifier reaches
// the adapter because a registry needs it — and reaches nothing else.
export interface SubjectLookup {
  readonly documentKind: string;
  readonly documentNumber: string;
  readonly subjectRef: string;
}

// Fixed vocabulary, same discipline as the anchoring port: a registry's own
// error text can carry endpoints, session tokens and, in some Colombian
// APIs, the queried document number itself.
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
