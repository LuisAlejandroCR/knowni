// verifier.ts: the counterparty's side, on the device.
// Runs the real acceptance — request, binding, evidence, revocation — and turns
// its outcome into something a person can read without a code.

import type { AttestedResults, NullifierLedger, NullifierStore, RevocationState, SignedRequest } from "@knowni/attestation";
import { acceptAnswer, createPersistentNullifierLedger } from "@knowni/attestation";
import type { Disclosure, SessionRequest } from "@knowni/core";
import { deriveNullifier, sessionId, SolvencyTier } from "@knowni/core";
import { appHash, appSignatures } from "./crypto.ts";
import { demoRegistry } from "./demo-issuer.ts";

export type RevocationSetting = "live" | "stale" | "unknown" | "revoked";

const STATE: Record<RevocationSetting, (now: number) => RevocationState> = {
  live: (now) => ({ status: "live", checkedAt: now - 60 }),
  stale: (now) => ({ status: "live", checkedAt: now - 90_000 }),
  unknown: () => ({ status: "unknown" }),
  revoked: (now) => ({ status: "revoked", checkedAt: now - 30 }),
};

// The counterparty's own spent set, read off the device at start-up so it
// survives a restart — D-34, D-36. Undefined until `hydrateLedger` lands: a
// ledger that has not read its history cannot tell a replay from a first
// presentation, so nothing is accepted against it.
let ledger: NullifierLedger | undefined;

// Called once at start-up, like `installPlatformCrypto`. The store arrives as
// an argument so this module never imports a native module and stays testable
// under plain Node.
export async function hydrateLedger(
  store: NullifierStore,
  onWriteError?: (error: unknown) => void,
): Promise<void> {
  ledger = await createPersistentNullifierLedger(store, {
    onWriteError: (error) => onWriteError?.(error),
  });
}

export function ledgerReady(): boolean {
  return ledger !== undefined;
}

export interface VerificationView {
  readonly accepted: boolean;
  readonly idempotent: boolean;
  readonly headline: string;
  readonly explanation: string;
  // What the acceptance was qualified by — an unknown or stale revocation —
  // so the screen can show it instead of a plain green tick.
  readonly notes: readonly string[];
}

const REFUSAL: Record<string, string> = {
  wrong_audience: "Esta respuesta no venía dirigida a ti.",
  unknown_relying_party: "No estás en el registro que el titular reconoce.",
  bad_signature: "La solicitud fue alterada después de firmarse.",
  invalid_purpose: "La finalidad no es válida.",
  session_expired: "La ventana se cerró antes de recibir la respuesta.",
  session_mismatch: "La respuesta no corresponde a esta solicitud.",
  results_unauthenticated: "Las respuestas no están firmadas por un emisor que aceptes.",
  replayed: "Esta respuesta ya se usó. No sirve dos veces.",
  revocation_unknown: "No sabemos si la credencial sigue vigente, y tu política exige saberlo.",
  revocation_stale: "El estado de revocación es viejo, y tu política exige uno reciente.",
  revoked: "El emisor retiró esta raíz.",
};

const NOTE: Record<string, string> = {
  revocation_unknown: "Aceptada sin estado de revocación. Quedó registrado.",
  revocation_stale: "Aceptada con un estado de revocación viejo. Quedó registrado.",
};

export function disclosureFor(request: SessionRequest, nowUnix: number): Disclosure {
  const session = sessionId(appHash, request);
  return {
    sessionId: session,
    relyingPartyId: request.relyingPartyId,
    purpose: request.purpose,
    decidedAt: nowUnix,
    personhood: true,
    solvency: SolvencyTier.NONE,
    formality: true,
    standing: true,
    // The demo profile is a vehicle sale, and these are the two answers it
    // turns on: the seller's capacity and the car's standing.
    capacity: true,
    assetStanding: true,
    issuerRoots: ["f".repeat(64)],
    nullifier: deriveNullifier(appHash, { hex: "5".repeat(64) }, session),
  };
}

// Strict refuses anything it cannot confirm; tolerant accepts and records the
// doubt. Which one applies is the counterparty's call, not the product's.
export type PolicySetting = "strict" | "tolerant";

export function verifyOnDevice(
  signed: SignedRequest,
  results: AttestedResults,
  presentationId: string,
  revocation: RevocationSetting,
  policy: PolicySetting,
  nowUnix: number,
): VerificationView {
  // Refused, not accepted: without the spent set an answer already used could
  // pass as new, and "no lo sabemos todavía" never becomes "sí".
  if (ledger === undefined) {
    return {
      accepted: false,
      idempotent: false,
      headline: "No se puede aceptar todavía",
      explanation: "El registro de respuestas ya usadas aún no se ha leído del dispositivo.",
      notes: [],
    };
  }

  const outcome = acceptAnswer(appHash, {
    signatures: appSignatures,
    signedRequest: signed,
    audience: signed.request.relyingPartyId,
    disclosure: disclosureFor(signed.request, nowUnix),
    results,
    presentationId,
    registry: demoRegistry(),
    ledger,
    revocation: { stateOf: () => STATE[revocation](nowUnix) },
    policy: {
      maxSnapshotAgeSeconds: 3_600,
      onUnknown: policy === "strict" ? "refuse" : "accept_with_note",
    },
    nowUnix,
    issuerRoot: "f".repeat(64),
    requiredPredicates: ["personhood", "capacity"],
  });

  if (outcome.status === "refused") {
    return {
      accepted: false,
      idempotent: false,
      headline: "No se puede aceptar",
      explanation: REFUSAL[outcome.reason] ?? "La respuesta no pasó la verificación.",
      notes: [],
    };
  }
  return {
    accepted: true,
    idempotent: outcome.idempotent,
    headline: outcome.idempotent ? "Ya recibida" : "Respuestas verificadas",
    explanation: outcome.idempotent
      ? "Es la misma respuesta que ya aceptaste. No cuenta dos veces."
      : "Firma, destinatario y evidencia comprobados en este dispositivo.",
    notes: outcome.notes.map((note) => NOTE[note] ?? note),
  };
}
