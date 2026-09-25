// eligibility-fixture.ts: the full witness input for eligibility.circom, built
// with core's own hasher on the curve asked for. The claims are committed with
// `commitClaim` and folded into a fixed-depth tree exactly as merkle.circom
// folds, so a proof over this input is a proof about what core would issue.

import type { Claim } from "@knowni/core";
import { BLS12_381_PRIME, BN254_PRIME, circomlibSpec, commitClaim, createPoseidonHasher, encodeClaimFields, poseidon } from "@knowni/core";
import type { FieldHasher } from "@knowni/core";
import { createHash } from "node:crypto";
import { INCOME, SALT } from "./claim-fixture.ts";

export type Curve = "bn128" | "bls12381";

/// Must match `Eligibility(20)` in eligibility.circom.
export const DEPTH = 20;

const sha256 = (bytes: Uint8Array): Uint8Array => Uint8Array.from(createHash("sha256").update(bytes).digest());

export function hasherFor(curve: Curve): FieldHasher {
  return curve === "bls12381"
    ? createPoseidonHasher(sha256, BLS12_381_PRIME, 255)
    : createPoseidonHasher(sha256, BN254_PRIME, 254);
}

export const IDENTITY: Claim = {
  kind: "identity",
  jurisdiction: "CO",
  documentKind: "CC",
  subjectRef: INCOME.subjectRef,
  documentValid: true,
  subjectAlive: true,
  ofAge: true,
  attestedAt: INCOME.attestedAt,
};

/// What the relying party asks. Rent at a third of income makes tier 3, and
/// the contribution history clears the formality window with room.
export const PUBLIC = {
  sessionId: 0x5e55n,
  rentMinor: 800_000n,
  nowMonth: 202609n,
  maxStaleMonths: 2n,
  minMonthsPaid: 6n,
  listSetRoot: 0x1157n,
} as const;

const SUBJECT_SECRET = 0x5ec2e7n;

/// The tree the fixture lives in: identity at leaf 0, income at leaf 1, and
/// every other slot empty. `core/src/merkle.ts` promotes a lone node instead of
/// padding (D-54), so its root for two leaves is not this one; the circuit's
/// fixed depth is what decides here.
function fixedDepthPaths(h: FieldHasher, commitments: readonly bigint[]) {
  const leaves = commitments.map((c) => h.hashFields("merkleLeaf", [c]));
  let empty = h.hashFields("merkleEmpty", [0n]);
  let level = leaves;
  const siblings: bigint[][] = commitments.map(() => []);
  const isRight: number[][] = commitments.map(() => []);
  let index = commitments.map((_, i) => i);

  for (let d = 0; d < DEPTH; d += 1) {
    const next: bigint[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(h.hashFields("merkleNode", [level[i]!, level[i + 1] ?? empty]));
    }
    index = index.map((at, k) => {
      const right = at % 2 === 1;
      siblings[k]!.push(right ? level[at - 1]! : (level[at + 1] ?? empty));
      isRight[k]!.push(right ? 1 : 0);
      return Math.floor(at / 2);
    });
    empty = h.hashFields("merkleNode", [empty, empty]);
    level = next;
  }
  return { root: level[0]!, siblings, isRight };
}

export interface EligibilityFixture {
  readonly input: Record<string, string | string[]>;
  /// The five outputs the circuit must disclose for this input, in order.
  readonly outputs: { personhood: bigint; solvencyTier: bigint; formality: bigint; sanctions: bigint; nullifier: bigint };
  readonly issuerRoot: bigint;
}

export function eligibilityFixture(curve: Curve): EligibilityFixture {
  const h = hasherFor(curve);
  const prime = h.prime;
  const idCommit = h.fromHex(commitClaim(h, IDENTITY, SALT), "identity");
  const incCommit = h.fromHex(commitClaim(h, INCOME, SALT), "income");
  const { root, siblings, isRight } = fixedDepthPaths(h, [idCommit, incCommit]);

  const [, idJur, idRef, idKind, , , , idAt] = encodeClaimFields((v) => h.element(v), IDENTITY, prime);
  const [, incJur, incRef, monthly, currency, basis, provenance, observed, window, incAt] = encodeClaimFields(
    (v) => h.element(v),
    INCOME,
    prime,
  );
  const salt = h.fromHex(SALT.hex, "salt");
  const str = (v: bigint | undefined): string => {
    if (v === undefined) throw new Error("the claim encoding is shorter than the circuit expects");
    return v.toString();
  };

  const input = {
    issuerRoot: str(root),
    sessionId: str(PUBLIC.sessionId),
    expectedSubjectRef: str(idRef),
    rentMinor: str(PUBLIC.rentMinor),
    nowMonth: str(PUBLIC.nowMonth),
    maxStaleMonths: str(PUBLIC.maxStaleMonths),
    minMonthsPaid: str(PUBLIC.minMonthsPaid),
    listSetRoot: str(PUBLIC.listSetRoot),

    idSubjectRef: str(idRef),
    idJurisdiction: str(idJur),
    idDocumentKind: str(idKind),
    documentValid: "1",
    subjectAlive: "1",
    ofAge: "1",
    idAttestedAt: str(idAt),
    idSalt: str(salt),
    idSiblings: siblings[0]!.map(str),
    idIsRight: isRight[0]!.map(String),

    incSubjectRef: str(incRef),
    incJurisdiction: str(incJur),
    monthlyMinor: str(monthly),
    incCurrency: str(currency),
    incBasis: str(basis),
    incProvenance: str(provenance),
    incPeriodsObserved: str(observed),
    incPeriodsWindow: str(window),
    incAttestedAt: str(incAt),
    incSalt: str(salt),
    incSiblings: siblings[1]!.map(str),
    incIsRight: isRight[1]!.map(String),

    lastContributionMonth: "202608",
    monthsPaid: "11",
    listed: "0",
    claimListSetRoot: str(PUBLIC.listSetRoot),
    subjectSecret: str(SUBJECT_SECRET),
  };

  const spec = circomlibSpec(prime, curve === "bls12381" ? 255 : 254, 3);
  return {
    input,
    issuerRoot: root,
    outputs: {
      personhood: 1n,
      solvencyTier: 3n,
      formality: 1n,
      sanctions: 1n,
      nullifier: poseidon([SUBJECT_SECRET, PUBLIC.sessionId], spec),
    },
  };
}
