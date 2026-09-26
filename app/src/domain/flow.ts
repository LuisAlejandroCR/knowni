// flow.ts: the state of one verification, from request to answer.
// A single store the screens read, so the step a person is on is a fact of the
// system and not something each screen guesses.

import { useSyncExternalStore } from "react";
import type { AttestedAnswer, AttestedResults, SignedRequest } from "@knowni/attestation";
import type { SessionRequest } from "@knowni/core";
import { demoRequest } from "./demo-issuer.ts";
import {
  fetchIssuer,
  paymentAmount,
  requestPaidIssuance,
  requestQuote,
  sourcePredicates,
  verifyIssued,
  type IssuerIdentity,
  type SourceState,
} from "./issuer-client.ts";
import { paymentReasonText } from "./payment-reason.ts";
import { connectedWallet } from "./wallet-session.ts";
import { readRequest, type RequestState } from "./wallet.ts";
import { purposeFor } from "./purpose.ts";
import { DEMO_COUNTERPARTY } from "./demo-issuer.ts";

export type Step = "request" | "consent" | "issuing" | "review" | "sent";

// Where an issuance is: reading the price, signing and sending the payment,
// or querying the sources once the network accepted it.
export type Phase = "quoting" | "paying" | "querying";

// What the consent screen shows on its button, before anything is signed.
export type QuoteView =
  | { readonly status: "loading" }
  | { readonly status: "quoted"; readonly paymentRequired: boolean; readonly amount: string | undefined }
  | { readonly status: "failed"; readonly reason: string };

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
  readonly phase: Phase | undefined;
  readonly quote: QuoteView | undefined;
  // The hash of the payment the network accepted for this verification.
  readonly paymentTx: string | undefined;
  // When the person shared the answer: the moment the counterparty receives it.
  readonly sharedAt: number | undefined;
  // When the person turned the request down. Nothing is consulted or sent after it.
  readonly declinedAt: number | undefined;
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
    phase: undefined,
    quote: undefined,
    paymentTx: undefined,
    sharedAt: undefined,
    declinedAt: undefined,
  };
}

let state = initial();
const listeners = new Set<() => void>();

function set(next: Partial<FlowState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function subscribeFlow(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getFlow(): FlowState {
  return state;
}

export function useFlow(): FlowState {
  return useSyncExternalStore(subscribeFlow, getFlow, getFlow);
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

export function share(): void {
  set({ step: "sent", sharedAt: now() });
}

export function decline(): void {
  set({ declinedAt: now(), consented: [] });
}

export function reset(): void {
  state = initial();
  for (const listener of listeners) listener();
}

// The price of what is consented, read before anything is signed. A later
// answer for an older consent is dropped rather than shown on the button.
export async function loadQuote(): Promise<void> {
  const consented = state.consented;
  set({ quote: { status: "loading" } });
  const quoted = await requestQuote(state.request, sourcePredicates(consented));
  if (state.consented !== consented) return;
  set({
    quote:
      quoted.status === "failed"
        ? { status: "failed", reason: quoted.reason }
        : {
            status: "quoted",
            paymentRequired: quoted.paymentRequired,
            amount: quoted.payment === undefined ? undefined : paymentAmount(quoted.payment),
          },
  });
}

// The calls that leave the phone during a verification go to the issuer and,
// when it charges, to Stellar — never to a registry. What comes back is verified here before any
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
  set({ busy: true, error: undefined, step: "issuing", phase: "quoting", paymentTx: undefined });

  const issuer = state.issuer ?? (await fetchIssuer());
  if (issuer === undefined) {
    set({ busy: false, phase: undefined, error: "No encontramos al emisor. No se consultó ninguna fuente.", step: "consent" });
    return;
  }

  // Quote, pay if the issuer charges, and only then issue: a payment that is
  // not signed or not accepted never reaches a source (P9, J4).
  const outcome = await requestPaidIssuance(
    {
      documentKind: state.subject.documentKind,
      documentNumber: state.subject.documentNumber,
      plate: state.subject.plate === "" ? undefined : state.subject.plate,
      consented: state.consented,
      request: state.request,
    },
    connectedWallet()?.wallet,
    { onProgress: (progress) => set(progress.phase === "paying" ? { phase: "paying" } : { phase: "querying", paymentTx: progress.paymentTx }) },
  );

  if (outcome.status === "failed") {
    set({ busy: false, phase: undefined, error: failureText(outcome), issuer, step: "consent", paymentTx: outcome.paymentTx });
    return;
  }

  const verified = verifyIssued(outcome.results, issuer, state.request, now());
  if (verified.status === "invalid") {
    set({
      busy: false,
      phase: undefined,
      issuer,
      error: "Las respuestas no venían firmadas por el emisor que esperábamos. No se muestran.",
      step: "consent",
    });
    return;
  }

  set({
    busy: false,
    phase: undefined,
    issuer,
    paymentTx: outcome.paymentTx,
    results: outcome.results,
    answers: verified.answers,
    sourceStates: outcome.sourceStates,
    step: "review",
  });
}

// What a failed issuance tells the person, by the stage it stopped at. Before
// the payment is accepted nothing was charged and no source was queried.
function failureText(outcome: { readonly stage: "quote" | "payment" | "issuance"; readonly reason: string; readonly paymentTx?: string }): string {
  if (outcome.stage === "quote") return `${outcome.reason} No se consultó ninguna fuente.`;
  if (outcome.stage === "payment") {
    const lead =
      outcome.reason === "wallet_not_connected"
        ? "Conecta tu wallet para pagar la consulta."
        : paymentReasonText(outcome.reason);
    // Horizon out of reach after sending is the one case where the payment may
    // have landed: the screen does not claim otherwise.
    return outcome.reason === "unreachable"
      ? `${lead} No se consultó ninguna fuente.`
      : `${lead} No se cobró nada y no se consultó ninguna fuente.`;
  }
  return outcome.paymentTx === undefined
    ? outcome.reason
    : `${outcome.reason} El pago sí fue aceptado por la red: ${outcome.paymentTx.slice(0, 8)}…${outcome.paymentTx.slice(-8)}.`;
}
