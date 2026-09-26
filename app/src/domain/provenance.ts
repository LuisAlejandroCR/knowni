// provenance.ts: which parts of this session are real and which are still a demo,
// said once so every screen labels them the same way. The issuer is real when its
// key is pinned; the counterparty and the delivery stay a demo until they exist.

export function issuerIsReal(pinnedIssuerKeyHex: string | undefined = process.env.EXPO_PUBLIC_ISSUER_PUBLIC_KEY): boolean {
  return pinnedIssuerKeyHex !== undefined && pinnedIssuerKeyHex !== "";
}

// The phone trusts one pinned key; the issuer serves the key it signs with now.
// When both exist and differ, a refusal is a rotated key, not a forged answer.
export function issuerKeyChanged(pinnedHex: string | undefined, servedHex: string | undefined): boolean {
  if (pinnedHex === undefined || pinnedHex === "" || servedHex === undefined) return false;
  return pinnedHex.toLowerCase() !== servedHex.toLowerCase();
}

export function sessionStamp(realIssuer: boolean = issuerIsReal()): string {
  return realIssuer
    ? "FUENTES Y EMISOR REALES"
    : "EMISOR Y CONTRAPARTE DE DEMOSTRACIÓN · FUENTES REALES";
}

export function acceptanceStamp(realIssuer: boolean = issuerIsReal()): string {
  return realIssuer
    ? "VERIFICADO EN ESTE DISPOSITIVO · EMISOR REAL"
    : "ACEPTACIÓN REAL · EMISOR Y CONTRAPARTE DE DEMOSTRACIÓN";
}

export function receiptStamp(realIssuer: boolean = issuerIsReal()): string {
  return realIssuer ? "RESPUESTA FIRMADA POR EL EMISOR" : "ACUSE SIMULADO · DATOS DE DEMOSTRACIÓN";
}
