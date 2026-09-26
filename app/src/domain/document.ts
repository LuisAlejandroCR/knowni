// document.ts: the identity documents a person can choose on the consent screen,
// and how each number is cleaned as it is typed. Cédulas are digits only;
// passports and PEP carry letters.

import type { DocumentKind } from "@knowni/core";

export const DOCUMENT_KINDS: readonly { readonly id: DocumentKind; readonly label: string }[] = [
  { id: "CC", label: "Cédula" },
  { id: "CE", label: "Cédula de extranjería" },
  { id: "PA", label: "Pasaporte" },
  { id: "PEP", label: "PEP" },
];

export function cleanDocumentNumber(kind: string, text: string): string {
  if (kind === "CC" || kind === "CE") return text.replace(/\D/g, "");
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
