// components.tsx: the pieces every screen of design/day-08 is built from.
// Screen frame, cards, rows, notes and buttons — written once so eight screens
// stay one product rather than eight interpretations of it.

import type { ReactNode } from "react";
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { color, radius, space, type } from "./theme.ts";
import { router, usePathname } from "expo-router";

export function Screen({ children }: { readonly children: ReactNode }) {
  return <SafeAreaView style={styles.screen}>{children}</SafeAreaView>;
}

export function TopBar({ left, title, right }: { left?: ReactNode; title?: string; right?: ReactNode }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topSide}>{left}</View>
      {title === undefined ? null : <Text accessibilityRole="header" numberOfLines={1} style={styles.topTitle}>{title}</Text>}
      <View style={[styles.topSide, styles.topRight]}>{right}</View>
    </View>
  );
}

// Back is a control like any other: a 44 px target, a role and a name a
// screen reader can say. A bare arrow glyph was none of the three.
export function BackButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Volver"
      hitSlop={8}
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
    >
      <Text style={styles.backText}>←</Text>
    </Pressable>
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

// A badge with an onPress is a control, and a control has to be reachable:
// 44 px of target and a role, or it is decoration pretending to be a button.
export function Badge({ children, onPress }: { readonly children: ReactNode; onPress?: () => void }) {
  if (onPress === undefined) {
    return (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{children}</Text>
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.badge, styles.badgeTappable, pressed && styles.pressed]}>
      <Text style={styles.badgeText}>{children}</Text>
    </Pressable>
  );
}

export function Label({ children }: { readonly children: ReactNode }) {
  return <Text style={styles.label}>{String(children).toUpperCase()}</Text>;
}

export function Title({ children }: { readonly children: ReactNode }) {
  return <Text accessibilityRole="header" style={styles.title}>{children}</Text>;
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
  onPress,
}: {
  icon?: ReactNode;
  title: string;
  scope?: string;
  trailing?: ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <>
      {icon === undefined ? null : (
        <View style={styles.icon}>{typeof icon === "string" ? <Text style={styles.iconText}>{icon}</Text> : icon}</View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        {scope ? <Text style={styles.rowScope}>{scope}</Text> : null}
      </View>
      {typeof trailing === "string" ? <Text style={styles.trailingText}>{trailing}</Text> : trailing}
    </>
  );
  if (onPress === undefined) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={scope ? `${title}. ${scope}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, styles.rowTappable, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
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
      style={({ pressed }) => [
        styles.button,
        isSecondary && styles.buttonSecondary,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, isSecondary && styles.buttonTextSecondary, disabled && styles.buttonTextDisabled]}>{children}</Text>
    </Pressable>
  );
}

// Four steps, named, with the current one marked. A person who cannot tell
// where they are in a flow cannot tell what is about to happen next.
export function Steps({ current }: { readonly current: 1 | 2 | 3 | 4 }) {
  const names = ["Solicitud", "Autorización", "Consulta", "Revisión"];
  return (
    <View style={styles.steps} accessibilityLabel={`Paso ${current} de 4: ${names[current - 1]}`}>
      {names.map((name, index) => {
        const state = index + 1 === current ? "on" : index + 1 < current ? "done" : "next";
        return (
          <View key={name} style={styles.step}>
            <View style={[styles.stepBar, state === "next" ? styles.stepBarNext : styles.stepBarOn]} />
            <Text style={[styles.stepText, state === "on" && styles.stepTextOn]}>{`${index + 1}. ${name}`}</Text>
          </View>
        );
      })}
    </View>
  );
}

// The way between the three places a person comes back to: their answers, their
// wallet and what they hold. The journey screens stay a stack above it.
const TABS = [
  { href: "/", label: "Inicio", icon: "⌂" },
  { href: "/firma", label: "Wallet", icon: "◎" },
  { href: "/espacio", label: "Mi espacio", icon: "☰" },
] as const;

export function TabBar() {
  const path = usePathname();
  return (
    <View style={styles.tabBar}>
      {TABS.map((tab) => {
        const on = path === tab.href;
        return (
          <Pressable
            key={tab.href}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: on }}
            onPress={() => { if (!on) router.replace(tab.href); }}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <Text importantForAccessibility="no" accessibilityElementsHidden style={[styles.tabIcon, on && styles.tabOn]}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, on && styles.tabOn]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// The iOS number pad has no return key; this bar gives every field a way out.
export const KEYBOARD_DONE = "knowni-keyboard-done";

// The same "Listo" bar for a TextInput that is not a Field.
export function KeyboardDone() {
  if (Platform.OS !== "ios") return null;
  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE}>
      <View style={styles.keyboardBar}>
        <Pressable accessibilityRole="button" onPress={Keyboard.dismiss} hitSlop={12}>
          <Text style={styles.keyboardDone}>Listo</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad";
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize="characters"
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        inputAccessoryViewID={Platform.OS === "ios" ? KEYBOARD_DONE : undefined}
        style={styles.input}
      />
      {Platform.OS === "ios" ? (
        <InputAccessoryView nativeID={KEYBOARD_DONE}>
          <View style={styles.keyboardBar}>
            <Pressable accessibilityRole="button" onPress={Keyboard.dismiss} hitSlop={12}>
              <Text style={styles.keyboardDone}>Listo</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </View>
  );
}

export function Footer({ children }: { readonly children: ReactNode }) {
  return <View style={styles.footer}>{children}</View>;
}

// Every screen of this block carries it: what is on the phone is the target
// design with demonstration data, and saying so is not optional.
// Kept as a slot so screens need not change, but it renders nothing: the
// technical footers were noise to the person reading the screen.
export function DemoStamp(_props: { children?: string }) {
  return null;
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
  topTitle: { ...type.heading, color: color.ink, flexShrink: 1, textAlign: "center" },
  back: { minWidth: 44, minHeight: 44, justifyContent: "center" },
  backText: { fontSize: 22, color: color.ink },
  // One pressed state for every control, so a tap always answers back.
  pressed: { opacity: 0.6 },
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
  badgeTappable: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
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
  rowTappable: { minHeight: 44 },
  rowBody: { flex: 1 },
  rowTitle: { ...type.body, fontWeight: "700", color: color.ink },
  iconText: { fontSize: 14, fontWeight: "700", color: color.deep },
  trailingText: { fontSize: 20, color: color.inkFaint },
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
  // White on the pale disabled fill was unreadable; a disabled label still has to be read.
  buttonTextDisabled: { color: color.inkFaint },
  steps: { flexDirection: "row", gap: 6, paddingVertical: 10 },
  step: { flex: 1 },
  stepBar: { height: 4, borderRadius: 3, marginBottom: 5 },
  stepBarOn: { backgroundColor: "#698447" },
  stepBarNext: { backgroundColor: "#dfe7d8" },
  stepText: { fontSize: 10, color: color.inkFaint },
  stepTextOn: { color: color.deep, fontWeight: "700" },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
    backgroundColor: color.canvas,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 48, paddingVertical: 4 },
  tabIcon: { fontSize: 20, color: color.inkFaint },
  tabLabel: { fontSize: 11, color: color.inkFaint, marginTop: 2 },
  tabOn: { color: color.deep, fontWeight: "700" },
  keyboardBar: {
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: color.page,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
  },
  keyboardDone: { color: color.deep, fontSize: 16, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.card,
    borderRadius: radius.button,
    paddingHorizontal: 14,
    minHeight: 48,
    fontSize: 16,
    color: color.ink,
  },
  footer: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.xs },
  demo: { fontSize: 10, color: color.inkFaint, textAlign: "center", paddingBottom: 8 },
});
