// source-states.spec.ts: criterio A7 — `degraded`, `not_found` y `failed` son
// estados distintos, y llegan hasta quien puede hacer algo con ellos. Lo que
// se firma no cambia: la contraparte sigue recibiendo `unavailable` y ninguna
// razón. Lo que viaja al lado, para el titular, sí dice cuál de los tres es.

import { test } from "node:test";
import assert from "node:assert/strict";

import { nodeSignatures } from "@knowni/attestation/node";
import { issueAnswers } from "../../src/service.ts";

const NOW = 1_760_000_000;
const DOCUMENT = "1020304050";
const PATH = "/co/registraduria/vital-status/v1";
const request = {
  relyingPartyId: "notaria-17",
  purpose: "vehicle-sale",
  nonce: "ab".repeat(16),
  expiresAt: NOW + 600,
  paramsHash: "cd".repeat(32),
};

const options = { apiKey: "k", issuerId: "co-operador-demo", seed: nodeSignatures.randomSeed() };

const askWith = (fetchImpl: typeof fetch, consented = ["registraduria"]) =>
  issueAnswers(
    { ...options, fetchImpl, sourceDeadlineMs: 200 },
    { documentKind: "CC", documentNumber: DOCUMENT, consented, request },
    NOW,
  );

const serving = (body: unknown, status = 200): typeof fetch =>
  async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

// A source that answers, but after the issuance stopped waiting: the deadline
// below is 200 ms and this takes 400. Not longer, on purpose — the client goes
// on retrying in the background after the issuance gave up, and a test that
// waits that out pays for it on every CI run.
const tooSlow = (): typeof fetch =>
  async () =>
    await new Promise<Response>((resolve) => {
      setTimeout(() => resolve(new Response(JSON.stringify({ data: null }), { status: 200 })), 400);
    });

test("a register with no record is not_found", async () => {
  const { answers, sourceStates } = await askWith(serving({ data: null }));
  assert.equal(answers[0]!.value, "unavailable");
  assert.deepEqual(sourceStates, [
    { predicate: "personhood", source: "registraduria", state: "not_found" },
  ]);
});

test("a body we cannot use is failed, which is not the register being silent", async () => {
  const { sourceStates } = await askWith(serving("<html>500</html>", 200));
  assert.equal(sourceStates[0]!.state, "failed");
  assert.notEqual(sourceStates[0]!.state, "not_found");
});

test("a source that never answers is degraded, and never failed", async () => {
  const { answers, sourceStates } = await askWith(tooSlow());
  assert.equal(answers[0]!.value, "unavailable");
  assert.equal(sourceStates[0]!.state, "degraded");
});

test("an adapter that throws is degraded too: nothing came back to judge", async () => {
  const dead = (async () => {
    throw new TypeError("Network request failed");
  }) as typeof fetch;
  assert.equal((await askWith(dead)).sourceStates[0]!.state, "degraded");
});

test("a source that answered says so, beside the ones that did not", async () => {
  const provider: typeof fetch = async (url) => {
    const path = new URL(url instanceof Request ? url.url : url.toString()).pathname;
    return path === PATH
      ? new Response(JSON.stringify({ data: { found: true, document_number: DOCUMENT, status: "ALIVE" } }), {
          status: 200,
        })
      : new Response(JSON.stringify({ data: null }), { status: 200 });
  };
  const { sourceStates } = await askWith(provider, ["registraduria", "sicaac"]);
  assert.deepEqual(
    sourceStates.map((entry) => [entry.predicate, entry.state]),
    [
      ["personhood", "answered"],
      ["capacity", "not_found"],
    ],
  );
});

test("the three states the criterion names are three values, not one", async () => {
  const states = [
    (await askWith(serving({ data: null }))).sourceStates[0]!.state,
    (await askWith(serving("<html>500</html>", 200))).sourceStates[0]!.state,
    (await askWith(tooSlow())).sourceStates[0]!.state,
  ];
  assert.deepEqual(states, ["not_found", "failed", "degraded"]);
  assert.equal(new Set(states).size, 3);
});

test("nothing of why reaches what the counterparty is handed", async () => {
  const { answers, results, sourceStates } = await askWith(serving({ data: null }));
  // The signed envelope is what the counterparty verifies and keeps. It says
  // `unavailable` and stops there: a reason in here would tell them something
  // about the subject that they did not ask for and cannot check.
  const signed = JSON.stringify({ answers, results });
  for (const state of ["not_found", "failed", "degraded", "needs_human_review"]) {
    assert.ok(!signed.includes(state), `"${state}" leaked into the signed results`);
  }
  assert.equal(sourceStates[0]!.state, "not_found");
});

test("the states carry no document, no name and no provider payload", async () => {
  const { sourceStates } = await askWith(
    serving({ data: { found: true, document_number: DOCUMENT, full_name: "ANA MARIA RODRIGUEZ" } }),
  );
  const serialized = JSON.stringify(sourceStates);
  for (const secret of [DOCUMENT, "ANA MARIA RODRIGUEZ", "full_name", "document_number"]) {
    assert.ok(!serialized.includes(secret), `"${secret}" reached the public source states`);
  }
});

test("the deadline stops the calling, not only the waiting", async () => {
  let calls = 0;
  const flaky: typeof fetch = async () => {
    calls += 1;
    return new Response("{}", { status: 503 });
  };
  const { sourceStates } = await askWith(flaky);
  assert.equal(sourceStates[0]!.state, "degraded");
  const whenGaveUp = calls;
  // Long enough for the client's backoff to have scheduled another attempt.
  await new Promise((resolve) => setTimeout(resolve, 1_200));
  assert.equal(calls, whenGaveUp, "the client kept calling a source the issuance gave up on");
});
