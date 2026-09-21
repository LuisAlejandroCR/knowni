// verifier.spec.ts: the counterparty's acceptance, exercised on the app's path.
// Same domain code as the server, so what is checked here is the wiring: the
// policy reaches the decision, and a replay meets the same ledger.

import { test } from "node:test";
import assert from "node:assert/strict";

import { demoRequest, demoResults } from "../../src/domain/demo-issuer.ts";
import { verifyOnDevice } from "../../src/domain/verifier.ts";
import type { AttestedAnswer } from "@knowni/attestation";

const NOW = 1_760_000_000;

const answers: AttestedAnswer[] = [
  {
    predicate: "personhood",
    value: true,
    source: "registraduria",
    provenance: "observed",
    doesNotEstimate: "No dice quién es.",
  },
  {
    predicate: "capacity",
    value: true,
    source: "sicaac",
    provenance: "observed",
    doesNotEstimate: "No afirma capacidad jurídica universal.",
  },
];

function presentation(id: string) {
  const signed = demoRequest(NOW);
  return { signed, results: demoResults(signed.request, answers, NOW), id };
}

test("a fresh, live revocation is accepted without qualification", () => {
  const { signed, results, id } = presentation("p1");
  const view = verifyOnDevice(signed, results, id, "live", "strict", NOW);
  assert.equal(view.accepted, true);
  assert.deepEqual(view.notes, []);
});

test("an unknown revocation is refused or accepted with a note, depending on the policy", () => {
  const strict = presentation("p2");
  assert.equal(verifyOnDevice(strict.signed, strict.results, strict.id, "unknown", "strict", NOW).accepted, false);

  const tolerant = presentation("p3");
  const view = verifyOnDevice(tolerant.signed, tolerant.results, tolerant.id, "unknown", "tolerant", NOW);
  assert.equal(view.accepted, true);
  assert.equal(view.notes.length, 1);
  assert.match(view.notes[0]!, /registrado/);
});

test("a revoked root is refused under every policy", () => {
  for (const policy of ["strict", "tolerant"] as const) {
    const { signed, results, id } = presentation(`p-revoked-${policy}`);
    const view = verifyOnDevice(signed, results, id, "revoked", policy, NOW);
    assert.equal(view.accepted, false);
    assert.match(view.explanation, /retiró/);
  }
});

test("the same presentation twice is idempotent; a different one is a replay", () => {
  const { signed, results, id } = presentation("p4");
  assert.equal(verifyOnDevice(signed, results, id, "live", "strict", NOW).idempotent, false);
  assert.equal(verifyOnDevice(signed, results, id, "live", "strict", NOW).idempotent, true);

  const second = verifyOnDevice(signed, results, "p4-otro", "live", "strict", NOW);
  assert.equal(second.accepted, false);
  assert.match(second.explanation, /ya se usó/);
});

test("tampered answers are refused, and say so without a code", () => {
  const { signed, results, id } = presentation("p5");
  const tampered = {
    ...results,
    answers: [{ ...results.answers[0]!, value: false }, ...results.answers.slice(1)],
  };
  const view = verifyOnDevice(signed, tampered, id, "live", "strict", NOW);
  assert.equal(view.accepted, false);
  assert.match(view.explanation, /firmadas/);
});
