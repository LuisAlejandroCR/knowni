// delegation.ts: a subject's signed permission for one agent to present on its behalf.
// It names the agent, the purpose, the counterparty and a window; it never carries the
// subject secret, a claim or a salt, so holding one is not holding a credential.

import { fromHex, isPurpose, lengthPrefixed, toHex, u64be, utf8, type Purpose } from "@knowni/core";
import type { SignaturePort } from "./signing.ts";

const DELEGATION_DOMAIN = "knowni/delegation/v1";
const KEY_HEX = /^[0-9a-f]{64}$/;
const ID_HEX = /^[0-9a-f]{32,64}$/;

export interface DelegationBody {
  readonly id: string; // hex, fresh per delegation; what revocation names
  readonly subjectKey: string; // hex ed25519 public key of the device's delegation key
  readonly agentKey: string; // hex ed25519 public key of the agent
  readonly purpose: Purpose;
  readonly relyingPartyId: string;
  readonly notBefore: number; // unix seconds
  readonly expiresAt: number; // unix seconds
}

export interface Delegation extends DelegationBody {
  readonly algorithm: "ed25519";
  readonly signature: string; // hex
}

export interface DelegationContext {
  readonly nowUnix: number;
  readonly agentKey: string;
  readonly purpose: Purpose;
  readonly relyingPartyId: string;
}

export type DelegationFailure =
  | "malformed"
  | "bad_signature"
  | "not_yet_valid"
  | "expired"
  | "agent_mismatch"
  | "purpose_mismatch"
  | "relying_party_mismatch";

export type DelegationCheck =
  | { readonly status: "valid"; readonly delegationId: string }
  | { readonly status: "invalid"; readonly reason: DelegationFailure };

export function delegationBytes(body: DelegationBody): Uint8Array {
  return lengthPrefixed([
    utf8(DELEGATION_DOMAIN),
    fromHex(body.id),
    fromHex(body.subjectKey),
    fromHex(body.agentKey),
    utf8(body.purpose),
    utf8(body.relyingPartyId),
    u64be(body.notBefore),
    u64be(body.expiresAt),
  ]);
}

const isText = (value: unknown): value is string => typeof value === "string";

// Delegations arrive from outside the process, so every field is checked for its
// type before its shape: a refusal is typed, never an exception.
function wellFormed(body: DelegationBody): boolean {
  if (typeof body !== "object" || body === null) return false;
  const fields = [body.id, body.subjectKey, body.agentKey, body.purpose, body.relyingPartyId];
  if (!fields.every(isText)) return false;
  return (
    ID_HEX.test(body.id) &&
    KEY_HEX.test(body.subjectKey) &&
    KEY_HEX.test(body.agentKey) &&
    isPurpose(body.purpose) &&
    body.relyingPartyId.length > 0 &&
    body.relyingPartyId.length <= 128 &&
    Number.isSafeInteger(body.notBefore) &&
    Number.isSafeInteger(body.expiresAt) &&
    body.notBefore >= 0 &&
    body.expiresAt > body.notBefore
  );
}

export function signDelegation(signatures: SignaturePort, subjectSeed: Uint8Array, body: DelegationBody): Delegation {
  if (!wellFormed(body)) throw new TypeError("malformed delegation");
  if (toHex(signatures.publicKeyOf(subjectSeed)) !== body.subjectKey) {
    throw new TypeError("delegation key does not match its seed");
  }
  return { ...body, algorithm: "ed25519", signature: toHex(signatures.sign(subjectSeed, delegationBytes(body))) };
}

// The signature is checked before any field is compared, so a forged delegation
// is `bad_signature` whatever else it claims. Only then is the context matched.
export function checkDelegation(
  signatures: SignaturePort,
  delegation: Delegation,
  context: DelegationContext,
): DelegationCheck {
  if (
    !wellFormed(delegation) ||
    delegation.algorithm !== "ed25519" ||
    !isText(delegation.signature) ||
    !/^[0-9a-f]{128}$/.test(delegation.signature)
  ) {
    return { status: "invalid", reason: "malformed" };
  }
  const signed = signatures.verify(
    fromHex(delegation.subjectKey),
    delegationBytes(delegation),
    fromHex(delegation.signature),
  );
  if (!signed) return { status: "invalid", reason: "bad_signature" };
  if (context.nowUnix < delegation.notBefore) return { status: "invalid", reason: "not_yet_valid" };
  if (context.nowUnix > delegation.expiresAt) return { status: "invalid", reason: "expired" };
  if (context.agentKey !== delegation.agentKey) return { status: "invalid", reason: "agent_mismatch" };
  if (context.purpose !== delegation.purpose) return { status: "invalid", reason: "purpose_mismatch" };
  if (context.relyingPartyId !== delegation.relyingPartyId) return { status: "invalid", reason: "relying_party_mismatch" };
  return { status: "valid", delegationId: delegation.id };
}
