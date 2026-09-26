// purpose.ts: the finality a request carries follows what the person authorised.
// Without RUNT and SIMIT there is no vehicle in the answer, so calling it a
// vehicle sale would name a purpose the answer cannot serve.

export const IDENTITY_CHECK = "identity-check";
export const VEHICLE_SALE = "vehicle-sale";

const LABEL: Record<string, string> = {
  [IDENTITY_CHECK]: "Verificación de identidad",
  [VEHICLE_SALE]: "Compraventa de vehículo",
};

export function purposeFor(consented: readonly string[]): string {
  return consented.includes("vehiculo") ? VEHICLE_SALE : IDENTITY_CHECK;
}

export function purposeLabel(purpose: string): string {
  return LABEL[purpose] ?? purpose;
}
