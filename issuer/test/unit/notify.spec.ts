// notify.spec.ts: the notice tells the subject to open the app, and nothing else.
// A message that carried the verdict would publish it to a lock screen, a
// forward and someone else's cloud backup.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createKapsoNotifier, createMetaNotifier, messageFor, noNotifier, notifierFromEnv } from "../../src/notify.ts";

const SESSION = "89a2c51ff75bcef88a47cf4674e13d5b17075ae0813d31c6c4865e39bda9d249";
const PHONE = "+573001112233";

test("the message carries no verdict, no counterparty and no purpose", () => {
  const text = messageFor(SESSION);
  for (const forbidden of ["true", "false", "unavailable", "notaria", "vehicle-sale", "cédula", "insolvencia"]) {
    assert.ok(!text.toLowerCase().includes(forbidden.toLowerCase()), `${forbidden} leaked into the notice`);
  }
  assert.match(text, /Ábrela en la app/);
  // Enough of the reference to match it in the app, not enough to be an id.
  assert.ok(text.includes(SESSION.slice(0, 8)));
  assert.ok(!text.includes(SESSION));
});

test("Kapso gets the phone and the notice, and nothing about the answer", async () => {
  let sent: { url: string; body: string } | undefined;
  const impl = (async (url: string, init: RequestInit) => {
    sent = { url: String(url), body: String(init.body) };
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;

  const notifier = createKapsoNotifier({ apiKey: "k", phoneNumberId: "123", fetchImpl: impl });
  assert.equal(await notifier.notify(PHONE, SESSION), true);
  assert.match(sent!.url, /whatsapp\/messages/);
  assert.ok(sent!.body.includes(PHONE));
  assert.ok(!sent!.body.includes(SESSION));
});

test("Meta's own number is the same message through a different door", async () => {
  const impl = (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
  const notifier = createMetaNotifier({ accessToken: "t", phoneNumberId: "123", fetchImpl: impl });
  assert.equal(notifier.channel, "meta");
  assert.equal(await notifier.notify(PHONE, SESSION), true);
});

test("a channel that fails does not fail the issuance", async () => {
  const impl = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  const notifier = createKapsoNotifier({ apiKey: "k", phoneNumberId: "1", fetchImpl: impl });
  assert.equal(await notifier.notify(PHONE, SESSION), false);
});

test("with no keys configured nothing is sent, and it says so", async () => {
  assert.equal(notifierFromEnv({}).channel, "none");
  assert.equal(await noNotifier.notify(PHONE, SESSION), false);
});

test("Kapso wins when both are configured, because it is the one you chose", () => {
  assert.equal(
    notifierFromEnv({
      KAPSO_API_KEY: "k",
      KAPSO_PHONE_NUMBER_ID: "1",
      META_WHATSAPP_TOKEN: "t",
      META_PHONE_NUMBER_ID: "2",
    }).channel,
    "kapso",
  );
  assert.equal(notifierFromEnv({ META_WHATSAPP_TOKEN: "t", META_PHONE_NUMBER_ID: "2" }).channel, "meta");
});
