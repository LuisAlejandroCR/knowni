// session.ts: one demo session, built and verified on the device.
// The screens read from here, so what they render has been through the real
// verification and not around it.

import type { AttestedAnswer, AttestedResults, SignedRequest } from "@knowni/attestation";
import type { SessionRequest } from "@knowni/core";
import type { SourceStateName } from "./issuer-client.ts";
import { DEMO_COUNTERPARTY, demoRequest, demoResults } from "./demo-issuer.ts";
import { readAnswers, readRequest, type RequestState } from "./wallet.ts";

// The answers this demo's issuer is willing to sign. Each carries what it does
// NOT say, because a counterparty reading "sin registro" as "tiene capacidad"
// is the misreading the product exists to prevent.
const ANSWERS: readonly AttestedAnswer[] = [
  {
    predicate: "personhood",
    value: true,
    source: "registraduria",
    provenance: "observed",
    doesNotEstimate: "No dice quién es, ni su edad, ni su domicilio.",
  },
  {
    predicate: "capacity",
    value: true,
    source: "sicaac",
    provenance: "observed",
    doesNotEstimate: "No afirma capacidad jurídica universal, solo ausencia de insolvencia.",
  },
  {
    predicate: "sanctions",
    value: true,
    source: "procuraduria+contraloria+contaduria",
    provenance: "observed",
    doesNotEstimate: "Solo las listas solicitadas, en la fecha consultada.",
  },
  {
    predicate: "assetStanding",
    value: "unavailable",
    source: "runt+simit",
    provenance: "observed",
    doesNotEstimate: "Sin respuesta de la fuente. No es un resultado negativo.",
  },
];

export interface DemoSession {
  readonly signed: SignedRequest;
  readonly request: SessionRequest;
  readonly state: RequestState;
  readonly results: AttestedResults;
  // Undefined when verification failed — the screen then shows nothing rather
  // than showing an answer it could not check.
  readonly answers: readonly AttestedAnswer[] | undefined;
}

let session: DemoSession | undefined;

export function currentSession(nowUnix = Math.floor(Date.now() / 1000)): DemoSession {
  if (session !== undefined) return session;
  const signed = demoRequest(nowUnix);
  const state = readRequest(signed, DEMO_COUNTERPARTY, nowUnix);
  const results = demoResults(signed.request, ANSWERS, nowUnix);
  session = {
    signed,
    request: signed.request,
    state,
    results,
    answers: readAnswers(results, signed.request, nowUnix),
  };
  return session;
}

// Spanish labels for the predicates, kept out of the domain: core must not know
// what a person reads on a screen.
export const PREDICATE_LABEL: Record<string, string> = {
  personhood: "Documento vigente",
  capacity: "Sin registro de insolvencia",
  sanctions: "Sin coincidencias en listas",
  assetStanding: "Estado del vehículo",
};

// A7 asks that a missing answer say which kind of missing it is. These are the
// exact words a person reads, and none of them is a verdict about them: a
// source that did not answer and a register with no record are different
// facts, and neither is "no cumple".
export const SOURCE_STATE_TEXT: Record<SourceStateName, string> = {
  answered: "Respondió",
  not_found: "El registro no tiene ese dato",
  degraded: "La fuente no respondió a tiempo",
  failed: "La fuente respondió algo que no pudimos usar",
  consent_missing: "No lo autorizaste, así que no se consultó",
  needs_human_review: "Necesita revisión de una persona",
};

// Whether the person can do something about it, which is what decides the
// button under the message. A register with no record is not a retry.
export const RETRYABLE_STATES: readonly SourceStateName[] = ["degraded", "failed"];

export function sourceStateText(state: SourceStateName): string {
  return SOURCE_STATE_TEXT[state];
}

export function answerText(answer: AttestedAnswer): string {
  if (answer.value === "unavailable") return "Sin respuesta";
  if (answer.value === true) return "Sí";
  if (answer.value === false) return "No";
  return String(answer.value);
}
