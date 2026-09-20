// acceptance.ts: everything a counterparty must check before an answer
// counts — request, binding, evidence, revocation — and the atomic step that
// consumes the nullifier exactly once.

// The gap this closes: acceptPresentation checked who asked and whether the
// nullifier was spent. That is the binding, not the evidence, and "verified"
// meant "well addressed". Here the order is fixed and the cheap, private
// checks come first:
//
//   1. the request is this counterparty's, signed, unexpired
//   2. the answer is bound to that request — audience, purpose, challenge,
//      parameters, all inside the session id
//   3. the answers are authenticated by an issuer this counterparty accepts
//   4. revocation is resolved under a stated policy, with "unknown" as its
//      own outcome and never as a silent success
//   5. and only then the nullifier is claimed, atomically
//
// Nothing before step 5 may consume anything: a subject whose presentation
// was refused for a stale snapshot must still be able to answer afterwards.

import type { Disclosure, FieldHash } from "@knowni/core";
import { sessionId } from "@knowni/core";
import type { IssuerRegistry } from "./types.ts";
import type { AttestedResults } from "./results.ts";
import { verifyResults } from "./results.ts";
import type { PresentationFailure, SignedRequest } from "./presentation.ts";
import { verifyRequest } from "./presentation.ts";

// Three states, not two. A registry that could not be reached does not know
// whether a root is live, and a boolean forces that into a lie in one
// direction or the other.
export type RevocationState =
  | { readonly status: "live"; readonly checkedAt: number }
  | { readonly status: "revoked"; readonly checkedAt: number }
  | { readonly status: "unknown" };

export interface RevocationOracle {
  stateOf(issuerId: string, root: string): RevocationState;
}

export interface RevocationPolicy {
  // How old a revocation snapshot may be before it stops counting as an
  // answer. Validating a signature offline proves the issuer signed; it
  // proves nothing about today.
  readonly maxSnapshotAgeSeconds: number;
  // What this counterparty does when the state is unknown or stale. A
  // notary registering a transfer may refuse; a low-stakes check may accept
  // and record that it did. Their call, made in the open.
  readonly onUnknown: "refuse" | "accept_with_note";
}

// Claiming is one step, so no caller can check and then forget to record.
// An implementation backed by a database does this in a transaction; the
// in-memory one below is for tests and single-process demos, and says so.
export type ClaimOutcome = "claimed" | "idempotent" | "replayed";

export interface NullifierLedger {
  // Same presentation arriving twice — a retried request, a double tap — is
  // `idempotent` and keeps its original acceptance. A DIFFERENT presentation
  // under the same nullifier is `replayed`.
  claim(nullifier: string, presentationId: string): ClaimOutcome;
}

export function createMemoryNullifierLedger(): NullifierLedger {
  const claimed = new Map<string, string>();
  return {
    claim(nullifier, presentationId) {
      const previous = claimed.get(nullifier);
      if (previous === undefined) {
        claimed.set(nullifier, presentationId);
        return "claimed";
      }
      return previous === presentationId ? "idempotent" : "replayed";
    },
  };
}

export type AcceptanceFailure =
  | PresentationFailure
  | "revocation_unknown"
  | "revocation_stale"
  | "revoked";

// An acceptance says what it accepted UNDER. `notes` is not decoration: a
// counterparty that accepted without a fresh revocation answer needs that on
// the record, and the subject is entitled to know the answer was qualified.
export interface Acceptance {
  readonly status: "accepted";
  readonly idempotent: boolean;
  readonly notes: readonly string[];
}

export type AcceptanceResult =
  | Acceptance
  | { readonly status: "refused"; readonly reason: AcceptanceFailure };

export interface AcceptanceInput {
  readonly signedRequest: SignedRequest;
  readonly audience: string;
  readonly disclosure: Disclosure;
  readonly results: AttestedResults;
  // A stable id for THIS presentation: the same envelope retried keeps it,
  // a new answer gets a new one. It is what makes an acknowledgement
  // idempotent without making a replay possible.
  readonly presentationId: string;
  readonly registry: IssuerRegistry;
  readonly ledger: NullifierLedger;
  readonly revocation?: RevocationOracle;
  readonly policy: RevocationPolicy;
  readonly nowUnix: number;
  readonly requiredPredicates?: readonly string[];
  // The root the answers were issued against, as the counterparty knows it.
  readonly issuerRoot: string;
}

export function acceptAnswer(h: FieldHash, input: AcceptanceInput): AcceptanceResult {
  const request = input.signedRequest.request;

  // 1. Is this our own request, signed and still open?
  const requestCheck = verifyRequest(input.registry, input.signedRequest, input.audience, input.nowUnix);
  if (requestCheck.status === "refused") return requestCheck;

  // 2. Is the answer bound to it?
  if (input.disclosure.relyingPartyId !== input.audience) {
    return { status: "refused", reason: "wrong_audience" };
  }
  const expectedSession = sessionId(h, request);
  if (input.disclosure.sessionId !== expectedSession || input.disclosure.purpose !== request.purpose) {
    return { status: "refused", reason: "session_mismatch" };
  }

  // 3. Is the evidence authenticated?
  const verified = verifyResults(h, input.results, {
    registry: input.registry,
    request,
    nowUnix: input.nowUnix,
    required: input.requiredPredicates,
  });
  if (verified.status === "invalid") return { status: "refused", reason: "results_unauthenticated" };

  // 4. Revocation, resolved out loud.
  const notes: string[] = [];
  const state = input.revocation?.stateOf(input.results.issuerId, input.issuerRoot) ?? {
    status: "unknown" as const,
  };
  if (state.status === "revoked") return { status: "refused", reason: "revoked" };
  if (state.status === "unknown") {
    if (input.policy.onUnknown === "refuse") return { status: "refused", reason: "revocation_unknown" };
    notes.push("revocation_unknown");
  } else {
    const age = input.nowUnix - state.checkedAt;
    if (age < 0 || age > input.policy.maxSnapshotAgeSeconds) {
      if (input.policy.onUnknown === "refuse") return { status: "refused", reason: "revocation_stale" };
      notes.push("revocation_stale");
    }
  }

  // 5. Only now, and in one step.
  const claim = input.ledger.claim(input.disclosure.nullifier, input.presentationId);
  if (claim === "replayed") return { status: "refused", reason: "replayed" };
  return { status: "accepted", idempotent: claim === "idempotent", notes };
}
