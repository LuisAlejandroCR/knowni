// retrieval/src/types.ts
// Where a vector database belongs in a privacy system, and where it does
// not.
//
// READ THIS BEFORE ADDING A CALLER. Semantic search over public records is
// not a zero-knowledge operation. A query carries the thing being looked
// for, in the clear, to whoever runs the index. If the relying party runs
// the search, the product is a data broker with extra steps — the landlord
// now holds the applicant's name, the registry hit, and the whole dossier
// the predicates were supposed to replace.
//
// So the boundary is a rule about WHO calls this, and it is the single most
// important design constraint in the repository:
//
//   ISSUANCE TIME (allowed)   The subject, or a source acting under the
//                             subject's consent, resolves them against
//                             public registries. The result becomes a
//                             CLAIM, which is committed, put in the
//                             issuer's tree, and thereafter only proven.
//   VERIFICATION TIME (never) The relying party never calls this port. They
//                             receive a Disclosure. There is no code path
//                             from a session to a search, and adding one
//                             would collapse the product.
//
// What the relying party gets instead is a listSetRoot: the snapshot that
// was searched, published and pinnable, so "not on the list" is auditable
// without anyone re-running a query about a person. See docs/ARCHITECTURE.md,
// "Where Chroma sits".

// A record as it exists in a public source: a sanctions list entry, a
// mercantile registry row, a fiscal-liability bulletin line. Public means
// published by an authority, not "findable" — a scraped social profile is
// not a public record and has no place in this index.
export interface PublicRecord {
  readonly id: string;
  readonly source: string; // e.g. "ofac-sdn", "co-procuraduria", "co-rues"
  readonly jurisdiction: string;
  // Free text as the source publishes it: names, aliases, roles. Kept
  // verbatim so a match can be shown to a human reviewer in an appeal.
  readonly text: string;
  // Structured fields a source happens to expose. Never required — most
  // Latin American registries publish PDFs and little else.
  readonly fields?: Readonly<Record<string, string>>;
}

export interface RecordQuery {
  readonly text: string;
  readonly sources?: readonly string[];
  readonly limit?: number;
}

export interface Candidate {
  readonly record: PublicRecord;
  // 0..1, higher is a closer match. Every adapter maps its own native
  // distance onto this range, so the resolution thresholds in resolve.ts
  // mean the same thing whichever index is underneath.
  readonly score: number;
}

// The port. An adapter is a Chroma collection, a Qdrant client, a Postgres
// pgvector table, or the in-memory lexical index in adapters/memory.ts.
export interface RecordIndexPort {
  readonly id: string;
  upsert(records: readonly PublicRecord[]): Promise<void>;
  search(query: RecordQuery): Promise<readonly Candidate[]>;
  // The published snapshot this index currently reflects. It is what ends
  // up in a StandingClaim's listSetRoot — the value that makes a "clean"
  // answer checkable rather than a matter of trust.
  snapshotRoot(): Promise<string>;
}
