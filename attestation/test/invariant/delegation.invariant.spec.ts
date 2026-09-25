// delegation.invariant.spec.ts: whatever a subject delegates, the delegation
// carries no subject secret, claim or salt — only keys, purpose and a window.

import { test } from "node:test";
import assert from "node:assert/strict";

import { toHex } from "@knowni/core";
import { delegationBytes, signDelegation } from "../../src/index.ts";
import { nodeSignatures } from "../../src/node.ts";

const ALLOWED = ["agentKey", "algorithm", "expiresAt", "id", "notBefore", "purpose", "relyingPartyId", "signature", "subjectKey"];

test("for any delegation, the fields are exactly the allowed ones and the seed never appears", () => {
  for (let round = 0; round < 200; round += 1) {
    const seed = nodeSignatures.randomSeed();
    const secret = nodeSignatures.randomSeed();
    const delegation = signDelegation(nodeSignatures, seed, {
      id: toHex(nodeSignatures.randomSeed()),
      subjectKey: toHex(nodeSignatures.publicKeyOf(seed)),
      agentKey: toHex(nodeSignatures.publicKeyOf(nodeSignatures.randomSeed())),
      purpose: round % 2 === 0 ? "vehicle-sale" : "lease",
      relyingPartyId: `rp-${round}`,
      notBefore: round,
      expiresAt: round + 1 + round * 7,
    });
    assert.deepEqual(Object.keys(delegation).sort(), ALLOWED);
    const serialized = JSON.stringify(delegation);
    assert.ok(!serialized.includes(toHex(seed)));
    assert.ok(!serialized.includes(toHex(secret)));
    assert.ok(!Buffer.from(delegationBytes(delegation)).includes(Buffer.from(seed)));
  }
});
