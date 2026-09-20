// types.ts: Where a vector database belongs in a privacy system, and where it does not. READ
// THIS BEFORE ADDING A CALLER.

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
  readonly score: number;
}

// The port. An adapter is a Chroma collection, a Qdrant client, a Postgres
// pgvector table, or the in-memory lexical index in adapters/memory.ts.
export interface RecordIndexPort {
  readonly id: string;
  upsert(records: readonly PublicRecord[]): Promise<void>;
  search(query: RecordQuery): Promise<readonly Candidate[]>;
  snapshotRoot(): Promise<string>;
}
