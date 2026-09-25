// prover.spec.ts: the proving port refuses every answer that is not a whole
// BLS12-381 proof, and says "unsupported" rather than failing where no native
// module is linked. The committed real proof is the answer it must accept.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createNativeProver, type NativeProver } from "../../src/domain/prover.ts";

const groth16 = (name: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../../circuits/groth16/${name}`, import.meta.url)), "utf8"));
const REAL = { proof: groth16("proof.json"), publicSignals: groth16("public.json") };

const answering = (answer: unknown): NativeProver => ({
  prove: async () => (typeof answer === "string" ? answer : JSON.stringify(answer)),
});

test("a real proof from the native module is accepted as it is", async () => {
  const outcome = await createNativeProver(answering(REAL)).prove({ a: "1" }, "/k.zkey");
  assert.equal(outcome.kind, "proved");
  if (outcome.kind === "proved") assert.deepEqual(outcome.publicSignals, REAL.publicSignals);
});

test("the input goes to the native side as JSON, and the key path unchanged", async () => {
  const seen: string[] = [];
  const native: NativeProver = {
    prove: async (input, zkey) => {
      seen.push(input, zkey);
      return JSON.stringify(REAL);
    },
  };
  await createNativeProver(native).prove({ issuerRoot: "7", idSiblings: ["1", "2"] }, "/data/eligibility.zkey");
  assert.deepEqual(seen, ['{"issuerRoot":"7","idSiblings":["1","2"]}', "/data/eligibility.zkey"]);
});

test("without a native module the answer is unsupported, not a failure", async () => {
  assert.deepEqual(await createNativeProver(undefined).prove({}, "/k.zkey"), { kind: "unsupported" });
});

test("a native error is a failure that does not carry the native text", async () => {
  const outcome = await createNativeProver(answering({ error: "opening /data/user/0/co.knowni/eligibility.zkey" })).prove({}, "/k");
  assert.deepEqual(outcome, { kind: "failed", reason: "prover_error" });
});

test("a module that throws or answers garbage fails with its own reason", async () => {
  const throwing: NativeProver = { prove: async () => { throw new Error("boom"); } };
  assert.deepEqual(await createNativeProver(throwing).prove({}, "/k"), { kind: "failed", reason: "native_error" });
  assert.deepEqual(await createNativeProver(answering("not json")).prove({}, "/k"), { kind: "failed", reason: "unreadable_answer" });
});

test("every partial or reshaped proof is refused", async () => {
  const proof = REAL.proof as Record<string, unknown>;
  const variants: unknown[] = [
    { ...REAL, publicSignals: (REAL.publicSignals as string[]).slice(1) },
    { ...REAL, publicSignals: [...(REAL.publicSignals as string[]).slice(1), "-1"] },
    { ...REAL, proof: { ...proof, curve: "bn128" } },
    { ...REAL, proof: { ...proof, pi_a: (proof["pi_a"] as string[]).slice(1) } },
    { ...REAL, proof: { ...proof, pi_b: [["1", "2"], ["3", "4"]] } },
    { ...REAL, proof: { ...proof, pi_c: [1, 2, 3] } },
    { publicSignals: REAL.publicSignals },
  ];
  for (const variant of variants) {
    const outcome = await createNativeProver(answering(variant)).prove({}, "/k");
    assert.deepEqual(outcome, { kind: "failed", reason: "malformed_proof" }, JSON.stringify(variant).slice(0, 80));
  }
});
