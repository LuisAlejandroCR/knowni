// index.ts: source adapters and the issuance step.
// Colombia is the first jurisdiction and nothing in types.ts or issuer.ts
// knows it.

export type { PublicSourceState, SourceFailureReason, SourcePort, SourceResult, SubjectLookup } from "./types.ts";
export { degraded, publicStateOf } from "./types.ts";

export type { HeldCredential, IssueRequest, IssuedSet } from "./issuer.ts";
export { issueClaimSet } from "./issuer.ts";

export type { CromaClient, CromaClientOptions, CromaOutcome, CromaTelemetry } from "./providers/croma/client.ts";
export { CROMA_BASE_URL, createCromaClient } from "./providers/croma/client.ts";

export { VITAL_STATUS_PATH, createRegistraduriaPersonhoodSource } from "./country/colombia/registraduria.ts";
export { INSOLVENCY_PATH, createSicaacCapacitySource } from "./country/colombia/sicaac.ts";
export {
  CONTADURIA_PATH,
  CONTRALORIA_PATH,
  PROCURADURIA_PATH,
  createSanctionsSource,
  listSetRoot,
} from "./country/colombia/sanctions.ts";
export type { VehicleLookup, VehicleStandingPort } from "./country/colombia/vehicle.ts";
export { RUNT_VEHICLE_PATH, SIMIT_PATH, createVehicleStandingSource } from "./country/colombia/vehicle.ts";

export type { PilaClient, PilaContribution, PilaOptions } from "./country/colombia/pila.ts";
export { createPilaFormalitySource, createPilaIncomeSource } from "./country/colombia/pila.ts";

export type { UgppOptions, UgppPeriod, UgppStatement } from "./country/colombia/ugpp.ts";
export { UGPP_WINDOW_MONTHS, createUgppContributionSource, statementRef } from "./country/colombia/ugpp.ts";


export type { SyntheticSubject } from "./country/colombia/synthetic.ts";
export {
  createSyntheticSanctionsClient,
  SYNTHETIC_LIST_STAMPS,
  createSyntheticPilaClient,
  createSyntheticRegistraduriaSource,
} from "./country/colombia/synthetic.ts";
