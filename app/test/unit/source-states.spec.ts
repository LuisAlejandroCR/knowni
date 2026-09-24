// source-states.spec.ts: criterio A7 del lado del teléfono. La pantalla de
// degradación tenía una sola frase para cualquier ausencia; aquí se fija que
// cada estado tiene la suya, que ninguna suena a veredicto sobre la persona, y
// que un estado que el emisor se invente no se pinta.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readSourceStates, type SourceStateName } from "../../src/domain/issuer-client.ts";
import { RETRYABLE_STATES, SOURCE_STATE_TEXT, sourceStateText } from "../../src/domain/session.ts";

const STATES: readonly SourceStateName[] = [
  "answered",
  "not_found",
  "degraded",
  "failed",
  "consent_missing",
  "needs_human_review",
];

test("every state a person can be shown has its own words", () => {
  const texts = STATES.map(sourceStateText);
  assert.equal(new Set(texts).size, texts.length);
  for (const text of texts) assert.ok(text.length > 0);
});

test("the three states the criterion names never share a sentence", () => {
  const three = [sourceStateText("not_found"), sourceStateText("degraded"), sourceStateText("failed")];
  assert.equal(new Set(three).size, 3);
});

test("no message reads as a verdict about the person", () => {
  for (const state of STATES) {
    const text = sourceStateText(state).toLowerCase();
    for (const verdict of ["no cumple", "rechaz", "negativo", "riesgo", "no apto"]) {
      assert.ok(!text.includes(verdict), `"${state}" reads as a verdict: ${text}`);
    }
  }
});

test("only what a retry could change is offered as a retry", () => {
  assert.deepEqual([...RETRYABLE_STATES].sort(), ["degraded", "failed"]);
  // A register with no record does not answer differently the second time,
  // and a missing consent is fixed on the consent screen, not by retrying.
  for (const state of ["not_found", "consent_missing", "needs_human_review"] as const) {
    assert.ok(!RETRYABLE_STATES.includes(state));
  }
});

test("states off the wire are validated, and a made-up one is dropped", () => {
  const states = readSourceStates([
    { predicate: "personhood", source: "registraduria", state: "not_found" },
    { predicate: "capacity", source: "sicaac", state: "inventado" },
    { predicate: "sanctions", source: "listas" },
    "no",
    null,
    { predicate: 7, source: "x", state: "degraded" },
  ]);
  assert.deepEqual(states, [{ predicate: "personhood", source: "registraduria", state: "not_found" }]);
});

test("a response with no states at all is empty, not a crash", () => {
  for (const body of [undefined, null, "", 7, {}]) {
    assert.deepEqual(readSourceStates(body), []);
  }
});

test("every validated state has words to render", () => {
  const states = readSourceStates(
    STATES.map((state) => ({ predicate: state, source: "s", state })),
  );
  assert.equal(states.length, STATES.length);
  for (const entry of states) assert.equal(sourceStateText(entry.state), SOURCE_STATE_TEXT[entry.state]);
});
