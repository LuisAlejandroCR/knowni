// normalize.ts: folds a Latin American name into a comparable form.
// Accents, case, punctuation and compound-surname particles collapse, because
// reordering and diacritics are the dominant matching failures.

const DIACRITICS = /[̀-ͯ]/g;

const PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "da", "do", "dos", "e", "van", "von"]);

export function normalizeName(raw: string): string {
  return tokenizeName(raw).join(" ");
}

export function tokenizeName(raw: string): string[] {
  return raw
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    // Anything that is not a letter or digit is a separator: registries use
    // hyphens, periods, double spaces and non-breaking spaces interchangeably.
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0 && !PARTICLES.has(token));
}

export function tokenOverlap(a: string, b: string): number {
  const left = new Set(tokenizeName(a));
  const right = new Set(tokenizeName(b));
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;

  return shared / Math.min(left.size, right.size);
}
