// demo-issuer.ts: an issuer and a counterparty that exist only in this demo.
// Their keys are generated on the device at start-up and never leave it, so the
// screens exercise the real signing path without a real registry behind it.

import type { AttestedAnswer, AttestedResults, SignedRequest, IssuerRegistry } from "@knowni/attestation";
import { attestResults, createMemoryRegistry, signRequest } from "@knowni/attestation";
import type { SessionRequest } from "@knowni/core";
import { toHex, utf8 } from "@knowni/core";
import { appHash, appSignatures } from "./crypto.ts";

export const DEMO_ISSUER = "co-operador-demo";
export const DEMO_COUNTERPARTY = "comprador-de-prueba";

interface DemoKeys {
  readonly issuerSeed: Uint8Array;
  readonly issuerPublicKey: Uint8Array;
  readonly counterpartySeed: Uint8Array;
  readonly counterpartyPublicKey: Uint8Array;
}

let keys: DemoKeys | undefined;

function demoKeys(): DemoKeys {
  if (keys === undefined) {
    const issuerSeed = appSignatures.randomSeed();
    const counterpartySeed = appSignatures.randomSeed();
    keys = {
      issuerSeed,
      issuerPublicKey: appSignatures.publicKeyOf(issuerSeed),
      counterpartySeed,
      counterpartyPublicKey: appSignatures.publicKeyOf(counterpartySeed),
    };
  }
  return keys;
}

export function demoRegistry(): IssuerRegistry {
  const { issuerPublicKey, counterpartyPublicKey } = demoKeys();
  return createMemoryRegistry({
    [DEMO_ISSUER]: issuerPublicKey,
    [DEMO_COUNTERPARTY]: counterpartyPublicKey,
  });
}

// A nonce per request. Reusing one would collapse two sessions into the same
// identifier and re-link them, which is the property the whole design pays for.
function nonce(): string {
  return toHex(appSignatures.randomSeed().subarray(0, 16));
}

export function demoRequest(nowUnix: number): SignedRequest {
  const request: SessionRequest = {
    relyingPartyId: DEMO_COUNTERPARTY,
    purpose: "vehicle-sale",
    nonce: nonce(),
    expiresAt: nowUnix + 600,
    // The parameters this demo asks about, hashed: the real product puts the
    // thresholds here, and they are public.
    paramsHash: appHash.hash("knowni/demo-params/v1", [utf8("vehicle-sale")]),
  };
  return signRequest(appSignatures, demoKeys().counterpartySeed, request);
}

export function demoResults(request: SessionRequest, answers: readonly AttestedAnswer[], nowUnix: number): AttestedResults {
  return attestResults(appHash, appSignatures, demoKeys().issuerSeed, {
    issuerId: DEMO_ISSUER,
    request,
    answers,
    issuedAt: nowUnix,
    expiresAt: nowUnix + 300,
  });
}
