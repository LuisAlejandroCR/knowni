// flow.ts: the state of one verification, from request to answer.
// A single store the screens read, so the step a person is on is a fact of the
// system and not something each screen guesses.

import { useSyncExternalStore } from "react";
import type { AttestedAnswer, AttestedResults, SignedRequest } from "@knowni/attestation";
import type { SessionRequest } from "@knowni/core";
import { demoRequest } from "./demo-issuer.ts";
import {
  fetchIssuer,
  predicatesFor,
  requestPaidIssuance,
  requestQuote,
  verifyIssued,
  type IssuerIdentity,
  type PaidIssuanceOptions,
  type SourceState,
} from "./issuer-client.ts";
import { paymentReasonText, type Price } from "./payment-text.ts";
import { walletSession } from "./wallet-session.ts";
import { readRequest, type RequestState } from "./wallet.ts";
import { purposeFor } from "./purpose.ts";
import { DEMO_COUNTERPARTY } from "./demo-issuer.ts";

export type Step = "request" | "consent" | "issuing" | "review" | "sent";

// Where an issuance is while the person waits: asking the price, signing the
// payment, or querying the sources once the network accepted it.
export type IssuingStage = "quoting" | "paying" | "querying";

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
  // What /quote said the consulted sources cost, for the consent button.
  readonly price: Price | undefined;
  readonly stage: IssuingStage | undefined;
  // The Stellar hash of the accepted payment, kept until the journey resets.
  readonly paymentTx: string | undefined;
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
    price: undefined,
    stage: undefined,
    paymentTx: undefined,
  };
}

let state = initial();
const listeners = new Set<() => void>();

function set(next: Partial<FlowState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function flowState(): FlowState {
  return state;
}

export function subscribeFlow(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFlow(): FlowState {
  return useSyncExternalStore(subscribeFlow, flowState, flowState);
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

// The price of what is ticked, asked again whenever the ticks change. Only the
// latest answer lands, so a slow quote for an older choice cannot overwrite it.
let quoteSeq = 0;
export async function refreshQuote(options: Pick<PaidIssuanceOptions, "baseUrl" | "fetchImpl"> = {}): Promise<void> {
  const seq = ++quoteSeq;
  const predicates = predicatesFor(state.consented);
  if (predicates.length === 0) {
    set({ price: undefined });
    return;
  }
  const quoted = await requestQuote(state.request, predicates, options.baseUrl, options.fetchImpl);
  if (seq !== quoteSeq) return;
  if (quoted.status === "failed") {
    set({ price: undefined });
    return;
  }
  const payment = quoted.payment;
  set({
    price:
      quoted.paymentRequired && payment !== undefined
        ? {
            paymentRequired: true,
            amountStroops: payment.amountStroops,
            asset: payment.asset.type === "native" ? "XLM" : payment.asset.code,
          }
        : { paymentRequired: false },
  });
}

// The calls that leave the phone during a verification go to the issuer and,
// when it charges, to Stellar — never to a registry. The payment is accepted by
// the network before the issuer queries anything, and what comes back is
// verified here before any screen renders it.
export async function issue(options: PaidIssuanceOptions = {}): Promise<void> {
  if (state.busy) return;
  // The finality follows what was authorised: a request signed for a vehicle
  // sale is re-signed as an identity check when RUNT and SIMIT were left out.
  const purpose = purposeFor(state.consented);
  if (purpose !== state.request.purpose) {
    const signed = demoRequest(now(), purpose);
    set({ signed, request: signed.request, requestState: readRequest(signed, DEMO_COUNTERPARTY, now()) });
  }
  set({ busy: true, error: undefined, step: "issuing", stage: "quoting", paymentTx: undefined });

  const issuer = state.issuer ?? (await fetchIssuer(options.baseUrl, options.fetchImpl));
  if (issuer === undefined) {
    set({ busy: false, stage: undefined, error: "No encontramos al emisor. No se consultó ninguna fuente.", step: "consent" });
    return;
  }

  const outcome = await requestPaidIssuance(
    {
      documentKind: state.subject.documentKind,
      documentNumber: state.subject.documentNumber,
      plate: state.subject.plate === "" ? undefined : state.subject.plate,
      consented: state.consented,
      request: state.request,
    },
    walletSession(),
    { ...options, onStage: (stage, paymentTx) => set({ stage, paymentTx }) },
  );

  if (outcome.status === "failed") {
    const reason =
      outcome.stage === "payment"
        ? `${paymentReasonText(outcome.reason)} No se consultó ninguna fuente.`
        : outcome.reason;
    set({ busy: false, stage: undefined, error: reason, issuer, step: "consent" });
    return;
  }

  const verified = verifyIssued(outcome.results, issuer, state.request, now());
  if (verified.status === "invalid") {
    set({
      busy: false,
      stage: undefined,
      issuer,
      error: "Las respuestas no venían firmadas por el emisor que esperábamos. No se muestran.",
      step: "consent",
    });
    return;
  }

  set({
    busy: false,
    stage: undefined,
    issuer,
    results: outcome.results,
    answers: verified.answers,
    sourceStates: outcome.sourceStates,
    paymentTx: outcome.paymentTx,
    step: "review",
  });
}
