// pitch-assets.spec.ts: keeps the jury pitch local, visual, and accessible.
// It tests structure and asset ownership without coupling to exact copy.
import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "../..");
const html = await readFile(resolve(root, "public/index.html"), "utf8");

test("pitch owns its visual assets and makes no third-party media request", () => {
  for (const name of ["knowni-private-vault.png", "knowni-vehicle-story.png"]) {
    assert.match(html, new RegExp(`/assets/${name}`));
    assert.ok(statSync(resolve(root, "public/assets", name)).size > 100_000);
  }
  assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//);
});

test("pitch preserves the demo, apps, and reduced-motion experiences", () => {
  assert.match(html, /id="demo"/);
  assert.match(html, /id="apps"/);
  assert.match(html, /Video pendiente/);
  assert.match(html, /QR del build de prueba pendiente/);
  assert.match(html, /prefers-reduced-motion:reduce/);
  assert.match(html, /animation-timeline:view\(\)/);
});

test("pitch has one story headline and an explicit expansion arc", () => {
  assert.equal(html.match(/<h1[ >]/g)?.length, 1);
  assert.match(html, /Colombia · ahora/);
  assert.match(html, /LATAM · después/);
  assert.match(html, /Global · por diseño/);
});
