// no-vendor-imports.test.ts: asserts core imports no chain SDK, HTTP client or vendor package.
// The architecture claim, checked mechanically rather than promised in a document.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

const ALLOWED_BARE = /^node:/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith(".ts") ? [full] : [];
  });
}

test("core imports nothing but node: builtins and its own modules", () => {
  const offenders: string[] = [];
  for (const file of walk(SRC)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/^\s*(?:import|export)[\s\S]*?from\s+"([^"]+)"/gm)) {
      const specifier = match[1]!;
      if (specifier.startsWith("./") || specifier.startsWith("../")) continue;
      if (ALLOWED_BARE.test(specifier)) continue;
      offenders.push(`${file}: ${specifier}`);
    }
  }
  assert.deepEqual(offenders, [], `core must stay vendor-free:\n${offenders.join("\n")}`);
});

test("core declares no runtime dependencies", () => {
  const manifest = JSON.parse(
    readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
  ) as { dependencies?: Record<string, string> };
  assert.deepEqual(manifest.dependencies ?? {}, {});
});
