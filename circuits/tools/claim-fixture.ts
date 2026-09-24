// claim-fixture.ts: the one income claim the circuit and core are compared on.
// It lives here so the witness input and the assertion cannot drift apart: a
// fixture written twice is a fixture that agrees with itself and nothing else.

import type { Claim, Salt } from "@knowni/core";
import { encodeClaimFields } from "@knowni/core";
import { poseidonHash } from "@knowni/core/node";

export const SALT: Salt = { hex: "0b".repeat(32) };

export const INCOME: Claim = {
  kind: "income",
  jurisdiction: "CO",
  subjectRef: { hex: "0a".repeat(32) },
  monthlyMinor: 2_500_000,
  currency: "COP",
  basis: "contribution_base",
  provenance: "observed",
  periodsObserved: 11,
  periodsWindow: 12,
  attestedAt: 1_760_000_000,
};

// The signals IncomeCommitment takes, in its own names, from the encoding core
// uses. The order is claim-fields.ts's; the names are claims.circom's.
export function incomeInput(): Record<string, string> {
  const [, jurisdiction, subjectRef, monthlyMinor, currency, basis, provenance, periodsObserved, periodsWindow, attestedAt] =
    encodeClaimFields((value) => poseidonHash.element(value), INCOME, poseidonHash.prime);
  const fields = {
    jurisdiction,
    subjectRef,
    monthlyMinor,
    currency,
    basis,
    provenance,
    periodsObserved,
    periodsWindow,
    attestedAt,
    salt: poseidonHash.fromHex(SALT.hex, "salt"),
  };
  return Object.fromEntries(
    Object.entries(fields).map(([name, value]) => {
      if (value === undefined) throw new Error(`the income encoding has no element for ${name}`);
      return [name, value.toString()];
    }),
  );
}
