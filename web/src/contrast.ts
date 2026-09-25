// contrast.ts: la fórmula de contraste de WCAG 2.1 y el lector de la paleta.
// La tabla de web/DESIGN.md es el resultado de esto, no un número copiado: si
// un token de app/src/theme.ts cambia, la prueba lo dice antes que un usuario.
//
// `theme.ts` se lee como texto a propósito. Vive en app/, que el tsconfig de la
// raíz excluye, así que importarlo no es una opción — y copiar sus valores aquí
// sería la segunda fuente que este archivo existe para evitar.

/// Un canal sRGB, de 0..1, linealizado. La constante es la de la especificación.
function channel(value: number): number {
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/// Luminancia relativa de `#rrggbb`. Devuelve `undefined` para lo que no lo sea:
/// un color mal escrito no debe salir como negro y pasar la tabla.
export function relativeLuminance(hex: string): number | undefined {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return undefined;
  const n = Number.parseInt(hex.slice(1), 16);
  const r = channel(((n >> 16) & 255) / 255);
  const g = channel(((n >> 8) & 255) / 255);
  const b = channel((n & 255) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/// La razón entre dos colores, siempre ≥ 1. `undefined` si alguno no es color.
export function contrastRatio(a: string, b: string): number | undefined {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === undefined || lb === undefined) return undefined;
  const [high, low] = la >= lb ? [la, lb] : [lb, la];
  return (high + 0.05) / (low + 0.05);
}

/// AA para texto normal. El umbral no depende del dispositivo.
export const AA_NORMAL = 4.5;
/// AA para texto grande: ≥24 px, o ≥18.7 px en negrita.
export const AA_LARGE = 3;

export type Palette = Readonly<Record<string, string>>;

/// Lee los pares `nombre: "#rrggbb"` de la fuente de `theme.ts`. Devuelve
/// `undefined` si no encuentra ninguno: un formato que cambió no debe salir
/// como una paleta vacía que cumple todo por no tener nada.
export function parsePalette(source: string): Palette | undefined {
  const entries: [string, string][] = [];
  for (const match of source.matchAll(/(\w+):\s*"(#[0-9a-fA-F]{6})"/g)) {
    entries.push([match[1]!, match[2]!]);
  }
  return entries.length === 0 ? undefined : Object.freeze(Object.fromEntries(entries));
}
