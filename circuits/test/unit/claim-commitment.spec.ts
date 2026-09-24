// claim-commitment.spec.ts: the join.
// The two numbers below came from witnesses of `IdentityCommitment` and
// `IncomeCommitment` compiled with circom 2.2.3. `commitClaim` in core is
// asserted to produce exactly them. If it does, a credential issued by this
// repository is a credential the circuit can open — which is the thing the
// whole exercise was for.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Claim } from "@knowni/core";
import { commitClaim } from "@knowni/core";
import { poseidonHash } from "@knowni/core/node";
import { INCOME, SALT } from "../../tools/claim-fixture.ts";

const SUBJECT_REF = { hex: "0a".repeat(32) };
const NOW = 1_760_000_000;

const identity: Claim = {
  kind: "identity",
  jurisdiction: "CO",
  documentKind: "CC",
  subjectRef: SUBJECT_REF,
  documentValid: true,
  subjectAlive: true,
  ofAge: true,
  attestedAt: NOW,
};

// From the witness of circuits/claims.circom, IdentityCommitment.
const CIRCUIT_IDENTITY = "19426120075af234be4e3f80cf347b5e4779abeff2e9c5bf0941dcab3c8f7f1a";
// From the witness of circuits/claims.circom, IncomeCommitment, rebuilt when
// the claim grew its provenance. CI regenerates this witness on every run —
// see the circuits job — so this constant is a second pair of eyes and not the
// only thing sanctions between the two implementations.
const CIRCUIT_INCOME = "033ae98c509045b8293d6376335fbc8f9c7d914bb6f7c445ed665b0776cb6cc4";

test("an identity commitment made in core is the one the circuit computes", () => {
  assert.equal(commitClaim(poseidonHash, identity, SALT), CIRCUIT_IDENTITY);
});

test("and an income commitment too", () => {
  assert.equal(commitClaim(poseidonHash, INCOME, SALT), CIRCUIT_INCOME);
});

// The fields the old circuit left out. Each of these used to change nothing
// about the commitment, which meant an issuer could change them after the fact
// and the proof would still open.
test("the fields the circuit used to ignore now change the commitment", () => {
  const base = commitClaim(poseidonHash, identity, SALT);
  for (const variant of [
    { ...identity, attestedAt: NOW + 1 },
    { ...identity, jurisdiction: "MX" },
    { ...identity, documentKind: "CE" as const },
  ]) {
    assert.notEqual(commitClaim(poseidonHash, variant, SALT), base, JSON.stringify(variant));
  }
});

test("a claim of another kind with the same head commits differently", () => {
  assert.notEqual(commitClaim(poseidonHash, identity, SALT), commitClaim(poseidonHash, INCOME, SALT));
});
