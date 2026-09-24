// portable.spec.ts: criterio P8 — lo que el teléfono empaqueta cabe en Expo.
// core/test/invariant/portable.invariant.spec.ts fija lo mismo para los
// paquetes del dominio, pero nunca mira `app/`, que es justamente el código que
// Metro empaqueta. `node --test` corre bajo Node, donde `Buffer` y `node:crypto`
// existen: una prueba verde no dice nada sobre el bundle si nadie lo comprueba.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const APP = fileURLToPath(new URL("../../", import.meta.url));
// What Metro bundles: the domain and the screens. `test/` runs under Node and
// is deliberately allowed the builtins the app may not have.
const BUNDLED = ["src", "app"];
// Node-only or heavyweight packages no bundled file may pull in.
const FORBIDDEN_MODULES = [
  "@stellar/stellar-sdk",
  "stellar-base",
  "stellar-sdk",
  "node-fetch",
  "crypto",
  "buffer",
];

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

// Comments explain why these names are absent, so they must not count as uses.
const codeOf = (source: string): string =>
  source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

const bundledFiles = (): readonly string[] => BUNDLED.flatMap((dir) => filesUnder(join(APP, dir)));

const importsOf = (code: string): readonly string[] =>
  Array.from(code.matchAll(/(?:from|import|require\()\s*["']([^"']+)["']/g), (match) => match[1] ?? "");

test("the bundled app has files to check", () => {
  assert.ok(bundledFiles().length >= 10);
});

test("no bundled file imports a node builtin", () => {
  const offenders = bundledFiles().filter((path) => /from\s+["']node:/.test(codeOf(readFileSync(path, "utf8"))));
  assert.deepEqual(offenders, []);
});

test("no bundled file uses Buffer, which React Native does not have", () => {
  const offenders = bundledFiles().filter((path) => /\bBuffer\b/.test(codeOf(readFileSync(path, "utf8"))));
  assert.deepEqual(offenders, []);
});

test("no bundled file imports the Stellar SDK or another node-only package", () => {
  const offenders: string[] = [];
  for (const path of bundledFiles()) {
    const used = importsOf(codeOf(readFileSync(path, "utf8")));
    for (const module of FORBIDDEN_MODULES) {
      if (used.some((name) => name === module || name.startsWith(`${module}/`))) offenders.push(`${path}: ${module}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("the payment module builds its XDR with the bytes both platforms have", async () => {
  const source = readFileSync(join(APP, "src/domain/stellar-payment.ts"), "utf8");
  // The three pieces the SDK would otherwise provide, written here on purpose.
  for (const primitive of ["Uint8Array", "DataView", "TextEncoder"]) {
    assert.match(source, new RegExp(`\\b${primitive}\\b`));
  }
  const { payQuote } = await import("../../src/domain/stellar-payment.ts");
  assert.equal(typeof payQuote, "function");
});
