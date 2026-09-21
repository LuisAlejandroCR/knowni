// theme.ts: the design tokens of design/day-08, as values the screens share.
// Colours, spacing and type scale live here so a change to the direction is one
// edit, not eight.

export const color = {
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
} as const;

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
  title: { fontSize: 29, lineHeight: 32, letterSpacing: -1.2, fontWeight: "800" },
  heading: { fontSize: 17, fontWeight: "700" },
  body: { fontSize: 14, lineHeight: 20 },
  small: { fontSize: 12, lineHeight: 17 },
} as const;

export const radius = { card: 18, button: 14, pill: 20, icon: 11 } as const;
