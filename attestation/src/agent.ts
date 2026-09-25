// agent.ts: an answer presented by an agent on the subject's behalf.
// The device builds the presentation and endorses it for one delegation; the agent only
// signs it on. The counterparty learns that an authorized agent presented it, and no more.

import type { Disclosure, FieldHash } from "@knowni/core";
import { fromHex, lengthPrefixed, toHex, utf8 } from "@knowni/core";
import type { SignaturePort } from "./signing.ts";
import type { AttestedResults } from "./results.ts";
import { containsHeldSecrets } from "./results.ts";
import type { Delegation, DelegationFailure } from "./delegation.ts";
import { checkDelegation } from "./delegation.ts";
import type { Acceptance, AcceptanceFailure, AcceptanceInput, RevocationPolicy, RevocationState } from "./acceptance.ts";
import { acceptAnswer } from "./acceptance.ts";

const ENDORSEMENT_DOMAIN = "knowni/agent-endorsement/v1";
const PRESENTATION_DOMAIN = "knowni/agent-presentation/v1";
const SIGNATURE_HEX = /^[0-9a-f]{128}$/;

// What crosses from the device to the agent: answers already built, never the
// subject secret, a claim or a salt.
export interface AgentBundle {
  readonly disclosure: Disclosure;
  readonly results: AttestedResults;
  readonly delegation: Delegation;
  // The delegation key's signature over this delegation, this session and this
  // nullifier: the agent cannot move the delegation to another answer.
  readonly endorsement: string; // hex
}

export interface AgentPresentation extends AgentBundle {
  readonly presentationId: string;
  readonly agentSignature: string; // hex
}

const endorsementBytes = (delegationId: string, disclosure: Disclosure): Uint8Array =>
  lengthPrefixed([utf8(ENDORSEMENT_DOMAIN), fromHex(delegationId), utf8(disclosure.sessionId), utf8(disclosure.nullifier)]);

const presentationBytes = (bundle: AgentBundle, presentationId: string): Uint8Array =>
  lengthPrefixed([
    utf8(PRESENTATION_DOMAIN),
    fromHex(bundle.delegation.id),
    fromHex(bundle.endorsement),
    utf8(bundle.disclosure.sessionId),
    utf8(presentationId),
  ]);

export function prepareForAgent(
  signatures: SignaturePort,
  delegationSeed: Uint8Array,
  input: { readonly disclosure: Disclosure; readonly results: AttestedResults; readonly delegation: Delegation },
): AgentBundle {
  if (toHex(signatures.publicKeyOf(delegationSeed)) !== input.delegation.subjectKey) {
    throw new TypeError("delegation key does not match the delegation");
  }
  if (input.disclosure.relyingPartyId !== input.delegation.relyingPartyId || input.disclosure.purpose !== input.delegation.purpose) {
    throw new TypeError("disclosure is outside the delegation");
  }
  const bundle: AgentBundle = {
    disclosure: input.disclosure,
    results: input.results,
    delegation: input.delegation,
    endorsement: toHex(signatures.sign(delegationSeed, endorsementBytes(input.delegation.id, input.disclosure))),
  };
  if (containsHeldSecrets(bundle)) throw new TypeError("a held secret would reach the agent");
  return bundle;
}

export function presentAsAgent(
  signatures: SignaturePort,
  agentSeed: Uint8Array,
  bundle: AgentBundle,
  presentationId: string,
): AgentPresentation {
  return { ...bundle, presentationId, agentSignature: toHex(signatures.sign(agentSeed, presentationBytes(bundle, presentationId))) };
}

// Same three answers as a credential's revocation, and the same policy decides
// what `unknown` means.
export interface DelegationRevocationOracle {
  stateOf(delegationId: string): RevocationState;
}

export type AgentAcceptanceFailure =
  | AcceptanceFailure
  | DelegationFailure
  | "bad_endorsement"
  | "bad_agent_signature"
  | "delegation_revoked"
  | "delegation_revocation_unknown"
  | "delegation_revocation_stale";

// The only thing added to an ordinary acceptance: who presented, as a category.
// No agent key, no delegation id — the counterparty needs neither to decide.
export interface AgentAcceptance extends Acceptance {
  readonly presentedBy: "authorized_agent";
}

export type AgentAcceptanceResult =
  | AgentAcceptance
  | { readonly status: "refused"; readonly reason: AgentAcceptanceFailure };

export interface AgentAcceptanceInput
  extends Omit<AcceptanceInput, "disclosure" | "results" | "presentationId"> {
  readonly presentation: AgentPresentation;
  readonly delegationRevocation?: DelegationRevocationOracle;
  readonly delegationPolicy: RevocationPolicy;
}

const verifyHex = (signatures: SignaturePort, key: string, message: Uint8Array, signature: unknown): boolean =>
  typeof signature === "string" && SIGNATURE_HEX.test(signature) && signatures.verify(fromHex(key), message, fromHex(signature));

export function acceptAgentAnswer(h: FieldHash, input: AgentAcceptanceInput): AgentAcceptanceResult {
  const { presentation } = input;
  if (typeof presentation !== "object" || presentation === null || typeof presentation.presentationId !== "string") {
    return { status: "refused", reason: "malformed" };
  }
  const request = input.signedRequest.request;

  // 1. The delegation, in this request's context.
  const agentKey = typeof presentation.delegation?.agentKey === "string" ? presentation.delegation.agentKey : "";
  const delegation = checkDelegation(input.signatures, presentation.delegation, {
    nowUnix: input.nowUnix,
    agentKey,
    purpose: request.purpose,
    relyingPartyId: input.audience,
  });
  if (delegation.status === "invalid") return { status: "refused", reason: delegation.reason };

  // 2. The device endorsed this answer for this delegation, and the agent signed it on.
  const disclosure = presentation.disclosure;
  if (typeof disclosure?.sessionId !== "string" || typeof disclosure.nullifier !== "string") {
    return { status: "refused", reason: "malformed" };
  }
  const endorsed = verifyHex(
    input.signatures,
    presentation.delegation.subjectKey,
    endorsementBytes(presentation.delegation.id, disclosure),
    presentation.endorsement,
  );
  if (!endorsed) return { status: "refused", reason: "bad_endorsement" };
  const signed = verifyHex(
    input.signatures,
    agentKey,
    presentationBytes(presentation, presentation.presentationId),
    presentation.agentSignature,
  );
  if (!signed) return { status: "refused", reason: "bad_agent_signature" };

  // 3. The delegation is still live, before anything is spent.
  const state = input.delegationRevocation?.stateOf(presentation.delegation.id) ?? { status: "unknown" as const };
  const notes: string[] = [];
  if (state.status === "revoked") return { status: "refused", reason: "delegation_revoked" };
  if (state.status === "unknown") {
    if (input.delegationPolicy.onUnknown === "refuse") return { status: "refused", reason: "delegation_revocation_unknown" };
    notes.push("delegation_revocation_unknown");
  } else {
    const age = input.nowUnix - state.checkedAt;
    if (age < 0 || age > input.delegationPolicy.maxSnapshotAgeSeconds) {
      if (input.delegationPolicy.onUnknown === "refuse") return { status: "refused", reason: "delegation_revocation_stale" };
      notes.push("delegation_revocation_stale");
    }
  }

  // 4. Everything a subject's own answer goes through, on the same ledger.
  const accepted = acceptAnswer(h, {
    ...input,
    disclosure,
    results: presentation.results,
    presentationId: presentation.presentationId,
  });
  if (accepted.status === "refused") return accepted;
  return { ...accepted, notes: [...notes, ...accepted.notes], presentedBy: "authorized_agent" };
}
