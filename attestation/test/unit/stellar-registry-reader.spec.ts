// stellar-registry-reader.spec.ts: lo que Horizon responde, reducido a un
// digest y una fecha — o a nada. Las respuestas de esta prueba tienen la forma
// que Horizon publica en `/accounts/{id}/transactions`; el ejercicio contra la
// red real sigue pendiente y está anotado en `docs/verificacion.md`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createStellarRegistryReader } from "../../src/adapters/stellar-registry-reader.ts";

const ACCOUNT = "GAZONAKJ7XIJVQI37HR2ZZKMQIISUIFAYXVCXJOCXVGQQNGM24BF2UZD";
const DIGEST = "ab".repeat(32);
const OLDER = "cd".repeat(32);

const memo = (hex: string): string => {
  const bytes = hex.match(/../g)!.map((pair) => Number.parseInt(pair, 16));
  return btoa(String.fromCharCode(...bytes));
};

const page = (records: readonly unknown[]) => ({ _embedded: { records } });

const tx = (hex: string, createdAt: string, over: Record<string, unknown> = {}) => ({
  memo_type: "hash",
  memo: memo(hex),
  created_at: createdAt,
  successful: true,
  ...over,
});

// Horizon is asked by URL; a Request or URL object stringifies to something
// that is not one, so the tests read the target the same way production does.
const asUrl = (target: RequestInfo | URL): string =>
  target instanceof Request ? target.url : target.toString();

const serving = (body: unknown, status = 200): typeof fetch =>
  async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

const readerOn = (fetchImpl: typeof fetch) =>
  createStellarRegistryReader({ authorityAccountId: ACCOUNT, fetchImpl });

test("the newest memo hash on the account is the current digest", async () => {
  const reader = readerOn(
    serving(page([tx(DIGEST, "2026-09-24T17:00:00Z"), tx(OLDER, "2026-09-01T10:00:00Z")])),
  );
  assert.deepEqual(await reader.current(), { digest: DIGEST, anchoredAt: 1_790_269_200 });
});

test("transactions that carry no hash memo are skipped, not misread", async () => {
  const reader = readerOn(
    serving(
      page([
        { memo_type: "text", memo: "hola", created_at: "2026-09-24T17:00:00Z", successful: true },
        { memo_type: "none", created_at: "2026-09-24T16:00:00Z", successful: true },
        tx(OLDER, "2026-09-01T10:00:00Z"),
      ]),
    ),
  );
  assert.deepEqual(await reader.current(), { digest: OLDER, anchoredAt: 1_788_256_800 });
});

test("a failed transaction never anchors anything", async () => {
  const reader = readerOn(serving(page([tx(DIGEST, "2026-09-24T17:00:00Z", { successful: false })])));
  assert.equal(await reader.current(), undefined);
});

test("a memo that is not 32 bytes is not a digest", async () => {
  const short = btoa("too short");
  const reader = readerOn(
    serving(page([{ memo_type: "hash", memo: short, created_at: "2026-09-24T17:00:00Z", successful: true }])),
  );
  assert.equal(await reader.current(), undefined);
});

test("an account with no transactions answers nothing, not an error", async () => {
  assert.equal(await readerOn(serving(page([]))).current(), undefined);
});

test("HTML in front of Horizon is no digest and no crash", async () => {
  for (const body of ["<html>502 Bad Gateway</html>", "null", '{"_embedded":{}}', '{"_embedded":{"records":"1"}}']) {
    assert.equal(await readerOn(serving(body)).current(), undefined);
  }
});

test("a status Horizon never sent is not read as an answer", async () => {
  assert.equal(await readerOn(serving(page([tx(DIGEST, "2026-09-24T17:00:00Z")]), 404)).current(), undefined);
  assert.equal(await readerOn(serving(page([tx(DIGEST, "2026-09-24T17:00:00Z")]), 502)).current(), undefined);
});

test("the network falling away is nothing, and the caller falls back to its cache", async () => {
  const dead = (async () => {
    throw new TypeError("Network request failed");
  }) as typeof fetch;
  assert.equal(await readerOn(dead).current(), undefined);
});

test("it asks Horizon for the newest transactions of that account and nothing else", async () => {
  let asked = "";
  const reader = createStellarRegistryReader({
    authorityAccountId: ACCOUNT,
    window: 5,
    fetchImpl: async (url) => {
      asked = asUrl(url);
      return new Response(JSON.stringify(page([])), { status: 200 });
    },
  });
  await reader.current();
  assert.ok(asked.startsWith(`https://horizon-testnet.stellar.org/accounts/${ACCOUNT}/transactions?`));
  assert.match(asked, /order=desc/);
  assert.match(asked, /limit=5/);
  assert.match(asked, /include_failed=false/);
});

test("an unparsable date is not an anchor time of zero", async () => {
  const reader = readerOn(serving(page([tx(DIGEST, "not a date")])));
  assert.equal(await reader.current(), undefined);
});

test("the reader and the chain registry resolve a document end to end", async () => {
  const { createChainRegistry } = await import("../../src/adapters/chain-registry.ts");
  const { signRegistry, registryDigest } = await import("../../src/registry.ts");
  const { generateIssuerKeypair } = await import("../../src/index.ts");
  const { nodeSignatures } = await import("../../src/node.ts");
  const { sha256Hash } = await import("@knowni/core/node");
  const { toHex } = await import("@knowni/core");

  const issuer = generateIssuerKeypair(nodeSignatures);
  const authority = generateIssuerKeypair(nodeSignatures);
  const signed = signRegistry(nodeSignatures, authority.privateKeySeed, {
    registryId: "knowni-co",
    issuedAt: 1_790_000_000,
    expiresAt: 1_791_000_000,
    issuers: [{ issuerId: "knowni-demo-issuer", publicKey: toHex(issuer.publicKey) }],
    revoked: [],
  });
  const digest = registryDigest(sha256Hash, signed);

  const horizon: typeof fetch = async (url) =>
    asUrl(url).includes("/transactions")
      ? new Response(JSON.stringify(page([tx(digest, "2026-09-24T17:00:00Z")])), { status: 200 })
      : new Response(JSON.stringify(signed), { status: 200 });

  const port = createChainRegistry({
    h: sha256Hash,
    reader: createStellarRegistryReader({ authorityAccountId: ACCOUNT, fetchImpl: horizon }),
    documentUrl: "https://mirror.knowni.example/registry.json",
    fetchImpl: horizon,
  });
  const resolution = await port.resolve(1_790_100_000);
  assert.equal(resolution.status, "resolved");
  if (resolution.status !== "resolved") return;
  assert.equal(resolution.snapshot.trustedVia, "chain_anchor");
  assert.deepEqual(resolution.snapshot.registry.publicKeyOf("knowni-demo-issuer"), issuer.publicKey);

  // And the memo deciding it is not decoration: anchor another digest and the
  // same mirror stops being trusted.
  const stale: typeof fetch = async (url) =>
    asUrl(url).includes("/transactions")
      ? new Response(JSON.stringify(page([tx("ab".repeat(32), "2026-09-24T18:00:00Z")])), { status: 200 })
      : new Response(JSON.stringify(signed), { status: 200 });
  const other = createChainRegistry({
    h: sha256Hash,
    reader: createStellarRegistryReader({ authorityAccountId: ACCOUNT, fetchImpl: stale }),
    documentUrl: "https://mirror.knowni.example/registry.json",
    fetchImpl: stale,
  });
  assert.deepEqual(await other.resolve(1_790_100_000), {
    status: "unavailable",
    reason: "digest_mismatch",
  });
});
