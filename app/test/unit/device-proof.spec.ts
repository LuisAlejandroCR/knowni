// device-proof.spec.ts: the device check reports a time only for a proof that
// says what the example says, and passes every other state through unchanged.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runDeviceProof } from "../../src/domain/device-proof.ts";
import type { ProveOutcome, ProverPort } from "../../src/domain/prover.ts";
import type { KeyFiles } from "../../src/domain/proving-key.ts";
import { PROOF_FIXTURE_INPUT, PROOF_FIXTURE_OUTPUTS } from "../../src/proof-fixture.ts";

const REAL_SIGNALS = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../circuits/groth16/public.json", import.meta.url)), "utf8"),
) as string[];

const present: KeyFiles = { path: "/k", exists: () => true, download: async () => {}, remove: () => {} };
const prover = (outcome: ProveOutcome): ProverPort => ({ prove: async () => outcome });
const ticking = () => {
  let t = 1000;
  return () => (t += 2500) - 2500;
};

test("the example the app proves discloses what the committed proof discloses", () => {
  assert.deepEqual([...PROOF_FIXTURE_OUTPUTS], REAL_SIGNALS.slice(0, 4));
});

test("a proof of the example reports how long it took", async () => {
  const result = await runDeviceProof(
    prover({ kind: "proved", proof: {} as never, publicSignals: REAL_SIGNALS }),
    present,
    PROOF_FIXTURE_INPUT,
    PROOF_FIXTURE_OUTPUTS,
    "https://k",
    ticking(),
  );
  assert.deepEqual(result, { kind: "proved", millis: 2500, outputs: ["1", "3", "1", "1"] });
});

test("a proof of anything else is not reported as a success", async () => {
  const other = ["0", ...REAL_SIGNALS.slice(1)];
  const result = await runDeviceProof(
    prover({ kind: "proved", proof: {} as never, publicSignals: other }),
    present,
    PROOF_FIXTURE_INPUT,
    PROOF_FIXTURE_OUTPUTS,
    "https://k",
  );
  assert.equal(result.kind, "wrong_statement");
});

test("unsupported and failures pass through as they are", async () => {
  for (const outcome of [{ kind: "unsupported" }, { kind: "failed", reason: "prover_error" }] as ProveOutcome[]) {
    assert.deepEqual(await runDeviceProof(prover(outcome), present, {}, PROOF_FIXTURE_OUTPUTS, "https://k"), outcome);
  }
});
