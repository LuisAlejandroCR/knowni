// history.fuzz.spec.ts: cualquier cosa leída del almacenamiento produce una
// lista válida o vacía, nunca una excepción ni una entrada malformada.

import { test } from "node:test";
import assert from "node:assert/strict";
import { HISTORY_LIMIT, parseHistory } from "../../src/domain/history.ts";

const samples: (string | null)[] = [
  null, "", "{", "null", "42", "\"x\"", "{}", "[]", "[null]", "[1,2]",
  JSON.stringify([{ outcome: "other", purpose: "a", at: 1 }]),
  JSON.stringify([{ outcome: "shared", purpose: 5, at: 1 }]),
  JSON.stringify([{ outcome: "shared", purpose: "a", at: "1" }]),
  JSON.stringify([{ outcome: "shared", purpose: "a", at: 1, extra: "leak" }]),
  JSON.stringify(Array.from({ length: 100 }, (_, i) => ({ outcome: "declined", purpose: "p", at: i }))),
];

test("malformed storage never throws and never yields a malformed entry", () => {
  for (let i = 0; i < 300; i++) {
    const bytes = Array.from({ length: Math.floor(Math.random() * 40) }, () => String.fromCharCode(32 + Math.floor(Math.random() * 90)));
    samples.push(bytes.join(""));
  }
  for (const raw of samples) {
    const history = parseHistory(raw);
    assert.ok(history.length <= HISTORY_LIMIT);
    for (const entry of history) {
      assert.deepEqual(Object.keys(entry).sort(), ["at", "outcome", "purpose"]);
      assert.ok(entry.outcome === "shared" || entry.outcome === "declined");
    }
  }
});
