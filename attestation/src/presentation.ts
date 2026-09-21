// presentation.ts: the relying party's side of one answer. Signs the request it sends, then
// refuses a disclosure that was not built for this audience, this purpose, this challenge — or
// that already arrived.

import type { Disclosure, FieldHash, SessionRequest } from "@knowni/core";
import { fromHex, isExpired, isPurpose, lengthPrefixed, sessionId, toHex, utf8 } from "@knowni/core";
import type { SignaturePort } from "./signing.ts";
import type { IssuerRegistry } from "./types.ts";
import type { AttestedResults } from "./results.ts";
import { verifyResults } from "./results.ts";


const REQUEST_DOMAIN = "knowni/presentation-request/v1";

export interface SignedRequest {
  readonly request: SessionRequest;
  readonly algorithm: "ed25519";
  readonly signature: string; // hex
}

export type PresentationFailure =
  | "wrong_audience"
  | "unknown_relying_party"
  | "bad_signature"
  | "invalid_purpose"
  | "session_expired"
  | "session_mismatch"
  | "results_unauthenticated"
  | "replayed";

export type PresentationResult =
  | { readonly status: "accepted" }
  | { readonly status: "refused"; readonly reason: PresentationFailure };

function requestBytes(request: SessionRequest): Uint8Array {
  return lengthPrefixed([
    utf8(REQUEST_DOMAIN),
    utf8(request.relyingPartyId),
    utf8(request.purpose),
    utf8(request.nonce),
    utf8(String(request.expiresAt)),
    utf8(request.paramsHash),
  ]);
}

export function signRequest(
  signatures: SignaturePort,
  seed: Uint8Array,
  request: SessionRequest,
): SignedRequest {
  return {
    request,
    algorithm: "ed25519",
    signature: toHex(signatures.sign(seed, requestBytes(request))),
  };
}

export function verifyRequest(
  signatures: SignaturePort,
  registry: IssuerRegistry,
  signed: SignedRequest,
  expectedAudience: string,
  nowUnix: number,
): PresentationResult {
  if (signed.request.relyingPartyId !== expectedAudience) {
    return { status: "refused", reason: "wrong_audience" };
  }
  if (!isPurpose(signed.request.purpose)) return { status: "refused", reason: "invalid_purpose" };
  if (isExpired(signed.request, nowUnix)) return { status: "refused", reason: "session_expired" };

  const publicKey = registry.publicKeyOf(signed.request.relyingPartyId);
  if (publicKey === undefined) return { status: "refused", reason: "unknown_relying_party" };

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = fromHex(signed.signature);
  } catch {
    return { status: "refused", reason: "bad_signature" };
  }
  const ok = signatures.verify(publicKey, requestBytes(signed.request), signatureBytes);
  return ok ? { status: "accepted" } : { status: "refused", reason: "bad_signature" };
}

export interface SpentNullifiers {
  has(nullifier: string): boolean;
  remember(nullifier: string): void;
}

export function createMemorySpentSet(initial: readonly string[] = []): SpentNullifiers {
  const spent = new Set(initial);
  return {
    has: (nullifier) => spent.has(nullifier),
    remember: (nullifier) => void spent.add(nullifier),
  };
}

export interface AcceptOptions {
  readonly disclosure: Disclosure;
  // The request this counterparty actually sent. The disclosure is checked
  // against it rather than trusted to describe itself.
  readonly request: SessionRequest;
  readonly audience: string;
  readonly spent: SpentNullifiers;
  readonly nowUnix: number;
  readonly results?: AttestedResults;
  readonly registry?: IssuerRegistry;
  readonly signatures?: SignaturePort;
  readonly requiredPredicates?: readonly string[];
}

export function acceptPresentation(h: FieldHash, options: AcceptOptions): PresentationResult {
  const { disclosure, request, audience, spent, nowUnix } = options;

  if (disclosure.relyingPartyId !== audience || request.relyingPartyId !== audience) {
    return { status: "refused", reason: "wrong_audience" };
  }
  if (!isPurpose(request.purpose)) return { status: "refused", reason: "invalid_purpose" };
  if (isExpired(request, nowUnix)) return { status: "refused", reason: "session_expired" };

  // Recomputed, never read off the disclosure: this is what ties the answer
  // to this challenge, this purpose and these parameters at once.
  if (disclosure.sessionId !== sessionId(h, request)) {
    return { status: "refused", reason: "session_mismatch" };
  }
  if (disclosure.purpose !== request.purpose) {
    return { status: "refused", reason: "session_mismatch" };
  }

  // Evidence before spending: an envelope whose answers are not
  // authenticated must not consume the subject's nullifier.
  if (options.results !== undefined) {
    if (options.registry === undefined || options.signatures === undefined) {
      return { status: "refused", reason: "results_unauthenticated" };
    }
    const verified = verifyResults(h, options.results, {
      signatures: options.signatures,
      registry: options.registry,
      request,
      nowUnix,
      required: options.requiredPredicates,
    });
    if (verified.status === "invalid") return { status: "refused", reason: "results_unauthenticated" };
  }

  if (spent.has(disclosure.nullifier)) return { status: "refused", reason: "replayed" };
  spent.remember(disclosure.nullifier);
  return { status: "accepted" };
}
