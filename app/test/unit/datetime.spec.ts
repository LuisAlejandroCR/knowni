// datetime.spec.ts: las fechas se leen dd/mm/yyyy hh:mm en 24 horas, con ceros
// a la izquierda, y la ausencia de fecha se muestra como una raya, no como 1970.

import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDateTime } from "../../src/domain/datetime.ts";

test("dd/mm/yyyy hh:mm with a 24-hour clock and leading zeros", () => {
  const local = new Date(2026, 8, 5, 22, 7).getTime() / 1000;
  assert.equal(formatDateTime(local), "05/09/2026 22:07");
  const morning = new Date(2026, 0, 1, 9, 3).getTime() / 1000;
  assert.equal(formatDateTime(morning), "01/01/2026 09:03");
});

test("no date is a dash", () => {
  assert.equal(formatDateTime(undefined), "—");
});
