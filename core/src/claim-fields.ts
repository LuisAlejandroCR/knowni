// claim-fields.ts: a claim as a list of field elements.
// This is the shape a commitment takes once the hash is a circuit's hash, and
// it is the contract circuits/eligibility.circom has to meet. Distinct from
// commitment.ts, which still encodes to bytes for the sha256 hash in use.

import type { Claim } from "./claims.ts";
import { fieldFromBoolean, fieldFromHex, fieldFromUint } from "./field.ts";

/// The kind goes in as a number, not as a hashed string: it is a closed set
/// this file owns, and a claim of one kind must never encode to the same list
/// as a claim of another. Appending is safe; renumbering is a break.
export const KIND_TAG: Record<Claim["kind"], bigint> = {
  identity: 1n,
  income: 2n,
  formality: 3n,
  sanctions: 4n,
  capacity: 5n,
  assetStanding: 6n,
};

/// How many elements each kind encodes to. Fixed per kind, because a circuit's
/// hash has a fixed width and padding a variable-length list is how two
/// different claims end up with one commitment.
export const CLAIM_WIDTH: Record<Claim["kind"], number> = {
  identity: 8,
  income: 10,
  formality: 6,
  sanctions: 6,
  capacity: 6,
  assetStanding: 7,
};

/// The claim, as elements, in the order a commitment consumes them. The first
/// three are the same for every kind — tag, jurisdiction, subject — so a
/// reader can tell what it is looking at before it knows the schema.
/// `text` turns an open string into an element. It is passed in rather than
/// chosen here so there is one derivation in the product and the hasher owns
/// it — the same reason the domains live in one list.
export function encodeClaimFields(
  text: (value: string) => bigint,
  claim: Claim,
  prime: bigint,
): bigint[] {
  const head = [
    KIND_TAG[claim.kind],
    text(claim.jurisdiction),
    fieldFromHex(claim.subjectRef.hex, prime, "subjectRef"),
  ];

  const fields = ((): bigint[] => {
    switch (claim.kind) {
      case "identity":
        return [
          text(claim.documentKind),
          fieldFromBoolean(claim.documentValid),
          fieldFromBoolean(claim.subjectAlive),
          fieldFromBoolean(claim.ofAge),
          fieldFromUint(claim.attestedAt, "attestedAt"),
        ];
      case "income":
        return [
          fieldFromUint(claim.monthlyMinor, "monthlyMinor"),
          text(claim.currency),
          text(claim.basis),
          // What it measures and how it was learned are two fields, and both
          // are committed: a provenance outside the commitment is one an
          // issuer could downgrade after the fact.
          text(claim.provenance),
          fieldFromUint(claim.periodsObserved, "periodsObserved"),
          fieldFromUint(claim.periodsWindow, "periodsWindow"),
          fieldFromUint(claim.attestedAt, "attestedAt"),
        ];
      case "formality":
        return [
          fieldFromUint(claim.lastContributionMonth, "lastContributionMonth"),
          fieldFromUint(claim.monthsContributedLast12, "monthsContributedLast12"),
          fieldFromUint(claim.attestedAt, "attestedAt"),
        ];
      case "sanctions":
        return [
          fieldFromBoolean(claim.listed),
          fieldFromHex(claim.listSetRoot, prime, "listSetRoot"),
          fieldFromUint(claim.attestedAt, "attestedAt"),
        ];
      case "capacity":
        return [
          fieldFromBoolean(claim.restricted),
          text(claim.basis),
          fieldFromUint(claim.attestedAt, "attestedAt"),
        ];
      case "assetStanding":
        return [
          fieldFromBoolean(claim.registered),
          fieldFromBoolean(claim.encumbered),
          fieldFromBoolean(claim.finesOutstanding),
          fieldFromUint(claim.attestedAt, "attestedAt"),
        ];
    }
  })();

  const encoded = [...head, ...fields];
  // The width is declared, not counted after the fact: a schema that grows a
  // field and forgets the table would otherwise change every commitment of
  // that kind without anything saying so.
  if (encoded.length !== CLAIM_WIDTH[claim.kind]) {
    throw new RangeError(`${claim.kind} encodes to ${encoded.length} elements, not ${CLAIM_WIDTH[claim.kind]}`);
  }
  return encoded;
}
