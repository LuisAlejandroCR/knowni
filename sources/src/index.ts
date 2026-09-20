// sources/src/index.ts
// Source adapters and the issuance step. Colombia is the first jurisdiction;
// nothing in types.ts or issuer.ts knows that.

export type { SourceFailureReason, SourcePort, SourceResult, SubjectLookup } from "./types.ts";
export { degraded } from "./types.ts";

export type { HeldCredential, IssueRequest, IssuedSet } from "./issuer.ts";
export { issueClaimSet } from "./issuer.ts";

export type { CromaClient, CromaClientOptions, CromaOutcome, CromaTelemetry } from "./croma/client.ts";
export { CROMA_BASE_URL, createCromaClient } from "./croma/client.ts";

export { VITAL_STATUS_PATH, createRegistraduriaPersonhoodSource } from "./croma/registraduria.ts";
export { INSOLVENCY_PATH, createSicaacCapacitySource } from "./croma/sicaac.ts";
export {
  CONTADURIA_PATH,
  CONTRALORIA_PATH,
  PROCURADURIA_PATH,
  createSanctionsSource,
  listSetRoot,
} from "./croma/sanctions.ts";
export type { VehicleLookup, VehicleStandingPort } from "./croma/vehicle.ts";
export { RUNT_VEHICLE_PATH, SIMIT_PATH, createVehicleStandingSource } from "./croma/vehicle.ts";

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
