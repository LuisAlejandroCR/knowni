// index.ts: entity resolution over public records.
// Normalisation and a resolution policy with a floor and a margin. No index and
// no adapter any more — B3 — because what this system reads is a typed API
// asked by document number. Read types.ts before adding a caller.

export type { Candidate, PublicRecord } from "./types.ts";
export { normalizeName, tokenOverlap, tokenizeName } from "./normalize.ts";
export type { Resolution, ResolutionPolicy } from "./resolve.ts";
export { SCREENING_POLICY, resolve, screen } from "./resolve.ts";
