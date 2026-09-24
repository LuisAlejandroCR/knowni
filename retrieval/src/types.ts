// types.ts: what entity resolution works on — a public record and a score for
// it. The index and its port are gone (B3); what a caller brings now is
// candidates from a source that answers by name. READ THIS BEFORE ADDING ONE.

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

export interface Candidate {
  readonly record: PublicRecord;
  readonly score: number;
}
