// session.test.ts: Session binding and nullifier derivation — the two values that stop a valid
// proof from being a reusable, linkable bearer token.

import { test } from "node:test";
import assert from "node:assert/strict";

import { sha256Hash } from "../src/hash.ts";
import { deriveNullifier, isExpired, isPurpose, sessionId, type SessionRequest } from "../src/session.ts";

const h = sha256Hash;
const secret = { hex: "9".repeat(64) };

const request: SessionRequest = {
  relyingPartyId: "agencia-inmobiliaria-bogota",
  purpose: "lease",
  nonce: "1".repeat(32),
  expiresAt: 1_760_000_600,
  paramsHash: "2".repeat(64),
};

test("every component of a request changes the session id", () => {
  const base = sessionId(h, request);
  const variants: SessionRequest[] = [
    { ...request, relyingPartyId: "otra-agencia" },
    { ...request, purpose: "purchase" },
    { ...request, nonce: "3".repeat(32) },
    { ...request, expiresAt: request.expiresAt + 1 },
    { ...request, paramsHash: "4".repeat(64) },
  ];
  for (const variant of variants) assert.notEqual(sessionId(h, variant), base);
});

test("a proof bound to a lease cannot be moved to a purchase", () => {
  // The purpose is inside the session id, which is a public input. Changing
  // it changes what the proof is a proof OF.
  assert.notEqual(sessionId(h, request), sessionId(h, { ...request, purpose: "purchase" }));
});

test("the same subject leaves unlinkable nullifiers at two relying parties", () => {
  // This is the property a naive "one nullifier per person" scheme destroys:
  // it would let two landlords compare notes and rebuild a rental history.
  const a = deriveNullifier(h, secret, sessionId(h, request));
  const b = deriveNullifier(h, secret, sessionId(h, { ...request, relyingPartyId: "otra" }));
  assert.notEqual(a, b);
});

test("the same subject in the same session always produces the same nullifier", () => {
  // Which is what makes a replay within the session detectable.
  const id = sessionId(h, request);
  assert.equal(deriveNullifier(h, secret, id), deriveNullifier(h, secret, id));
});

test("two subjects in one session produce different nullifiers", () => {
  const id = sessionId(h, request);
  assert.notEqual(
    deriveNullifier(h, secret, id),
    deriveNullifier(h, { hex: "8".repeat(64) }, id),
  );
});

test("a nullifier cannot be precomputed from public request data alone", () => {
  // The subject secret is the only unguessable input; a relying party who
  // knows a cédula still cannot watch for that person's nullifier.
  const id = sessionId(h, request);
  assert.notEqual(deriveNullifier(h, secret, id), h.hash("knowni:nullifier:v1", [Buffer.from(id, "hex")]));
});

test("expiry is evaluated against the caller's clock, not an internal one", () => {
  assert.equal(isExpired(request, request.expiresAt), false);
  assert.equal(isExpired(request, request.expiresAt + 1), true);
});

test("any contract type is a purpose, because the product is not about leases", () => {
  for (const purpose of [
    "lease",
    "vehicle-sale",
    "property-sale",
    "guarantee",
    "supply-contract",
    "employment-offer",
    "power-of-attorney",
  ]) {
    assert.equal(isPurpose(purpose), true, purpose);
    assert.doesNotThrow(() => sessionId(h, { ...request, purpose }));
  }
});

test("two contract types never share a session id", () => {
  // Which is what stops a proof obtained to rent being presented to buy.
  const ids = ["lease", "vehicle-sale", "guarantee"].map((purpose) =>
    sessionId(h, { ...request, purpose }),
  );
  assert.equal(new Set(ids).size, ids.length);
});

test("a purpose the subject could not read is refused", () => {
  // The purpose is shown before they answer; a value they cannot read is a
  // question they cannot refuse.
  for (const bad of ["", "Lease", "vehicle sale", "vehicle_sale", "-lease", "lease-", "a".repeat(65)]) {
    assert.equal(isPurpose(bad), false, JSON.stringify(bad));
    assert.throws(() => sessionId(h, { ...request, purpose: bad }), TypeError);
  }
});
