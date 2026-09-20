// sources/src/index.ts
// Source adapters and the issuance step. Colombia is the first jurisdiction;
// nothing in types.ts or issuer.ts knows that.

export type { SourceFailureReason, SourcePort, SourceResult, SubjectLookup } from "./types.ts";
export { degraded } from "./types.ts";

export type { HeldCredential, IssueRequest, IssuedSet } from "./issuer.ts";
export { issueClaimSet } from "./issuer.ts";

export type { PilaClient, PilaContribution, PilaOptions } from "./colombia/pila.ts";
export { createPilaFormalitySource, createPilaIncomeSource } from "./colombia/pila.ts";

export type { ListScreeningOptions } from "./colombia/listas.ts";
export { CO_DEFAULT_LISTS, createListScreeningSource } from "./colombia/listas.ts";

export type { SyntheticSubject } from "./synthetic/co.ts";
export {
  createSyntheticNameResolver,
  createSyntheticPilaClient,
  createSyntheticRegistraduriaSource,
} from "./synthetic/co.ts";
