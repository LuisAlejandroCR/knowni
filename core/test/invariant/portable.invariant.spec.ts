// portable.invariant.spec.ts: the domain must import nothing React Native lacks.
// Checked mechanically, because "it should run on a phone" is the kind of
// claim that quietly stops being true one convenient import at a time.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

// src/ of the packages a phone bundles. `node.ts` is the deliberate exception
// in each: the platform binding, imported by tests and servers, never by the app.
const PORTABLE = ["core/src", "attestation/src", "sources/src"];
const PLATFORM_ONLY = ["node.ts"];

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

test("no domain file imports node:crypto or any other node builtin", () => {
  const offenders: string[] = [];
  for (const workspace of PORTABLE) {
    for (const path of filesUnder(join(ROOT, workspace))) {
      if (PLATFORM_ONLY.some((name) => path.endsWith(name))) continue;
      const source = readFileSync(path, "utf8");
      if (/from "node:/.test(source)) offenders.push(path);
    }
  }
  assert.deepEqual(offenders, []);
});

test("no domain file uses Buffer, which React Native does not have", () => {
  const offenders: string[] = [];
  for (const workspace of PORTABLE) {
    for (const path of filesUnder(join(ROOT, workspace))) {
      if (PLATFORM_ONLY.some((name) => path.endsWith(name))) continue;
      const source = readFileSync(path, "utf8");
      // Skip the comment lines that explain why Buffer is absent.
      const code = source
        .split("\n")
        .filter((line) => !line.trim().startsWith("//"))
        .join("\n");
      if (/\bBuffer\b/.test(code)) offenders.push(path);
    }
  }
  assert.deepEqual(offenders, []);
});

test("the byte helpers agree with what Node produces", async () => {
  const { toHex, fromHex, u32be, u64be, utf8 } = await import("../../src/bytes.ts");
  assert.equal(toHex(u32be(1)), "00000001");
  assert.equal(toHex(u64be(1n)), "0000000000000001");
  assert.equal(toHex(utf8("ñ")), "c3b1");
  assert.deepEqual(Array.from(fromHex("ff00")), [255, 0]);
  assert.throws(() => fromHex("FF"), /hex/);
});

test("randomness comes from Web Crypto, which both platforms have", async () => {
  const { randomBytes } = await import("../../src/random.ts");
  const a = randomBytes(32);
  const b = randomBytes(32);
  assert.equal(a.length, 32);
  assert.notEqual(toHexOf(a), toHexOf(b));
});

const toHexOf = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
