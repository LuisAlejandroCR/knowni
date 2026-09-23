// issue-concurrency.spec.ts: the sources are asked at once, and one that runs
// out of time does not hold the rest. Distinct from service.spec.ts, which
// checks what each source answers: here what matters is when, and what happens
// to the answer nobody got. See docs/memoria.md D-41.

import { test } from "node:test";
import assert from "node:assert/strict";

import { nodeSignatures } from "@knowni/attestation/node";
import { issueAnswers } from "../../src/service.ts";
import { chargeableMinor } from "../../src/pricing.ts";

const NOW = 1_760_000_000;
const request = {
  relyingPartyId: "notaria-17",
  purpose: "vehicle-sale",
  nonce: "ab".repeat(16),
  expiresAt: NOW + 600,
  paramsHash: "cd".repeat(32),
};
const options = { apiKey: "k", issuerId: "co-operador-demo", seed: nodeSignatures.randomSeed() };
const body = {
  documentKind: "CC",
  documentNumber: "1020304050",
  consented: ["registraduria", "sicaac", "listas"],
  request,
};

// Reports the highest number of calls that were ever in flight at once.
function provider(delayMs: number) {
  let inFlight = 0;
  let peak = 0;
  const impl = (async () => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    inFlight -= 1;
    return new Response(JSON.stringify({ data: null }), { status: 200 });
  }) as unknown as typeof fetch;
  return {
    impl,
    get peak() {
      return peak;
    },
  };
}

test("three consented sources are asked at once, not one after the other", async () => {
  const sources = provider(30);
  const { answers } = await issueAnswers({ ...options, fetchImpl: sources.impl }, body, NOW);

  assert.equal(answers.length, 3);
  // At least one call per source was in flight at the same time. It is more
  // than three in practice — the sanctions source fans out to procuraduría,
  // contraloría and contaduría on its own — and that number is not pinned here.
  assert.ok(sources.peak >= 3, `expected at least 3 calls in flight, saw ${sources.peak}`);
});

test("a source past its deadline answers unavailable, and the others still answer", async () => {
  let releaseSlow = () => {};
  const held = new Promise<void>((resolve) => {
    releaseSlow = resolve;
  });
  const impl = (async (url: string) => {
    // Only the capacity source hangs; the other two answer immediately.
    if (new URL(String(url)).pathname.includes("sicaac")) await held;
    return new Response(JSON.stringify({ data: null }), { status: 200 });
  }) as unknown as typeof fetch;

  const { answers } = await issueAnswers(
    { ...options, fetchImpl: impl, sourceDeadlineMs: 20 },
    body,
    NOW,
  );

  assert.deepEqual(
    answers.map((answer) => answer.predicate),
    ["personhood", "capacity", "sanctions"],
  );
  assert.equal(answers.find((answer) => answer.predicate === "capacity")?.value, "unavailable");
  // Nobody is charged for an answer nobody got.
  assert.equal(chargeableMinor([...answers]), 0);

  // The held call is released and awaited so it does not outlive the test.
  releaseSlow();
  await held;
});

test("the order of the answers follows the consent, not who replied first", async () => {
  const impl = (async (url: string) => {
    // The sanctions source answers last on purpose.
    if (new URL(String(url)).pathname.includes("procuraduria")) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return new Response(JSON.stringify({ data: null }), { status: 200 });
  }) as unknown as typeof fetch;

  const { answers } = await issueAnswers({ ...options, fetchImpl: impl }, body, NOW);
  assert.deepEqual(
    answers.map((answer) => answer.predicate),
    ["personhood", "capacity", "sanctions"],
  );
});
