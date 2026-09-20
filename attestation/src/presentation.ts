// presentation.ts: the relying party's side of one answer. Signs the request it sends, then
// refuses a disclosure that was not built for this audience, this purpose, this challenge — or
// that already arrived.

import type { Disclosure, FieldHash, SessionRequest } from "@knowni/core";
import { isExpired, isPurpose, sessionId } from "@knowni/core";
import { createPublicKey, sign, verify } from "node:crypto";
import type { IssuerRegistry } from "./types.ts";
import type { AttestedResults } from "./results.ts";
import { verifyResults } from "./results.ts";

const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

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

function requestBytes(request: SessionRequest): Buffer {
  const parts = [
    Buffer.from(REQUEST_DOMAIN, "utf8"),
    Buffer.from(request.relyingPartyId, "utf8"),
    Buffer.from(request.purpose, "utf8"),
    Buffer.from(request.nonce, "utf8"),
    Buffer.from(String(request.expiresAt), "utf8"),
    Buffer.from(request.paramsHash, "utf8"),
  ];
  // Length-prefixed, so two adjacent fields cannot be re-split into a
  // different pair that signs the same bytes.
  return Buffer.concat(
    parts.map((part) => {
      const length = Buffer.alloc(4);
      length.writeUInt32BE(part.length);
      return Buffer.concat([length, part]);
    }),
  );
}

export function signRequest(seed: Uint8Array, request: SessionRequest): SignedRequest {
  const key = {
    key: Buffer.concat([PKCS8_PREFIX, Buffer.from(seed)]),
    format: "der" as const,
    type: "pkcs8" as const,
  };
  return {
    request,
    algorithm: "ed25519",
    signature: sign(null, requestBytes(request), key).toString("hex"),
  };
}

export function verifyRequest(
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

  const key = createPublicKey({
    key: Buffer.concat([SPKI_PREFIX, Buffer.from(publicKey)]),
    format: "der",
    type: "spki",
  });
  const ok = verify(null, requestBytes(signed.request), key, Buffer.from(signed.signature, "hex"));
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
    if (options.registry === undefined) return { status: "refused", reason: "results_unauthenticated" };
    const verified = verifyResults(h, options.results, {
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
