// components.tsx: the pieces every screen of design/day-08 is built from.
// Screen frame, cards, rows, notes and buttons — written once so eight screens
// stay one product rather than eight interpretations of it.

import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { color, radius, space, type } from "./theme.ts";

export function Screen({ children }: { readonly children: ReactNode }) {
  return <SafeAreaView style={styles.screen}>{children}</SafeAreaView>;
}

export function TopBar({ left, title, right }: { left?: ReactNode; title?: string; right?: ReactNode }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topSide}>{left}</View>
      {title === undefined ? null : <Text style={styles.topTitle}>{title}</Text>}
      <View style={[styles.topSide, styles.topRight]}>{right}</View>
    </View>
  );
}

export function Brand() {
  return (
    <View style={styles.brand}>
      <View style={styles.mark}>
        <Text style={styles.markText}>k</Text>
      </View>
      <Text style={styles.brandText}>knowni</Text>
    </View>
  );
}

export function Badge({ children }: { readonly children: ReactNode }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{children}</Text>
    </View>
  );
}

export function Label({ children }: { readonly children: ReactNode }) {
  return <Text style={styles.label}>{String(children).toUpperCase()}</Text>;
}

export function Title({ children }: { readonly children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Body({ children }: { readonly children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Card({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "deep" | "amber" }) {
  return <View style={[styles.card, tone === "deep" && styles.cardDeep, tone === "amber" && styles.cardAmber]}>{children}</View>;
}

// A row is the unit of an answer: an icon that names its state, a title, and
// the scope underneath. The scope is not decoration — it is what keeps an
// answer from being read as wider than it is.
export function Row({
  icon,
  title,
  scope,
  trailing,
}: {
  icon?: ReactNode;
  title: string;
  scope?: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      {icon === undefined ? null : <View style={styles.icon}>{icon}</View>}
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        {scope ? <Text style={styles.rowScope}>{scope}</Text> : null}
      </View>
      {trailing}
    </View>
  );
}

export function Note({ children }: { readonly children: ReactNode }) {
  return (
    <View style={styles.note}>
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

export function Button({
  children,
  onPress,
  tone = "primary",
  disabled = false,
}: {
  children: ReactNode;
  onPress?: () => void;
  tone?: "primary" | "secondary";
  disabled?: boolean;
}) {
  const isSecondary = tone === "secondary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      style={[styles.button, isSecondary && styles.buttonSecondary, disabled && styles.buttonDisabled]}
    >
      <Text style={[styles.buttonText, isSecondary && styles.buttonTextSecondary]}>{children}</Text>
    </Pressable>
  );
}

export function Footer({ children }: { readonly children: ReactNode }) {
  return <View style={styles.footer}>{children}</View>;
}

// Every screen of this block carries it: what is on the phone is the target
// design with demonstration data, and saying so is not optional.
export function DemoStamp({ children = "DISEÑO OBJETIVO · DATOS DE DEMOSTRACIÓN" }: { children?: string }) {
  return <Text style={styles.demo}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  topBar: {
    paddingHorizontal: space.lg,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topSide: { minWidth: 56 },
  topRight: { alignItems: "flex-end" },
  topTitle: { ...type.heading, color: color.ink },
  brand: { flexDirection: "row", alignItems: "center", gap: 7 },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: color.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: { color: color.lime, fontSize: 19, fontWeight: "800" },
  brandText: { fontSize: 25, letterSpacing: -1.5, fontWeight: "800", color: color.ink },
  badge: { backgroundColor: "#e9eee6", paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: "700", color: color.inkSoft },
  label: { ...type.label, color: "#5d6b60", marginBottom: 4 },
  title: { ...type.title, color: color.ink, marginVertical: space.sm },
  body: { ...type.body, color: color.inkSoft, marginBottom: space.md },
  card: {
    padding: space.md,
    backgroundColor: color.card,
    borderColor: color.line,
    borderWidth: 1,
    borderRadius: radius.card,
    marginVertical: 12,
  },
  cardDeep: { backgroundColor: color.deep, borderWidth: 0 },
  cardAmber: { backgroundColor: color.amber, borderColor: color.amberLine },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#e8ece5",
  },
  rowBody: { flex: 1 },
  rowTitle: { ...type.body, fontWeight: "700", color: color.ink },
  rowScope: { ...type.small, color: "#647267", marginTop: 3 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: radius.icon,
    backgroundColor: "#edf1e9",
    alignItems: "center",
    justifyContent: "center",
  },
  note: { borderLeftWidth: 3, borderLeftColor: "#b5cf80", paddingLeft: 12, paddingVertical: 3, marginVertical: space.md },
  noteText: { ...type.small, color: "#4f6052" },
  button: {
    backgroundColor: color.deep,
    borderRadius: radius.button,
    paddingVertical: 16,
    alignItems: "center",
    // 44 px is the floor for anything tappable; a smaller control is a
    // control someone cannot use.
    minHeight: 44,
    justifyContent: "center",
  },
  buttonSecondary: { backgroundColor: "transparent", paddingVertical: 12 },
  buttonDisabled: { backgroundColor: "#dde4d7" },
  buttonText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  buttonTextSecondary: { color: "#294c3e" },
  footer: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.xs },
  demo: { fontSize: 10, color: color.inkFaint, textAlign: "center", paddingBottom: 8 },
});
