// domains.ts: every domain separator in the product, in one list.
// A domain that exists in two places drifts, and a drifted domain is a root
// that two implementations compute differently while both look right. The
// circuit reads this same list through `circuits/tools/domains.ts`.

export const DOMAINS = {
  claim: "knowni:claim:v1",
  outcome: "knowni:outcome:v1",
  merkleLeaf: "knowni:merkle:leaf:v1",
  merkleNode: "knowni:merkle:node:v1",
  merkleEmpty: "knowni:merkle:empty:v1",
  session: "knowni:session:v1",
  nullifier: "knowni:nullifier:v1",
} as const;

export type DomainName = keyof typeof DOMAINS;
