// retrieval/src/index.ts
// Entity resolution over public records. Read types.ts before adding a
// caller: the rule about who may call this port is the product's main
// privacy boundary, and it is a rule about call sites, not about types.

export type { Candidate, PublicRecord, RecordIndexPort, RecordQuery } from "./types.ts";
export { normalizeName, tokenOverlap, tokenizeName } from "./normalize.ts";
export type { Resolution, ResolutionPolicy } from "./resolve.ts";
export { SCREENING_POLICY, resolve, screen } from "./resolve.ts";
export { createMemoryIndex } from "./adapters/memory.ts";
export type { ChromaCollection, ChromaIndexOptions, ChromaSpace } from "./adapters/chroma.ts";
export { createChromaIndex, toSimilarity } from "./adapters/chroma.ts";
