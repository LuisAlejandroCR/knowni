// service.spec.ts: the issuance service, with the provider stubbed.
// What matters here is that consent decides what is queried, that a degraded
// source becomes `unavailable`, and that no provider payload ever crosses.

import { test } from "node:test";
import assert from "node:assert/strict";

import { sha256Hash } from "@knowni/core/node";
import { nodeSignatures } from "@knowni/attestation/node";
import { createMemoryRegistry, verifyResults } from "@knowni/attestation";
import { issueAnswers } from "../../src/service.ts";

const NOW = 1_760_000_000;
const DOCUMENT = "1020304050";
const request = {
  relyingPartyId: "notaria-17",
  purpose: "vehicle-sale",
  nonce: "ab".repeat(16),
  expiresAt: NOW + 600,
  paramsHash: "cd".repeat(32),
};

function providerThatAnswers(bodies: Record<string, unknown>) {
  const paths: string[] = [];
  const impl = (async (url: string) => {
    const path = new URL(String(url)).pathname;
    paths.push(path);
    const body = bodies[path];
    if (body === undefined) return new Response(JSON.stringify({ data: null }), { status: 200 });
    return new Response(JSON.stringify({ data: body }), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, paths };
}

const seed = nodeSignatures.randomSeed();
const options = { apiKey: "k", issuerId: "co-operador-demo", seed };

test("a source with no consent is never queried", async () => {
  const provider = providerThatAnswers({});
  const { answers } = await issueAnswers(
    { ...options, fetchImpl: provider.impl },
    { documentKind: "CC", documentNumber: DOCUMENT, consented: ["registraduria"], request },
    NOW,
  );
  assert.equal(answers.length, 1);
  assert.equal(provider.paths.length, 1);
  assert.match(provider.paths[0]!, /registraduria/);
});

test("a living cédula becomes a true personhood answer", async () => {
  const provider = providerThatAnswers({
    "/co/registraduria/vital-status/v1": { found: true, document_number: DOCUMENT, status: "ALIVE" },
  });
  const { answers } = await issueAnswers(
    { ...options, fetchImpl: provider.impl },
    { documentKind: "CC", documentNumber: DOCUMENT, consented: ["registraduria"], request },
    NOW,
  );
  assert.equal(answers[0]!.value, true);
  assert.match(answers[0]!.doesNotEstimate, /No dice quién es/);
});

test("a source that answers nothing becomes unavailable, never false", async () => {
  const provider = providerThatAnswers({
    "/co/registraduria/vital-status/v1": null,
  });
  const { answers } = await issueAnswers(
    { ...options, fetchImpl: provider.impl },
    { documentKind: "CC", documentNumber: DOCUMENT, consented: ["registraduria"], request },
    NOW,
  );
  assert.equal(answers[0]!.value, "unavailable");
});

test("what the service returns carries no document, no name and no provider payload", async () => {
  const provider = providerThatAnswers({
    "/co/registraduria/vital-status/v1": { found: true, document_number: DOCUMENT, status: "ALIVE" },
    "/co/procuraduria/disciplinary-records/v1": {
      found: true,
      full_name: "ANA MARIA RODRIGUEZ",
      has_records: false,
      checked_at: "2026-09-21T00:00:00Z",
    },
    "/co/contraloria/fiscal-records/v1": { found: true, is_fiscal_responsible: false, verification_code: "X1" },
    "/co/contaduria/state-delinquent-debtors/v1": { found: true, reported: false, checked_at: "2026-09-21" },
  });
  const { results } = await issueAnswers(
    { ...options, fetchImpl: provider.impl },
    { documentKind: "CC", documentNumber: DOCUMENT, consented: ["registraduria", "listas"], request },
    NOW,
  );
  const wire = JSON.stringify(results);
  for (const secret of [DOCUMENT, "RODRIGUEZ", "full_name", "verification_code"]) {
    assert.ok(!wire.includes(secret), `${secret} leaked`);
  }
});

test("the signed envelope verifies against the issuer's published key", async () => {
  const provider = providerThatAnswers({
    "/co/registraduria/vital-status/v1": { found: true, document_number: DOCUMENT, status: "ALIVE" },
  });
  const { results } = await issueAnswers(
    { ...options, fetchImpl: provider.impl },
    { documentKind: "CC", documentNumber: DOCUMENT, consented: ["registraduria"], request },
    NOW,
  );
  const registry = createMemoryRegistry({ "co-operador-demo": nodeSignatures.publicKeyOf(seed) });
  const verified = verifyResults(sha256Hash, results, {
    signatures: nodeSignatures,
    registry,
    request,
    nowUnix: NOW,
  });
  assert.equal(verified.status, "valid");
});
