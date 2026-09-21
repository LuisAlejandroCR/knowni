// wallet.ts: what the phone actually does with a request.
// Reads the counterparty's signed request, refuses what does not fit, and keeps
// the credential — claim and salt — on the device.

import type { AttestedAnswer, AttestedResults, SignedRequest } from "@knowni/attestation";
import { verifyRequest, verifyResults } from "@knowni/attestation";
import type { SessionRequest } from "@knowni/core";
import { appHash, appSignatures } from "./crypto.ts";
import { DEMO_ISSUER, demoRegistry } from "./demo-issuer.ts";

export type RequestState =
  | { readonly status: "ok"; readonly request: SessionRequest }
  | { readonly status: "refused"; readonly reason: string; readonly explanation: string };

// The vocabulary the screens render. A person reads this, so each reason says
// what happened and what they can do, never a code.
const EXPLANATION: Record<string, string> = {
  wrong_audience: "Esta solicitud no venía dirigida a ti. No respondas.",
  unknown_relying_party: "No reconocemos a quien pregunta. No se consultó ninguna fuente.",
  bad_signature: "La solicitud fue alterada después de firmarse.",
  invalid_purpose: "La finalidad no es válida, así que no se puede mostrar qué estás aceptando.",
  session_expired: "La ventana se cerró. Pide una solicitud nueva.",
};

export function readRequest(signed: SignedRequest, audience: string, nowUnix: number): RequestState {
  const result = verifyRequest(appSignatures, demoRegistry(), signed, audience, nowUnix);
  if (result.status === "accepted") return { status: "ok", request: signed.request };
  return {
    status: "refused",
    reason: result.reason,
    explanation: EXPLANATION[result.reason] ?? "No podemos responder esta solicitud.",
  };
}

// What the subject is about to hand over, checked on the phone before it is
// shown: a screen that displays answers it has not verified is a screen that
// can be lied to.
export function readAnswers(
  results: AttestedResults,
  request: SessionRequest,
  nowUnix: number,
): readonly AttestedAnswer[] | undefined {
  const verified = verifyResults(appHash, results, {
    signatures: appSignatures,
    registry: demoRegistry(),
    request,
    nowUnix,
  });
  return verified.status === "valid" ? verified.answers : undefined;
}

export { DEMO_ISSUER };
