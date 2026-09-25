// groth16.spec.ts: the committed proof in circuits/groth16/ verifies against its
// key, says exactly what core's own fixture says it should, and stops verifying
// the moment any public signal is changed.

import { after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { eligibilityFixture, PUBLIC } from "../../tools/eligibility-fixture.ts";

interface Groth16 {
  verify(vk: unknown, signals: readonly string[], proof: unknown): Promise<boolean>;
}
const { groth16 } = createRequire(import.meta.url)("snarkjs") as { groth16: Groth16 };

// snarkjs keeps the curve and its worker threads in a global; without this the
// test process never exits.
after(async () => {
  const curve = (globalThis as { curve_bls12381?: { terminate(): Promise<void> } }).curve_bls12381;
  await curve?.terminate();
});

const dir =fileURLToPath(new URL("../../groth16/", import.meta.url));
const read = (name: string): unknown => JSON.parse(readFileSync(`${dir}${name}`, "utf8"));

const vk = read("verification_key.json") as { curve: string; nPublic: number };
const proof = read("proof.json");
const signals = read("public.json") as string[];

// The vector is the compiler's order: eligibility.signals.txt.
const ORDER = readFileSync(fileURLToPath(new URL("../../eligibility.signals.txt", import.meta.url)), "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line !== "" && !line.startsWith("#"));
const signal = (name: string): bigint => BigInt(signals[ORDER.indexOf(name)]!);

test("the key is over the curve Stellar verifies, with one slot per public signal", () => {
  assert.equal(vk.curve, "bls12381");
  assert.equal(vk.nPublic, ORDER.length);
  assert.equal(signals.length, ORDER.length);
});

test("the committed proof verifies", async () => {
  assert.equal(await groth16.verify(vk, signals, proof), true);
});

test("and it proves the fixture core builds, not some other statement", () => {
  const fixture = eligibilityFixture("bls12381");
  assert.equal(signal("issuerRoot"), fixture.issuerRoot);
  assert.equal(signal("sessionId"), PUBLIC.sessionId);
  assert.equal(signal("rentMinor"), PUBLIC.rentMinor);
  assert.equal(signal("listSetRoot"), PUBLIC.listSetRoot);
  assert.equal(signal("personhood"), fixture.outputs.personhood);
  assert.equal(signal("solvencyTier"), fixture.outputs.solvencyTier);
  assert.equal(signal("formality"), fixture.outputs.formality);
  assert.equal(signal("sanctions"), fixture.outputs.sanctions);
  assert.equal(signal("nullifier"), fixture.outputs.nullifier);
});

test("changing any one public signal breaks the proof", async () => {
  for (let i = 0; i < signals.length; i += 1) {
    const tampered = signals.map((value, at) => (at === i ? (BigInt(value) + 1n).toString() : value));
    assert.equal(await groth16.verify(vk, tampered, proof), false, `signal ${ORDER[i]} was not bound`);
  }
});
