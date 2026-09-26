// history.spec.ts: el historial va del más reciente al más antiguo, tiene tope
// y descarta lo que no reconoce al leerse del almacenamiento.

import { test } from "node:test";
import assert from "node:assert/strict";
import { HISTORY_LIMIT, addEntry, parseHistory } from "../../src/domain/history.ts";

test("new entries go first and the list stays bounded", () => {
  let history = addEntry([], { outcome: "shared", purpose: "a", at: 1 });
  history = addEntry(history, { outcome: "declined", purpose: "b", at: 2 });
  assert.deepEqual(history.map((entry) => entry.purpose), ["b", "a"]);
  for (let i = 0; i < HISTORY_LIMIT + 5; i++) history = addEntry(history, { outcome: "shared", purpose: "x", at: i });
  assert.equal(history.length, HISTORY_LIMIT);
});

test("stored history round-trips", () => {
  const history = [{ outcome: "shared", purpose: "arriendo", at: 1_700_000_000 }] as const;
  assert.deepEqual(parseHistory(JSON.stringify(history)), history);
});
