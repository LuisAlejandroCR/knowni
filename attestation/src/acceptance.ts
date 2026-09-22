// acceptance.ts: everything a counterparty must check before an answer counts — request,
// binding, evidence, revocation — and the atomic step that consumes the nullifier exactly
// once.

import type { Disclosure, FieldHash } from "@knowni/core";
import { sessionId } from "@knowni/core";
import type { IssuerRegistry } from "./types.ts";
import type { SignaturePort } from "./signing.ts";
import type { AttestedResults } from "./results.ts";
import { verifyResults } from "./results.ts";
import type { PresentationFailure, SignedRequest } from "./presentation.ts";
import { verifyRequest } from "./presentation.ts";

export type RevocationState =
  | { readonly status: "live"; readonly checkedAt: number }
  | { readonly status: "revoked"; readonly checkedAt: number }
  | { readonly status: "unknown" };

export interface RevocationOracle {
  stateOf(issuerId: string, root: string): RevocationState;
}

export interface RevocationPolicy {
  readonly maxSnapshotAgeSeconds: number;
  readonly onUnknown: "refuse" | "accept_with_note";
}

export type ClaimOutcome = "claimed" | "idempotent" | "replayed";

export interface NullifierLedger {
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

export interface NullifierEntry {
  readonly nullifier: string;
  readonly presentationId: string;
}

// Where a spent set outlives the process. A port, not a dependency: this
// workspace never learns what a phone, a file or a database is.
export interface NullifierStore {
  load(): Promise<readonly NullifierEntry[]>;
  append(entry: NullifierEntry): Promise<void>;
}

export interface PersistentLedgerOptions {
  // A write that never lands means a spent presentation comes back after a
  // restart. It is a degradation, so it is reported rather than swallowed.
  readonly onWriteError?: (error: unknown, entry: NullifierEntry) => void;
}

// Hydrated once, then decided in memory: `claim` stays synchronous —
// `acceptAnswer` consumes the nullifier in one step and an await there would
// open the window this ledger exists to close. The write is what trails.
export async function createPersistentNullifierLedger(
  store: NullifierStore,
  options: PersistentLedgerOptions = {},
): Promise<NullifierLedger> {
  const onWriteError = options.onWriteError ?? (() => {});
  const claimed = new Map<string, string>();
  for (const entry of await store.load()) {
    // First write wins: a store that somehow holds the same nullifier twice
    // must not let the later entry relabel what was already spent.
    if (!claimed.has(entry.nullifier)) claimed.set(entry.nullifier, entry.presentationId);
  }

  return {
    claim(nullifier, presentationId) {
      const previous = claimed.get(nullifier);
      if (previous !== undefined) return previous === presentationId ? "idempotent" : "replayed";
      claimed.set(nullifier, presentationId);
      const entry = { nullifier, presentationId };
      void store.append(entry).catch((error: unknown) => onWriteError(error, entry));
      return "claimed";
    },
  };
}

// The binding a process uses before it has real storage. Named for what it
// is, so nobody reads a memory-backed ledger as a persisted one.
export function createMemoryNullifierStore(seed: readonly NullifierEntry[] = []): NullifierStore {
  const entries: NullifierEntry[] = [...seed];
  return {
    async load() {
      return [...entries];
    },
    async append(entry) {
      entries.push(entry);
    },
  };
}

export type AcceptanceFailure =
  | PresentationFailure
  | "revocation_unknown"
  | "revocation_stale"
  | "revoked";

export interface Acceptance {
  readonly status: "accepted";
  readonly idempotent: boolean;
  readonly notes: readonly string[];
}

export type AcceptanceResult =
  | Acceptance
  | { readonly status: "refused"; readonly reason: AcceptanceFailure };

export interface AcceptanceInput {
  readonly signatures: SignaturePort;
  readonly signedRequest: SignedRequest;
  readonly audience: string;
  readonly disclosure: Disclosure;
  readonly results: AttestedResults;
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
  const requestCheck = verifyRequest(
    input.signatures,
    input.registry,
    input.signedRequest,
    input.audience,
    input.nowUnix,
  );
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
    signatures: input.signatures,
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
