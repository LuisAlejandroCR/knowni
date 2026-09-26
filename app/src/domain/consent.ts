// consent.ts: what is still missing before a consultation can be authorised.
// The button names the one thing to do next instead of a generic "not ready",
// so a person with sources ticked is not told to tick sources.

export interface ConsentInput {
  readonly consented: readonly string[];
  readonly documentNumber: string;
  readonly plate: string;
}

export const MIN_DOCUMENT_LENGTH = 5;
export const MIN_PLATE_LENGTH = 5;

export function consentBlocker(input: ConsentInput): string | undefined {
  if (input.consented.length === 0) return "Elige al menos una fuente";
  if (input.documentNumber.length < MIN_DOCUMENT_LENGTH) return "Escribe tu número de documento";
  if (input.consented.includes("vehiculo") && input.plate.length < MIN_PLATE_LENGTH) return "Escribe la placa del vehículo";
  return undefined;
}
