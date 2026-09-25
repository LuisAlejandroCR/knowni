// contrast.spec.ts: la tabla de web/DESIGN.md deja de ser una afirmación.
// Se recalcula desde app/src/theme.ts y se compara con lo publicado, igual que
// CI regenera los .circom en vez de creerlos.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { AA_NORMAL, contrastRatio, parsePalette, relativeLuminance } from "../../src/contrast.ts";

const theme = readFileSync(new URL("../../../app/src/theme.ts", import.meta.url), "utf8");
const palette = parsePalette(theme);
const design = readFileSync(new URL("../../DESIGN.md", import.meta.url), "utf8");

test("la fórmula reproduce los dos extremos conocidos de WCAG", () => {
  assert.equal(relativeLuminance("#ffffff"), 1);
  assert.equal(relativeLuminance("#000000"), 0);
  assert.equal(contrastRatio("#ffffff", "#000000"), 21);
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
});

test("un color mal escrito no sale como negro", () => {
  assert.equal(relativeLuminance("#fff"), undefined);
  assert.equal(relativeLuminance("rojo"), undefined);
  assert.equal(contrastRatio("#ffffff", "nope"), undefined);
});

test("un formato de theme.ts que cambió no sale como paleta vacía", () => {
  assert.equal(parsePalette("export const nada = 1;"), undefined);
});

test("la paleta se lee de app/src/theme.ts, que es su única fuente", () => {
  assert.ok(palette !== undefined);
  assert.equal(palette["deep"], "#193e36");
  assert.equal(palette["inkFaint"], "#68756a");
});

// Las tres prohibiciones de web/DESIGN.md. Están aquí y no solo en el
// documento porque una prohibición que nadie comprueba es una sugerencia.
test("`--ink-faint` no llega a AA sobre page, lime-soft ni amber", () => {
  assert.ok(palette !== undefined);
  for (const surface of ["page", "limeSoft", "amber"]) {
    const ratio = contrastRatio(palette["inkFaint"]!, palette[surface]!);
    assert.ok(ratio !== undefined && ratio < AA_NORMAL, `inkFaint sobre ${surface}: ${ratio}`);
  }
});

test("`--ink-soft` es la tinta terciaria que sí sirve en esas tres", () => {
  assert.ok(palette !== undefined);
  for (const surface of ["page", "limeSoft", "amber"]) {
    const ratio = contrastRatio(palette["inkSoft"]!, palette[surface]!);
    assert.ok(ratio !== undefined && ratio >= AA_NORMAL, `inkSoft sobre ${surface}: ${ratio}`);
  }
});

test("cada par tinta/superficie que la página usa cumple AA", () => {
  assert.ok(palette !== undefined);
  const used: readonly (readonly [string, string])[] = [
    ["ink", "page"], ["ink", "card"],
    ["inkSoft", "page"], ["inkSoft", "card"],
    ["deep", "limeSoft"],
    ["amberInk", "amber"],
    ["canvas", "deep"], ["lime", "deep"],
  ];
  for (const [ink, surface] of used) {
    const ratio = contrastRatio(palette[ink]!, palette[surface]!);
    assert.ok(ratio !== undefined && ratio >= AA_NORMAL, `${ink} sobre ${surface}: ${ratio}`);
  }
});

test("los números publicados en DESIGN.md son los que salen de la fórmula", () => {
  assert.ok(palette !== undefined);
  const surfaces = ["card", "canvas", "page", "limeSoft", "amber", "deep"] as const;
  // Solo las filas de contraste: seis celdas, todas «razón + veredicto». La
  // tabla de paleta empieza igual y por eso hay que distinguirlas por la forma
  // de las celdas, no por la del token — que fue lo que falló al escribirlo.
  const cell = /^\**\d+\.\d{2} (ok|LG|NO)\**$/;
  const rows = [...design.matchAll(/^\| `--([a-z-]+)` \| (.+) \|$/gm)];
  const checked = rows.filter(([, token, cells]) => {
    const camel = token!.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
    const parts = cells!.split("|").map((part) => part.trim());
    return palette[camel] !== undefined && parts.length === 6 && parts.every((part) => cell.test(part));
  });
  assert.ok(checked.length >= 7, `filas de contraste encontradas: ${checked.length}`);

  for (const [, token, cells] of checked) {
    const camel = token!.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
    const published = cells!.split("|").map((cell) => cell.trim());
    assert.equal(published.length, surfaces.length, `fila ${token}`);
    published.forEach((cell, index) => {
      const shown = Number.parseFloat(cell.replace(/\*/g, ""));
      const actual = contrastRatio(palette[camel]!, palette[surfaces[index]!]!);
      assert.ok(actual !== undefined);
      assert.equal(
        shown.toFixed(2),
        actual.toFixed(2),
        `${token} sobre ${surfaces[index]}: publicado ${shown}, calculado ${actual.toFixed(2)}`,
      );
    });
  }
});
