// registry.contract.spec.ts: criterio A3 — la misma presentación se verifica con
// el registro web y con el de cadena. Una suite, dos adaptadores: lo que se fija
// no es que cada uno funcione, sino que ninguno de los dos cambie la respuesta.
// Si un día divergen, esta prueba falla en los dos a la vez y nombra cuál.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { SessionRequest } from "@knowni/core";
import { SolvencyTier, deriveNullifier, sessionId, toHex } from "@knowni/core";
import { sha256Hash } from "@knowni/core/node";
import {
  acceptAnswer,
  attestResults,
  createMemoryNullifierLedger,
  createMemoryRegistry,
  generateIssuerKeypair,
  signRequest,
  type AttestedAnswer,
  type RegistryDocument,
  type RegistryPort,
  type RevocationPolicy,
  type SignedRegistryDocument,
} from "../../src/index.ts";
import { signRegistry, registryDigest } from "../../src/registry.ts";
import { createWebRegistry } from "../../src/adapters/web-registry.ts";
import { createChainRegistry, type ChainRegistryReader } from "../../src/adapters/chain-registry.ts";
import { nodeSignatures } from "../../src/node.ts";

const NOW = 1_760_000_000;
const ISSUER = "knowni-demo-issuer";
const AGENCY = "notaria-17";
const ROOT = "0f".repeat(32);
const OTHER_ROOT = "1a".repeat(32);
const SECRET = { hex: "7".repeat(64) };
const URL = "https://registry.knowni.example/v1/registry.json";

const request: SessionRequest = {
  relyingPartyId: AGENCY,
  purpose: "vehicle-sale",
  nonce: "ab".repeat(16),
  expiresAt: NOW + 600,
  paramsHash: "cd".repeat(32),
};

const answers: AttestedAnswer[] = [
  {
    predicate: "personhood",
    value: true,
    source: "registraduria",
    provenance: "observed",
    doesNotEstimate: "no dice quién es",
  },
];

const policy: RevocationPolicy = { maxSnapshotAgeSeconds: 3_600, onUnknown: "refuse" };

// One presentation, built once. Both adapters are handed this same object:
// a test that rebuilds it per adapter proves less than it looks like it does.
function presentation() {
  const issuer = generateIssuerKeypair(nodeSignatures);
  const counterparty = generateIssuerKeypair(nodeSignatures);
  const authority = generateIssuerKeypair(nodeSignatures);
  const session = sessionId(sha256Hash, request);
  const document: RegistryDocument = {
    registryId: "knowni-co",
    issuedAt: NOW - 600,
    expiresAt: NOW + 86_400,
    issuers: [
      { issuerId: ISSUER, publicKey: toHex(issuer.publicKey) },
      { issuerId: AGENCY, publicKey: toHex(counterparty.publicKey) },
    ],
    revoked: [],
  };
  return {
    authority,
    document,
    signedRequest: signRequest(nodeSignatures, counterparty.privateKeySeed, request),
    results: attestResults(sha256Hash, nodeSignatures, issuer.privateKeySeed, {
      issuerId: ISSUER,
      request,
      answers,
      issuedAt: NOW - 30,
      expiresAt: NOW + 300,
    }),
    disclosure: {
      sessionId: session,
      relyingPartyId: AGENCY,
      purpose: request.purpose,
      decidedAt: NOW,
      personhood: true as const,
      solvency: SolvencyTier.STRONG,
      formality: true as const,
      sanctions: true as const,
      capacity: "unavailable" as const,
      assetStanding: "unavailable" as const,
      issuerRoots: [ROOT],
      nullifier: deriveNullifier(sha256Hash, SECRET, session),
    },
  };
}

const jsonOnce = (body: unknown, status = 200): typeof fetch =>
  async () => new Response(JSON.stringify(body), { status });

// The two ways a registry earns trust, behind the same port. `forged` is how
// each adapter is attacked: change the document under the trust root it uses.
interface Adapter {
  readonly name: string;
  readonly trustedVia: "authority_signature" | "chain_anchor";
  port(signed: SignedRegistryDocument, fetchImpl?: typeof fetch): RegistryPort;
  // A document the attacker re-signed with their own key, or anchored nowhere.
  forged(signed: SignedRegistryDocument): { port: RegistryPort; reason: string };
}

const web: Adapter = {
  name: "web",
  trustedVia: "authority_signature",
  port: (signed, fetchImpl) => {
    const authorityKey = adapterKeys.get(signed)!;
    return createWebRegistry({
      url: URL,
      authorityKey,
      signatures: nodeSignatures,
      fetchImpl: fetchImpl ?? jsonOnce(signed),
    });
  },
  forged: (signed) => {
    const attacker = generateIssuerKeypair(nodeSignatures);
    const swapped = signRegistry(nodeSignatures, attacker.privateKeySeed, {
      ...signed.document,
      issuers: [{ issuerId: ISSUER, publicKey: toHex(attacker.publicKey) }],
    });
    return {
      port: createWebRegistry({
        url: URL,
        authorityKey: adapterKeys.get(signed)!,
        signatures: nodeSignatures,
        fetchImpl: jsonOnce(swapped),
      }),
      reason: "bad_signature",
    };
  },
};

const reader = (signed: SignedRegistryDocument): ChainRegistryReader => ({
  chain: "stellar:testnet",
  current: async () => ({ digest: registryDigest(sha256Hash, signed), anchoredAt: NOW - 120 }),
});

const chain: Adapter = {
  name: "chain",
  trustedVia: "chain_anchor",
  port: (signed, fetchImpl) =>
    createChainRegistry({
      h: sha256Hash,
      reader: reader(signed),
      documentUrl: URL,
      fetchImpl: fetchImpl ?? jsonOnce(signed),
    }),
  forged: (signed) => {
    const attacker = generateIssuerKeypair(nodeSignatures);
    const swapped = signRegistry(nodeSignatures, attacker.privateKeySeed, {
      ...signed.document,
      issuers: [{ issuerId: ISSUER, publicKey: toHex(attacker.publicKey) }],
    });
    return {
      // The chain still anchors the real document; the mirror serves another.
      port: createChainRegistry({
        h: sha256Hash,
        reader: reader(signed),
        documentUrl: URL,
        fetchImpl: jsonOnce(swapped),
      }),
      reason: "digest_mismatch",
    };
  },
};

// Which authority key belongs to which signed document, so the web adapter can
// be built from the document alone and the suite stays symmetric.
const adapterKeys = new WeakMap<SignedRegistryDocument, Uint8Array>();

function sign(document: RegistryDocument, authority: { privateKeySeed: Uint8Array; publicKey: Uint8Array }) {
  const signed = signRegistry(nodeSignatures, authority.privateKeySeed, document);
  adapterKeys.set(signed, authority.publicKey);
  return signed;
}

for (const adapter of [web, chain]) {
  test(`${adapter.name}: the same presentation is accepted with material it resolved`, async () => {
    const fixture = presentation();
    const signed = sign(fixture.document, fixture.authority);
    const resolution = await adapter.port(signed).resolve(NOW);
    assert.equal(resolution.status, "resolved");
    if (resolution.status !== "resolved") return;
    assert.equal(resolution.snapshot.trustedVia, adapter.trustedVia);
    assert.equal(resolution.snapshot.fromCache, false);

    const result = acceptAnswer(sha256Hash, {
      signatures: nodeSignatures,
      signedRequest: fixture.signedRequest,
      audience: AGENCY,
      disclosure: fixture.disclosure,
      results: fixture.results,
      presentationId: "pres-1",
      registry: resolution.snapshot.registry,
      ledger: createMemoryNullifierLedger(),
      revocation: resolution.snapshot.revocation,
      policy,
      nowUnix: NOW,
      issuerRoot: ROOT,
    });
    assert.deepEqual(result, { status: "accepted", idempotent: false, notes: [] });
  });

  test(`${adapter.name}: a revoked root is refused with exactly the same reason`, async () => {
    const fixture = presentation();
    const signed = sign({ ...fixture.document, revoked: [{ issuerId: ISSUER, root: ROOT }] }, fixture.authority);
    const resolution = await adapter.port(signed).resolve(NOW);
    assert.equal(resolution.status, "resolved");
    if (resolution.status !== "resolved") return;
    const result = acceptAnswer(sha256Hash, {
      signatures: nodeSignatures,
      signedRequest: fixture.signedRequest,
      audience: AGENCY,
      disclosure: fixture.disclosure,
      results: fixture.results,
      presentationId: "pres-1",
      registry: resolution.snapshot.registry,
      ledger: createMemoryNullifierLedger(),
      revocation: resolution.snapshot.revocation,
      policy,
      nowUnix: NOW,
      issuerRoot: ROOT,
    });
    assert.deepEqual(result, { status: "refused", reason: "revoked" });
    // A root it never revoked stays live, so "revoked" means this one.
    assert.deepEqual(resolution.snapshot.revocation.stateOf(ISSUER, OTHER_ROOT), {
      status: "live",
      checkedAt: NOW,
    });
  });

  test(`${adapter.name}: a document that did not come from the trust root is refused`, async () => {
    const fixture = presentation();
    const signed = sign(fixture.document, fixture.authority);
    const forged = adapter.forged(signed);
    assert.deepEqual(await forged.port.resolve(NOW), { status: "unavailable", reason: forged.reason });
  });

  test(`${adapter.name}: an expired document is not usable material`, async () => {
    const fixture = presentation();
    const signed = sign({ ...fixture.document, expiresAt: NOW - 1 }, fixture.authority);
    assert.deepEqual(await adapter.port(signed).resolve(NOW), { status: "unavailable", reason: "expired" });
  });

  test(`${adapter.name}: something that is not a registry is refused before it is trusted`, async () => {
    const fixture = presentation();
    const signed = sign(fixture.document, fixture.authority);
    const garbage = jsonOnce({ document: { registryId: "knowni-co" }, algorithm: "ed25519", signature: "zz" });
    assert.deepEqual(await adapter.port(signed, garbage).resolve(NOW), {
      status: "unavailable",
      reason: "invalid_document",
    });
  });

  test(`${adapter.name}: a source that stops answering falls back to what it already verified`, async () => {
    const fixture = presentation();
    const signed = sign(fixture.document, fixture.authority);
    let online = true;
    const flaky = (async () => {
      if (!online) throw new TypeError("Network request failed");
      return new Response(JSON.stringify(signed), { status: 200 });
    }) as typeof fetch;
    const port = adapter.port(signed, flaky);
    assert.equal((await port.resolve(NOW)).status, "resolved");
    online = false;
    const offline = await port.resolve(NOW + 60);
    assert.equal(offline.status, "resolved");
    if (offline.status !== "resolved") return;
    // Cached, and it says so: the material was learned before the outage, and
    // the counterparty's policy is what decides whether that is fresh enough.
    assert.equal(offline.snapshot.fromCache, true);
    assert.equal(offline.snapshot.checkedAt, NOW);
  });

  test(`${adapter.name}: with nothing cached, an outage is unavailable and never an empty registry`, async () => {
    const fixture = presentation();
    const signed = sign(fixture.document, fixture.authority);
    const dead = (async () => {
      throw new TypeError("Network request failed");
    }) as typeof fetch;
    assert.deepEqual(await adapter.port(signed, dead).resolve(NOW), {
      status: "unavailable",
      reason: "unavailable",
    });
  });
}

test("both adapters resolve the very same document to the very same material", async () => {
  const fixture = presentation();
  const signed = sign(fixture.document, fixture.authority);
  const [fromWeb, fromChain] = await Promise.all([
    web.port(signed).resolve(NOW),
    chain.port(signed).resolve(NOW),
  ]);
  assert.equal(fromWeb.status, "resolved");
  assert.equal(fromChain.status, "resolved");
  if (fromWeb.status !== "resolved" || fromChain.status !== "resolved") return;
  assert.equal(fromWeb.snapshot.registryId, fromChain.snapshot.registryId);
  assert.equal(fromWeb.snapshot.expiresAt, fromChain.snapshot.expiresAt);
  assert.deepEqual(
    fromWeb.snapshot.registry.publicKeyOf(ISSUER),
    fromChain.snapshot.registry.publicKeyOf(ISSUER),
  );
  assert.deepEqual(
    fromWeb.snapshot.revocation.stateOf(ISSUER, ROOT),
    fromChain.snapshot.revocation.stateOf(ISSUER, ROOT),
  );
  // And what memory has said all along, which is what the rest of the suite
  // verifies against: swapping the registry cannot change a verification.
  const memory = createMemoryRegistry({ [ISSUER]: fromWeb.snapshot.registry.publicKeyOf(ISSUER)! });
  assert.deepEqual(memory.publicKeyOf(ISSUER), fromChain.snapshot.registry.publicKeyOf(ISSUER));
});
