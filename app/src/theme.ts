// theme.ts: the design tokens of design/day-08, as values the screens share.
// Colours, spacing and type scale live here so a change to the direction is one
// edit, not eight.

import { Appearance } from "react-native";

const light = {
  canvas: "#fafbf7",
  page: "#e7e9e4",
  ink: "#182c29",
  inkSoft: "#56655b",
  inkFaint: "#68756a",
  deep: "#193e36",
  lime: "#dbef9e",
  limeSoft: "#e8f0d8",
  line: "#dce2d8",
  card: "#ffffff",
  amber: "#fff4dd",
  amberLine: "#e8d0a3",
  amberInk: "#745015",
  amberSoft: "#ffe4ad",
  // Text and marks drawn on a `deep` fill (primary button, dark card).
  onDeep: "#ffffff",
  onDeepSoft: "#ccdbce",
  muted: "#edf1e9",
  divider: "#e8ece5",
  accent: "#698447",
  accentLine: "#b5cf80",
  track: "#dfe7d8",
  disabled: "#dde4d7",
  secondaryInk: "#294c3e",
  checkbox: "#b8c4b2",
};

// The same roles for a dark system appearance. `deep` flips to a light green so
// it still reads as the brand on a dark canvas; `onDeep` flips with it.
const dark: typeof light = {
  canvas: "#0f1714",
  page: "#16211d",
  ink: "#e8efe9",
  inkSoft: "#b3c1b6",
  inkFaint: "#93a296",
  deep: "#b9dc86",
  lime: "#2e4526",
  limeSoft: "#22331d",
  line: "#2c3a33",
  card: "#17221e",
  amber: "#33280f",
  amberLine: "#5a4620",
  amberInk: "#f3cf86",
  amberSoft: "#4a3a15",
  onDeep: "#0f1f18",
  onDeepSoft: "#2d4a2f",
  muted: "#1f2b26",
  divider: "#24302b",
  accent: "#9cc26a",
  accentLine: "#5f7d3e",
  track: "#2c3a33",
  disabled: "#26322c",
  secondaryInk: "#cfe6b0",
  checkbox: "#52625a",
};

// Read once at launch: styles are created at module load, so the appearance
// the app opens with is the one it keeps until it is reopened.
export const scheme: "light" | "dark" = Appearance.getColorScheme() === "dark" ? "dark" : "light";
export const color = scheme === "dark" ? dark : light;

export const space = {
  xs: 5,
  sm: 10,
  md: 15,
  lg: 24,
  xl: 34,
} as const;

export const type = {
  eyebrow: { fontSize: 11, letterSpacing: 1.8, fontWeight: "700" },
  label: { fontSize: 11, letterSpacing: 1.3, fontWeight: "700" },
  title: { fontSize: 32, lineHeight: 36, letterSpacing: -1.2, fontWeight: "800" },
  heading: { fontSize: 17, fontWeight: "700" },
  body: { fontSize: 14, lineHeight: 20 },
  small: { fontSize: 12, lineHeight: 17 },
} as const;

export const radius = { card: 18, button: 14, pill: 20, icon: 11 } as const;
