// index.ts: entity resolution over public records.
// Normalisation and a resolution policy with a floor and a margin; read types.ts
// before adding a caller.

export type { Candidate, PublicRecord, RecordIndexPort, RecordQuery } from "./types.ts";
export { normalizeName, tokenOverlap, tokenizeName } from "./normalize.ts";
export type { Resolution, ResolutionPolicy } from "./resolve.ts";
export { SCREENING_POLICY, resolve, screen } from "./resolve.ts";
export { createMemoryIndex } from "./adapters/memory.ts";
export type { ChromaCollection, ChromaIndexOptions, ChromaSpace } from "./adapters/chroma.ts";
export { createChromaIndex, toSimilarity } from "./adapters/chroma.ts";
