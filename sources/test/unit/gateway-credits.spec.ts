// gateway-credits.spec.ts: The spend ceiling for the AI gateway: parsing, pricing and the rule
// that an unreadable meter is never read as "there is budget left".

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  JEV_INPUT_USD_PER_TOKEN,
  estimateUsd,
  parseCredits,
  readCredits,
  withinBudget,
} from "../../tools/gateway-credits.ts";

const respondWith = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

test("the meter's strings become numbers, exactly as the gateway sends them", () => {
  assert.deepEqual(parseCredits({ balance: "5", total_used: "0" }), {
    balanceUsd: 5,
    usedUsd: 0,
  });
});

test("a meter that is not two numbers is undefined, never a zero spend", () => {
  assert.equal(parseCredits({ balance: "n/a", total_used: "0" }), undefined);
  assert.equal(parseCredits(null), undefined);
  assert.equal(parseCredits({}), undefined);
});

test("the price is the one the gateway published, and it scales linearly", () => {
  assert.equal(JEV_INPUT_USD_PER_TOKEN, 0.000_000_042);
  // Classifying the 87 Colombian endpoints, one evaluation each at a
  // thousand tokens, costs less than half a cent.
  assert.ok(estimateUsd(87, 1_000) < 0.005);
  // And a thousand such evaluations still costs four cents.
  assert.equal(Number(estimateUsd(1_000, 1_000).toFixed(4)), 0.042);
  assert.equal(estimateUsd(2, 1_000), estimateUsd(1, 2_000));
});

test("the ceiling stops spending, and an empty balance stops it too", () => {
  assert.equal(withinBudget({ balanceUsd: 5, usedUsd: 0.5 }, 1), true);
  assert.equal(withinBudget({ balanceUsd: 5, usedUsd: 1.5 }, 1), false);
  assert.equal(withinBudget({ balanceUsd: 0, usedUsd: 0 }, 1), false);
});

test("a gateway that errors or times out reports no reading, so the caller cannot spend on a guess", async () => {
  assert.equal(await readCredits("k", respondWith(403, { error: "card required" })), undefined);
  const throws = (async () => {
    throw new Error("ENOTFOUND");
  }) as unknown as typeof fetch;
  assert.equal(await readCredits("k", throws), undefined);
});

test("a good reading comes back parsed, and the key is only ever a header", async () => {
  let seen: RequestInit | undefined;
  const impl = (async (_url: string, init: RequestInit) => {
    seen = init;
    return new Response(JSON.stringify({ balance: "4.87", total_used: "0.13" }), { status: 200 });
  }) as unknown as typeof fetch;
  assert.deepEqual(await readCredits("secret-key", impl), { balanceUsd: 4.87, usedUsd: 0.13 });
  assert.deepEqual(seen?.headers, { Authorization: "Bearer secret-key" });
});
