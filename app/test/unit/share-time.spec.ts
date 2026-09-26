// share-time.spec.ts: la contraparte recibe la respuesta cuando se comparte, no
// cuando alguien abre su pantalla. Una respuesta compartida a tiempo se acepta
// aunque se mire después; una compartida tarde se rechaza.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryNullifierStore, type AttestedAnswer } from "@knowni/attestation";
import { demoRequest, demoResults } from "../../src/domain/demo-issuer.ts";
import { hydrateLedger, receivedAt, verifyOnDevice } from "../../src/domain/verifier.ts";

await hydrateLedger(createMemoryNullifierStore());

const ISSUED = 1_760_000_000;
const answers: AttestedAnswer[] = [
  { predicate: "personhood", value: true, source: "registraduria", provenance: "observed", doesNotEstimate: "No dice quién es." },
];

test("shared within the window, looked at ten minutes later: accepted", () => {
  const signed = demoRequest(ISSUED);
  const results = demoResults(signed.request, answers, ISSUED);
  const sharedAt = ISSUED + 60;
  const lookedAt = ISSUED + 600;
  const view = verifyOnDevice(signed, results, "t-a-tiempo", "live", "strict", receivedAt(sharedAt, lookedAt), ["personhood"]);
  assert.equal(view.accepted, true);
});

test("shared after the answer expired: refused", () => {
  const signed = demoRequest(ISSUED);
  const results = demoResults(signed.request, answers, ISSUED);
  const view = verifyOnDevice(signed, results, "t-tarde", "live", "strict", receivedAt(ISSUED + 400, ISSUED + 400), ["personhood"]);
  assert.equal(view.accepted, false);
});

test("nothing shared yet: the verifier judges at the moment it looks", () => {
  assert.equal(receivedAt(undefined, ISSUED + 5), ISSUED + 5);
});
