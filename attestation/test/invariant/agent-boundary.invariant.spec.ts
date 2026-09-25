// agent-boundary.invariant.spec.ts: no agent surface reaches a source (G6).
// The delegation and agent modules import only core and their own workspace,
// so an agent missing evidence has no path but a new issuance with the subject.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const AGENT_MODULES = ["delegation.ts", "agent.ts"];
const ALLOWED = /^(?:\.\/[a-z-]+\.ts|@knowni\/core)$/;

test("agent modules import only core and sibling attestation modules", () => {
  const offenders: string[] = [];
  for (const name of AGENT_MODULES) {
    const source = readFileSync(fileURLToPath(new URL(`../../src/${name}`, import.meta.url)), "utf8");
    for (const match of source.matchAll(/^\s*(?:import|export)[\s\S]*?from\s+"([^"]+)"/gm)) {
      if (!ALLOWED.test(match[1]!)) offenders.push(`${name}: ${match[1]}`);
    }
    for (const word of ["fetch(", "croma", "@knowni/sources", "@knowni/issuer"]) {
      if (source.toLowerCase().includes(word.toLowerCase())) offenders.push(`${name}: ${word}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("sibling modules the agent path imports do not reach a source either", () => {
  for (const name of ["acceptance.ts", "results.ts", "presentation.ts", "signing.ts"]) {
    const source = readFileSync(fileURLToPath(new URL(`../../src/${name}`, import.meta.url)), "utf8");
    assert.ok(!source.includes("@knowni/sources") && !source.includes("@knowni/issuer"), name);
  }
});
