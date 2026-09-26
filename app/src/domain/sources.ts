// sources.ts: the name a person reads for each source they can authorise.
// The ids travel to the issuer; these labels are what the screens show, so a
// consultation never reads "sicaac" where it means SICAAC's insolvency record.

export const SOURCE_LABEL: Readonly<Record<string, string>> = {
  registraduria: "Registraduría",
  sicaac: "SICAAC · insolvencia",
  listas: "Procuraduría, Contraloría y Contaduría",
  vehiculo: "RUNT y SIMIT",
};

export function sourceLabel(id: string): string {
  return SOURCE_LABEL[id] ?? id;
}
