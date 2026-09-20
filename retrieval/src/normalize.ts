// retrieval/src/normalize.ts
// Name normalisation for Latin American registries, which is where most of
// the real matching difficulty lives.
//
// The source material is PDFs, OCR output and systems built before Unicode:
// the same person appears as "JOSÉ PEÑA", "JOSE PENA", "PENA JOSE" and
// "Jose  Peña  Gómez". A matcher that treats these as different people
// misses real hits; one that treats "PEÑA" and "PENA" as identical accepts
// that Peña and Pena are one surname, which they are not.
//
// This module takes the tolerant side and says so, because the cost is
// asymmetric: a false match is reviewed by a human before it becomes a
// claim, while a missed sanctions hit is a sanctions hit that got through.
// The raw text is preserved on the record for exactly that review.

const DIACRITICS = /[̀-ͯ]/g;

// Particles carried by compound Spanish and Portuguese surnames. They are
// dropped for matching because sources are inconsistent about them — "de la
// Cruz" is filed as "Delacruz", "De La Cruz" and "Cruz" in three different
// registries — and they carry almost no distinguishing signal.
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

// Order-insensitive token overlap. Chosen over edit distance because the
// dominant failure in these sources is REORDERING ("apellidos, nombres" vs
// "nombres apellidos"), not misspelling, and edit distance punishes
// reordering hardest.
export function tokenOverlap(a: string, b: string): number {
  const left = new Set(tokenizeName(a));
  const right = new Set(tokenizeName(b));
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;

  // Overlap against the SMALLER set, not the union. A sanctions entry
  // carrying five aliases should still match a two-token query naming the
  // person; Jaccard would score that low precisely when it matters most.
  return shared / Math.min(left.size, right.size);
}
