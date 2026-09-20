// normalize.test.ts: The shapes a Latin American registry actually publishes a name in.

import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName, tokenOverlap, tokenizeName } from "../src/normalize.ts";

test("accents, case and punctuation collapse", () => {
  assert.equal(normalizeName("JOSÉ PEÑA GÓMEZ"), normalizeName("jose pena gomez"));
  assert.equal(normalizeName("Jose  Peña,  Gómez."), "jose pena gomez");
});

test("compound-surname particles are dropped", () => {
  // "de la Cruz" is filed three different ways across Colombian registries.
  assert.equal(normalizeName("Maria de la Cruz"), "maria cruz");
  assert.equal(normalizeName("MARIA DELACRUZ"), "maria delacruz");
});

test("reordered names match, because reordering is the dominant failure", () => {
  // "apellidos, nombres" vs "nombres apellidos" — an edit-distance matcher
  // would score this near zero.
  assert.equal(tokenOverlap("RODRIGUEZ MARTINEZ, ANA", "Ana Rodríguez Martínez"), 1);
});

test("a query matches an entry carrying extra aliases", () => {
  // Overlap is measured against the smaller set: a sanctions row with five
  // aliases should still match a two-token query.
  const entry = "CARLOS ALBERTO MENDOZA RUIZ alias EL FLACO alias CHARLIE";
  assert.equal(tokenOverlap("Carlos Mendoza", entry), 1);
});

test("unrelated names do not match", () => {
  assert.equal(tokenOverlap("Ana Rodriguez", "Pedro Gutierrez"), 0);
});

test("a partial match scores partially", () => {
  // One of two query tokens present.
  assert.equal(tokenOverlap("Ana Rodriguez", "Ana Gutierrez Perez"), 0.5);
});

test("an empty or particle-only name never matches anything", () => {
  assert.equal(tokenOverlap("", "Ana Rodriguez"), 0);
  assert.equal(tokenOverlap("de la", "Ana Rodriguez"), 0);
  assert.deepEqual(tokenizeName("  ,. "), []);
});

test("n-with-tilde folds onto n, and the tradeoff is known", () => {
  // Peña and Pena become the same token. That is deliberate — see
  // normalize.ts — and the raw text stays on the record for human review.
  assert.equal(tokenOverlap("PEÑA", "PENA"), 1);
});
