// delegation.spec.ts: a subject signs a bounded permission for one agent.
// Each refusal has its own reason, and a delegation checked in the wrong
// context is refused even when its signature is perfect.

import { test } from "node:test";
import assert from "node:assert/strict";

import { toHex } from "@knowni/core";
import { checkDelegation, signDelegation, type DelegationBody } from "../../src/index.ts";
import { nodeSignatures } from "../../src/node.ts";

const NOW = 1_760_000_000;
const subjectSeed = nodeSignatures.randomSeed();
const agentSeed = nodeSignatures.randomSeed();
const agentKey = toHex(nodeSignatures.publicKeyOf(agentSeed));

const body: DelegationBody = {
  id: "0f".repeat(16),
  subjectKey: toHex(nodeSignatures.publicKeyOf(subjectSeed)),
  agentKey,
  purpose: "vehicle-sale",
  relyingPartyId: "notaria-17",
  notBefore: NOW - 60,
  expiresAt: NOW + 3600,
};
const context = { nowUnix: NOW, agentKey, purpose: "vehicle-sale", relyingPartyId: "notaria-17" };

test("a delegation signed by the subject is valid for its agent, purpose and counterparty", () => {
  const delegation = signDelegation(nodeSignatures, subjectSeed, body);
  assert.deepEqual(checkDelegation(nodeSignatures, delegation, context), {
    status: "valid",
    delegationId: body.id,
  });
});

test("each mismatch is refused with its own reason", () => {
  const delegation = signDelegation(nodeSignatures, subjectSeed, body);
  const cases = [
    [{ ...context, nowUnix: NOW + 3601 }, "expired"],
    [{ ...context, nowUnix: NOW - 61 }, "not_yet_valid"],
    [{ ...context, agentKey: "aa".repeat(32) }, "agent_mismatch"],
    [{ ...context, purpose: "lease" }, "purpose_mismatch"],
    [{ ...context, relyingPartyId: "notaria-18" }, "relying_party_mismatch"],
  ] as const;
  for (const [ctx, reason] of cases) {
    assert.deepEqual(checkDelegation(nodeSignatures, delegation, ctx), { status: "invalid", reason });
  }
});

test("widening any signed field breaks the signature before the context is read", () => {
  const delegation = signDelegation(nodeSignatures, subjectSeed, body);
  for (const tampered of [
    { ...delegation, expiresAt: NOW + 99_999 },
    { ...delegation, purpose: "lease" },
    { ...delegation, agentKey: "aa".repeat(32) },
    { ...delegation, relyingPartyId: "otra" },
  ]) {
    const result = checkDelegation(nodeSignatures, tampered, { ...context, agentKey: tampered.agentKey, purpose: tampered.purpose, relyingPartyId: tampered.relyingPartyId });
    assert.deepEqual(result, { status: "invalid", reason: "bad_signature" });
  }
});

test("a delegation signed by someone other than the key it names is refused", () => {
  const other = nodeSignatures.randomSeed();
  assert.throws(() => signDelegation(nodeSignatures, other, body));
  const forged = { ...signDelegation(nodeSignatures, subjectSeed, body), subjectKey: toHex(nodeSignatures.publicKeyOf(other)) };
  assert.deepEqual(checkDelegation(nodeSignatures, forged, context), { status: "invalid", reason: "bad_signature" });
});

test("a malformed body is refused at signing and at checking", () => {
  assert.throws(() => signDelegation(nodeSignatures, subjectSeed, { ...body, expiresAt: body.notBefore }));
  assert.throws(() => signDelegation(nodeSignatures, subjectSeed, { ...body, purpose: "Not A Purpose" }));
  const delegation = signDelegation(nodeSignatures, subjectSeed, body);
  assert.deepEqual(checkDelegation(nodeSignatures, { ...delegation, signature: "zz" }, context), {
    status: "invalid",
    reason: "malformed",
  });
});
