// fixtures.ts: the synthetic content the screens render in this block.
// Nothing here is a real person, a real plate or a real registry answer, and
// nothing in this file reaches the network. B3 replaces it with the domain.

export interface RequestFixture {
  readonly counterparty: string;
  readonly purpose: string;
  readonly purposeLabel: string;
  readonly expiresInMinutes: number;
  readonly questions: readonly { readonly title: string; readonly scope: string }[];
}

export const REQUEST: RequestFixture = {
  counterparty: "Comprador",
  purpose: "vehicle-sale",
  purposeLabel: "Compraventa de vehículo",
  expiresInMinutes: 10,
  questions: [
    { title: "Vigencia del documento", scope: "Respuesta del registro consultado" },
    { title: "Registro de insolvencia", scope: "Alcance limitado a la fuente" },
    { title: "Listas solicitadas", scope: "Ver listas y alcance" },
    { title: "Estado del vehículo", scope: "Registro y alertas solicitadas" },
  ],
};

export interface ConsentFixture {
  readonly source: string;
  readonly needs: string;
}

export const CONSENTS: readonly ConsentFixture[] = [
  { source: "Registraduría", needs: "Documento · estado del registro" },
  { source: "SICAAC y listas declaradas", needs: "Datos exigidos por cada consulta" },
  { source: "RUNT / SIMIT", needs: "Identificadores requeridos del activo" },
];

// Progress is per source and never a percentage: a number invented to fill a
// bar is a number the screen cannot stand behind.
export type SourceState = "done" | "waiting" | "pending" | "unavailable";

export interface IssuanceStep {
  readonly source: string;
  readonly state: SourceState;
  readonly note: string;
}

export const ISSUANCE: readonly IssuanceStep[] = [
  { source: "Documento", state: "done", note: "Consulta terminada" },
  { source: "Registro de insolvencia", state: "done", note: "Consulta terminada" },
  { source: "Listas solicitadas", state: "waiting", note: "Esperando respuesta" },
  { source: "Vehículo", state: "pending", note: "Pendiente" },
];

export interface AnswerFixture {
  readonly answer: string;
  readonly scope: string;
}

export const ANSWERS: readonly AnswerFixture[] = [
  { answer: "Documento vigente", scope: "" },
  { answer: "Sin registro encontrado", scope: "Consulta de insolvencia declarada" },
  { answer: "Sin coincidencias", scope: "En las listas solicitadas" },
  { answer: "Sin alertas consultadas", scope: "Estado del vehículo" },
];

// What the counterparty does NOT receive, shown on the review screen because
// the product explains itself by showing rather than promising.
export const WITHHELD = ["Nombre", "N.º de documento", "Expediente"] as const;

export const VERIFIER_CHECKS = [
  { title: "Firma e integridad", note: "Emisor reconocido", state: "done" as const },
  { title: "Destinatario y solicitud", note: "Esta operación", state: "done" as const },
  {
    title: "Estado de revocación",
    note: "Copia consultada",
    state: "waiting" as const,
  },
];

export const DEGRADED = {
  source: "Estado del vehículo",
  note: "Fuente temporalmente no disponible",
  explanation: "No se emitió una respuesta negativa.\nReintentar no cambia tu resultado.",
} as const;
