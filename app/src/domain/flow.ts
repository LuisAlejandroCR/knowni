// flow.ts: the state of one verification, from request to answer.
// A single store the screens read, so the step a person is on is a fact of the
// system and not something each screen guesses.

import { useSyncExternalStore } from "react";
import type { AttestedAnswer, AttestedResults, SignedRequest } from "@knowni/attestation";
import type { SessionRequest } from "@knowni/core";
import { demoRequest } from "./demo-issuer.ts";
import { fetchIssuer, requestIssuance, verifyIssued, type IssuerIdentity, type SourceState } from "./issuer-client.ts";
import { readRequest, type RequestState } from "./wallet.ts";
import { purposeFor } from "./purpose.ts";
import { DEMO_COUNTERPARTY } from "./demo-issuer.ts";
import { HISTORY_LIMIT, addEntry, type HistoryEntry, type Outcome } from "./history.ts";
import { loadHistory, saveHistory } from "./history-store.ts";

export type Step = "request" | "consent" | "issuing" | "review" | "sent";

export interface Subject {
  readonly documentKind: string;
  readonly documentNumber: string;
  readonly plate: string;
}

export interface FlowState {
  readonly step: Step;
  readonly signed: SignedRequest;
  readonly request: SessionRequest;
  readonly requestState: RequestState;
  readonly subject: Subject;
  readonly consented: readonly string[];
  readonly issuer: IssuerIdentity | undefined;
  readonly results: AttestedResults | undefined;
  readonly answers: readonly AttestedAnswer[] | undefined;
  // Why each source did or did not answer. Read by the degradation screen so
  // that "no respondió" and "no tiene el dato" stop looking the same.
  readonly sourceStates: readonly SourceState[];
  readonly error: string | undefined;
  readonly busy: boolean;
  // When the person shared the answer: the moment the counterparty receives it.
  readonly sharedAt: number | undefined;
  // When the person turned the request down. Nothing is consulted or sent after it.
  readonly declinedAt: number | undefined;
  // Every request answered or declined on this phone, newest first. Survives reset.
  readonly history: readonly HistoryEntry[];
}

const now = () => Math.floor(Date.now() / 1000);

function initial(): FlowState {
  const signed = demoRequest(now());
  return {
    step: "request",
    signed,
    request: signed.request,
    requestState: readRequest(signed, DEMO_COUNTERPARTY, now()),
    subject: { documentKind: "CC", documentNumber: "", plate: "" },
    consented: [],
    issuer: undefined,
    results: undefined,
    answers: undefined,
    sourceStates: [],
    error: undefined,
    busy: false,
    sharedAt: undefined,
    declinedAt: undefined,
    history: [],
  };
}

let state = initial();
const listeners = new Set<() => void>();

function set(next: Partial<FlowState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function useFlow(): FlowState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
}

export function setSubject(subject: Partial<Subject>): void {
  set({ subject: { ...state.subject, ...subject } });
}

export function toggleConsent(source: string): void {
  const on = state.consented.includes(source);
  // Choosing a source is changing one's mind: the request is no longer declined.
  set({ consented: on ? state.consented.filter((s) => s !== source) : [...state.consented, source], declinedAt: undefined });
}

export function setConsent(sources: readonly string[]): void {
  set({ consented: [...sources], declinedAt: undefined });
}

export function goTo(step: Step): void {
  set({ step });
}

function record(outcome: Outcome, at: number): readonly HistoryEntry[] {
  const history = addEntry(state.history, { outcome, purpose: state.request.purpose, at });
  void saveHistory(history).catch((error: unknown) => console.warn("history write failed", error));
  return history;
}

export function share(): void {
  const at = now();
  set({ step: "sent", sharedAt: at, history: record("shared", at) });
}

export function decline(): void {
  const at = now();
  set({ declinedAt: at, consented: [], history: record("declined", at) });
}

// Reads the stored history once at launch; entries recorded meanwhile stay first.
export async function hydrateHistory(): Promise<void> {
  const stored = await loadHistory();
  set({ history: [...state.history, ...stored].slice(0, HISTORY_LIMIT) });
}

export function reset(): void {
  state = { ...initial(), history: state.history };
  for (const listener of listeners) listener();
}

// The one call that leaves the phone during a verification, and it goes to the
// issuer — never to a registry. What comes back is verified here before any
// screen renders it.
export async function issue(): Promise<void> {
  if (state.busy) return;
  // The finality follows what was authorised: a request signed for a vehicle
  // sale is re-signed as an identity check when RUNT and SIMIT were left out.
  const purpose = purposeFor(state.consented);
  if (purpose !== state.request.purpose) {
    const signed = demoRequest(now(), purpose);
    set({ signed, request: signed.request, requestState: readRequest(signed, DEMO_COUNTERPARTY, now()) });
  }
  set({ busy: true, error: undefined, step: "issuing" });

  const issuer = state.issuer ?? (await fetchIssuer());
  if (issuer === undefined) {
    set({ busy: false, error: "No encontramos al emisor. No se consultó ninguna fuente.", step: "consent" });
    return;
  }

  const outcome = await requestIssuance({
    documentKind: state.subject.documentKind,
    documentNumber: state.subject.documentNumber,
    plate: state.subject.plate === "" ? undefined : state.subject.plate,
    consented: state.consented,
    request: state.request,
  });

  if (outcome.status === "failed") {
    set({ busy: false, error: outcome.reason, issuer, step: "consent" });
    return;
  }

  const verified = verifyIssued(outcome.results, issuer, state.request, now());
  if (verified.status === "invalid") {
    set({
      busy: false,
      issuer,
      error: "Las respuestas no venían firmadas por el emisor que esperábamos. No se muestran.",
      step: "consent",
    });
    return;
  }

  set({
    busy: false,
    issuer,
    results: outcome.results,
    answers: verified.answers,
    sourceStates: outcome.sourceStates,
    step: "review",
  });
}
