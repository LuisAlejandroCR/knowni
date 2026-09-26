// flow.ts: the state of one verification, from request to answer.
// A single store the screens read, so the step a person is on is a fact of the
// system and not something each screen guesses.

import { useSyncExternalStore } from "react";
import type { AttestedAnswer, AttestedResults, SignedRequest } from "@knowni/attestation";
import type { SessionRequest } from "@knowni/core";
import { demoRequest } from "./demo-issuer.ts";
import {
  fetchIssuer,
  predicatesOf,
  requestPaidIssuance,
  requestQuote,
  verifyIssued,
  ISSUER_URL,
  type IssuerIdentity,
  type SourceState,
} from "./issuer-client.ts";
import { PAYMENT_REASON } from "./payment-copy.ts";
import type { PaymentResult } from "./stellar-payment.ts";
import type { PayerWalletPort } from "./wallet-port.ts";
import { currentWalletSession } from "./wallet-session.ts";
import { readRequest, type RequestState } from "./wallet.ts";
import { purposeFor } from "./purpose.ts";
import { DEMO_COUNTERPARTY } from "./demo-issuer.ts";

export type Step = "request" | "consent" | "issuing" | "review" | "sent";

// What issuing is waiting on: the quote, the payer's signature, or the sources.
export type IssueStage = "idle" | "quoting" | "signing" | "querying";

// What /quote said for the sources consented so far. `stroops` is the native
// XLM amount, present only when the issuer charges.
export interface Price {
  readonly paymentRequired: boolean;
  readonly stroops?: string;
}

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
  readonly price: Price | undefined;
  readonly stage: IssueStage;
  // The testnet payment for this issuance. Shown to the person, never part of
  // what the counterparty receives.
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
    stage: "idle",
    paymentTx: undefined,
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

export const flowState = (): FlowState => state;

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

export interface IssueDeps {
  readonly baseUrl?: string;
  readonly horizonUrl?: string;
  readonly fetchImpl?: typeof fetch;
  // Defaults to the wallet connected in /firma.
  readonly wallet?: PayerWalletPort;
}

// Stands in when no wallet is connected: payQuote refuses it as
// `wallet_not_connected`, before Horizon and before /issue.
const NO_WALLET: PayerWalletPort = {
  id: "device",
  label: "Sin wallet",
  signingMethod: "unsupported",
  accountId: async () => undefined,
  connect: async () => undefined,
  signTransaction: async () => undefined,
  disconnect: async () => {},
};

// The price of what is consented right now, for the consent screen's button.
// Display only: issue() quotes again, and pays that quote.
export async function loadPrice(deps: IssueDeps = {}): Promise<void> {
  const consented = state.consented;
  if (consented.length === 0) return set({ price: undefined });
  const quoted = await requestQuote(state.request, predicatesOf(consented), deps.baseUrl ?? ISSUER_URL, deps.fetchImpl);
  if (state.consented !== consented) return;
  set({
    price:
      quoted.status === "quoted"
        ? { paymentRequired: quoted.paymentRequired, stroops: quoted.payment?.amountStroops }
        : undefined,
  });
}

// The one call that leaves the phone during a verification, and it goes to the
// issuer — never to a registry. The quote is paid first when the issuer charges;
// what comes back is verified here before any screen renders it.
export async function issue(deps: IssueDeps = {}): Promise<void> {
  if (state.busy) return;
  // The finality follows what was authorised: a request signed for a vehicle
  // sale is re-signed as an identity check when RUNT and SIMIT were left out.
  const purpose = purposeFor(state.consented);
  if (purpose !== state.request.purpose) {
    const signed = demoRequest(now(), purpose);
    set({ signed, request: signed.request, requestState: readRequest(signed, DEMO_COUNTERPARTY, now()) });
  }
  set({ busy: true, error: undefined, step: "issuing", stage: "quoting", paymentTx: undefined });

  const baseUrl = deps.baseUrl ?? ISSUER_URL;
  const issuer = state.issuer ?? (await fetchIssuer(baseUrl, deps.fetchImpl));
  if (issuer === undefined) {
    set({ busy: false, stage: "idle", error: "No encontramos al emisor. No se consultó ninguna fuente.", step: "consent" });
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
    deps.wallet ?? currentWalletSession()?.wallet ?? NO_WALLET,
    {
      baseUrl,
      horizonUrl: deps.horizonUrl,
      fetchImpl: deps.fetchImpl,
      onStage: (stage, paymentTx) => set({ stage, paymentTx }),
    },
  );

  if (outcome.status === "failed") {
    const reason =
      outcome.stage === "payment"
        ? `${PAYMENT_REASON[outcome.reason as Extract<PaymentResult, { status: "failed" }>["reason"]] ?? "El pago no se completó."} No se consultó ninguna fuente.`
        : outcome.reason;
    set({ busy: false, stage: "idle", error: reason, issuer, step: "consent" });
    return;
  }

  const verified = verifyIssued(outcome.results, issuer, state.request, now());
  if (verified.status === "invalid") {
    set({
      busy: false,
      stage: "idle",
      issuer,
      error: "Las respuestas no venían firmadas por el emisor que esperábamos. No se muestran.",
      step: "consent",
    });
    return;
  }

  set({
    busy: false,
    stage: "idle",
    issuer,
    paymentTx: outcome.paymentTx,
    results: outcome.results,
    answers: verified.answers,
    sourceStates: outcome.sourceStates,
    step: "review",
  });
}
