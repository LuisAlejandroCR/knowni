// resolve.test.ts: The rule that keeps a common name from becoming a sanctions match.

import { test } from "node:test";
import assert from "node:assert/strict";
import { SCREENING_POLICY, resolve, screen } from "../src/resolve.ts";
import type { Candidate } from "../src/types.ts";

const candidate = (id: string, score: number): Candidate => ({
  record: { id, source: "ofac-sdn", jurisdiction: "US", text: id },
  score,
});

test("a clear winner resolves", () => {
  const r = resolve([candidate("a", 0.95), candidate("b", 0.40)]);
  assert.equal(r.status, "matched");
  assert.equal(r.status === "matched" && r.candidate.record.id, "a");
});

test("a lone candidate below the floor is not a match", () => {
  assert.equal(resolve([candidate("a", 0.60)]).status, "none");
});

test("two close candidates are ambiguous, not a coin flip", () => {
  // The Maria Rodriguez case: several registry rows, all plausible. A
  // resolver that returned the top hit would refuse someone a lease over it.
  const r = resolve([candidate("a", 0.92), candidate("b", 0.88), candidate("c", 0.30)]);
  assert.equal(r.status, "ambiguous");
  assert.deepEqual(
    r.status === "ambiguous" ? r.candidates.map((c) => c.record.id) : [],
    ["a", "b"],
    "the reviewer sees every plausible row, not just the two compared",
  );
});

test("ambiguity is measured against the runner-up, not the field size", () => {
  // Fifty weak hits behind one strong one is still a clear answer.
  const weak = Array.from({ length: 50 }, (_, i) => candidate(`w${i}`, 0.2));
  const r = resolve([candidate("strong", 0.99), ...weak]);
  assert.equal(r.status, "matched");
});

test("an empty result set is none", () => {
  assert.equal(resolve([]).status, "none");
});

test("candidates need not arrive sorted", () => {
  const r = resolve([candidate("b", 0.40), candidate("a", 0.95)]);
  assert.equal(r.status === "matched" && r.candidate.record.id, "a");
});

test("ambiguity resolves to listed-and-review, never to clean", () => {
  // The conservative direction. A convenience-optimised system would return
  // "not listed" here and let the applicant through.
  assert.deepEqual(screen(resolve([candidate("a", 0.92), candidate("b", 0.88)])), {
    listed: true,
    needsReview: true,
  });
});

test("screening maps the three resolutions onto two decisions", () => {
  assert.deepEqual(screen(resolve([candidate("a", 0.99)])), { listed: true, needsReview: false });
  assert.deepEqual(screen(resolve([])), { listed: false, needsReview: false });
});

test("the policy is a parameter, and a stricter one narrows matches", () => {
  const candidates = [candidate("a", 0.80), candidate("b", 0.50)];
  assert.equal(resolve(candidates, SCREENING_POLICY).status, "matched");
  assert.equal(resolve(candidates, { floor: 0.9, margin: 0.15 }).status, "none");
});
