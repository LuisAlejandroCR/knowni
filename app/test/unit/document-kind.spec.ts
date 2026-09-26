// document-kind.spec.ts: el tipo de documento lo elige la persona. La pantalla
// de autorización mandaba siempre "CC"; aquí se fija que cada tipo ofrecido es
// uno que `core/` acepta y que el número se limpia según el tipo.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { DocumentKind } from "@knowni/core";
import { DOCUMENT_KINDS, cleanDocumentNumber } from "../../src/domain/document.ts";

test("every offered kind is one core accepts, each with its own label", () => {
  const accepted: readonly DocumentKind[] = ["CC", "CE", "PA", "NIT", "PEP", "OTHER"];
  for (const kind of DOCUMENT_KINDS) assert.ok(accepted.includes(kind.id));
  const labels = DOCUMENT_KINDS.map((kind) => kind.label);
  assert.equal(new Set(labels).size, labels.length);
});

test("cédulas keep only digits", () => {
  assert.equal(cleanDocumentNumber("CC", "1.030.626 766"), "1030626766");
  assert.equal(cleanDocumentNumber("CE", "E-123456"), "123456");
});

test("passports and PEP keep letters, uppercased", () => {
  assert.equal(cleanDocumentNumber("PA", "ax 12-3456"), "AX123456");
  assert.equal(cleanDocumentNumber("PEP", "pep9876"), "PEP9876");
});
