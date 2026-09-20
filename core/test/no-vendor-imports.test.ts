// core/test/no-vendor-imports.test.ts
// Chain-agnostic and vendor-agnostic, enforced rather than promised.
//
// The failure mode this catches is mundane and fatal: someone imports a
// Stellar SDK into a predicate "just to format an address", and the domain
// layer is now pinned to one chain. Keeping core dependency-free is what
// makes the Stellar adapter replaceable at all.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = new URL("../src/", import.meta.url).pathname;

// node: builtins are fine — crypto and its randomness are the one thing a
// commitment scheme cannot provide for itself. Everything else must be a
// relative import inside this workspace.
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
    readFileSync(new URL("../package.json", import.meta.url).pathname, "utf8"),
  ) as { dependencies?: Record<string, string> };
  assert.deepEqual(manifest.dependencies ?? {}, {});
});
