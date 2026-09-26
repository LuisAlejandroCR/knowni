// components.tsx: the pieces every screen of design/day-08 is built from.
// Screen frame, cards, rows, notes and buttons — written once so eight screens
// stay one product rather than eight interpretations of it.

import { useEffect, useRef, type ReactNode } from "react";
import { type StyleProp, type TextStyle, AccessibilityInfo, ActivityIndicator, Animated, InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { color, radius, space, type } from "./theme.ts";
import { router, usePathname } from "expo-router";
import { lightTap } from "./haptics.ts";
import Ionicons from "@expo/vector-icons/Ionicons";

export function Screen({ children }: { readonly children: ReactNode }) {
  return <SafeAreaView style={styles.screen}>{children}</SafeAreaView>;
}

// Every screen off the tab roots gets a way back by default: a screen that
// cannot be left except by finishing it is a trap.
export function TopBar({ left, title, right }: { left?: ReactNode; title?: string; right?: ReactNode }) {
  const path = usePathname();
  const isRoot = TABS.some((tab) => tab.href === path);
  return (
    <View style={styles.topBar}>
      <View style={styles.topSide}>{left ?? (isRoot ? null : <BackButton />)}</View>
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
      <Ionicons name="chevron-back" size={26} color={color.ink} />
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
export function Badge({
  children,
  onPress,
  selected = false,
}: {
  readonly children: ReactNode;
  onPress?: () => void;
  selected?: boolean;
}) {
  if (onPress === undefined) {
    return (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{children}</Text>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.badge, styles.badgeTappable, selected && styles.badgeSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.badgeText, selected && styles.badgeTextSelected]}>{children}</Text>
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

// Content settles in instead of popping: a short fade and rise when it mounts.
// Skipped when the person asked the system to reduce motion.
function useEntrance() {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) progress.setValue(1);
      else Animated.timing(progress, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [progress]);
  return {
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };
}

export function Card({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "deep" | "amber" }) {
  const entrance = useEntrance();
  return (
    <Animated.View style={[styles.card, tone === "deep" && styles.cardDeep, tone === "amber" && styles.cardAmber, entrance]}>
      {children}
    </Animated.View>
  );
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
  checked,
}: {
  icon?: ReactNode;
  title: string;
  scope?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  checked?: boolean;
}) {
  const tone = typeof icon === "string" ? ICON_TONE[icon] : undefined;
  const content = (
    <>
      {icon === undefined ? null : (
        <View style={[styles.icon, tone?.box]}>
          {typeof icon === "string" ? <Glyph glyph={icon} size={18} style={[styles.iconText, tone?.text]} /> : icon}
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        {scope ? <Text style={styles.rowScope}>{scope}</Text> : null}
      </View>
      {typeof trailing === "string" ? <Glyph glyph={trailing} size={20} style={styles.trailingText} /> : trailing}
    </>
  );
  if (onPress === undefined) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole={checked === undefined ? "button" : "checkbox"}
      accessibilityState={checked === undefined ? undefined : { checked }}
      accessibilityLabel={scope ? `${title}. ${scope}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, styles.rowTappable, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

// The glyph already names the state; the colour makes it readable at a glance:
// green for an answer with evidence, amber for one the source could not give,
// an empty box for something not yet chosen.
// Screens keep writing the short glyphs they always did; here each one becomes
// a drawn icon, so a check looks like a check on every font and platform.
// Anything not in the map (a step number, say) stays text.
const GLYPH_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  "✓": "checkmark",
  "!": "alert",
  "↗": "arrow-forward",
  "›": "chevron-forward",
  "◎": "wallet-outline",
  "🔒": "lock-closed",
};

export function Glyph({ glyph, size, style }: { glyph: string; size: number; style?: StyleProp<TextStyle> }) {
  if (glyph === "□") return null;
  const name = GLYPH_ICON[glyph];
  if (name === undefined) return <Text style={style}>{glyph}</Text>;
  const flat = StyleSheet.flatten(style) ?? {};
  return <Ionicons name={name} size={size} color={typeof flat.color === "string" ? flat.color : color.deep} />;
}

const ICON_TONE: Record<string, { box: object; text: object } | undefined> = {
  "✓": { box: { backgroundColor: color.lime }, text: { color: color.deep } },
  "!": { box: { backgroundColor: "#ffe4ad" }, text: { color: color.amberInk } },
  "□": { box: { backgroundColor: color.card, borderWidth: 2, borderColor: "#b8c4b2" }, text: {} },
};

// A result the person has to read: success, warning or plain information, each
// with its own colour and glyph. Bare text inside a tinted card was unreadable
// on the dark one and easy to miss on the amber one.
const CALLOUT = {
  success: { glyph: "✓", box: { backgroundColor: color.deep }, badge: { backgroundColor: color.lime }, title: { color: "#ffffff" }, text: { color: "#ccdbce" } },
  warning: { glyph: "!", box: { backgroundColor: color.amber, borderWidth: 1, borderColor: color.amberLine }, badge: { backgroundColor: "#ffe4ad" }, title: { color: color.amberInk }, text: { color: color.amberInk } },
} as const;

export function Callout({
  tone,
  title,
  children,
  onPressText,
}: {
  tone: keyof typeof CALLOUT;
  title: string;
  children?: ReactNode;
  onPressText?: () => void;
}) {
  const look = CALLOUT[tone];
  const entrance = useEntrance();
  return (
    <Animated.View accessibilityRole={tone === "warning" ? "alert" : undefined} style={[styles.callout, look.box, entrance]}>
      <View style={[styles.calloutBadge, look.badge]}>
        <Glyph glyph={look.glyph} size={18} style={[styles.iconText, { color: tone === "success" ? color.deep : color.amberInk }]} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.calloutTitle, look.title]}>{title}</Text>
        {children === undefined ? null : (
          <Text
            onPress={onPressText}
            accessibilityRole={onPressText === undefined ? undefined : "link"}
            style={[styles.calloutText, look.text, onPressText !== undefined && styles.link]}
          >
            {children}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

// For a row whose state is "still working": motion says it is alive.
export function Spinner() {
  return <ActivityIndicator size="small" color={color.deep} />;
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
  loading = false,
}: {
  children: ReactNode;
  onPress?: () => void;
  tone?: "primary" | "secondary";
  disabled?: boolean;
  loading?: boolean;
}) {
  const isSecondary = tone === "secondary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={
        disabled || onPress === undefined
          ? undefined
          : () => {
              if (!isSecondary) void lightTap();
              onPress();
            }
      }
      style={({ pressed }) => [
        styles.button,
        isSecondary && styles.buttonSecondary,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={styles.buttonInner}>
        {loading ? <ActivityIndicator size="small" color={color.inkFaint} /> : null}
        <Text style={[styles.buttonText, isSecondary && styles.buttonTextSecondary, disabled && styles.buttonTextDisabled]}>{children}</Text>
      </View>
    </Pressable>
  );
}

// Four steps, named, with the current one marked. A person who cannot tell
// where they are in a flow cannot tell what is about to happen next.
const JOURNEY_STEPS = ["Solicitud", "Autorización", "Consulta", "Revisión"] as const;

export function Steps({ current, names = JOURNEY_STEPS }: { readonly current: number; readonly names?: readonly string[] }) {
  return (
    <View style={styles.steps} accessibilityLabel={`Paso ${current} de ${names.length}: ${names[current - 1]}`}>
      {names.map((name, index) => {
        const state = index + 1 === current ? "on" : index + 1 < current ? "done" : "next";
        return (
          <View key={name} style={styles.step}>
            <View style={styles.stepHead}>
              <View style={[styles.stepDot, state === "on" && styles.stepDotOn, state === "done" && styles.stepDotDone]}>
                <Text style={[styles.stepDotText, state !== "next" && styles.stepDotTextOn]}>
                  {state === "done" ? "✓" : index + 1}
                </Text>
              </View>
              {index < names.length - 1 ? (
                <View style={[styles.stepLine, state === "done" ? styles.stepBarOn : styles.stepBarNext]} />
              ) : null}
            </View>
            <Text style={[styles.stepText, state === "on" && styles.stepTextOn]}>{name}</Text>
          </View>
        );
      })}
    </View>
  );
}

// The way between the three places a person comes back to: their answers, their
// wallet and what they hold. The journey screens stay a stack above it.
const TABS = [
  { href: "/", label: "Inicio", icon: "home" },
  { href: "/firma", label: "Wallet", icon: "wallet" },
  { href: "/espacio", label: "Mi espacio", icon: "file-tray-full" },
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
            <View style={[styles.tabPill, on && styles.tabPillOn]}>
              <Ionicons
                importantForAccessibility="no"
                accessibilityElementsHidden
                name={on ? tab.icon : `${tab.icon}-outline`}
                size={22}
                color={on ? color.deep : color.inkFaint}
              />
            </View>
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

// A soft lift so cards read as objects on the page rather than outlines.
const shadow = {
  shadowColor: "#193e36",
  shadowOpacity: 0.07,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

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
  badgeSelected: { backgroundColor: color.deep },
  badgeTextSelected: { color: color.lime },
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
    ...shadow,
  },
  cardDeep: { backgroundColor: color.deep, borderWidth: 0, padding: space.lg },
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
    width: 36,
    height: 36,
    borderRadius: radius.icon,
    backgroundColor: "#edf1e9",
    alignItems: "center",
    justifyContent: "center",
  },
  note: { borderLeftWidth: 3, borderLeftColor: "#b5cf80", paddingLeft: 12, paddingVertical: 3, marginVertical: space.md },
  noteText: { ...type.small, color: "#4f6052" },
  button: {
    backgroundColor: color.deep,
    borderRadius: radius.pill,
    paddingVertical: 17,
    alignItems: "center",
    // 44 px is the floor for anything tappable; a smaller control is a
    // control someone cannot use.
    minHeight: 44,
    justifyContent: "center",
    shadowColor: color.deep,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  buttonSecondary: { backgroundColor: "transparent", paddingVertical: 12, shadowOpacity: 0, elevation: 0 },
  buttonInner: { flexDirection: "row", alignItems: "center", gap: 10 },
  callout: { flexDirection: "row", gap: 12, padding: space.md, borderRadius: radius.card, marginVertical: 12, alignItems: "flex-start" },
  calloutBadge: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  calloutTitle: { ...type.body, fontWeight: "700" },
  calloutText: { ...type.small, marginTop: 3 },
  link: { textDecorationLine: "underline" },
  buttonDisabled: { backgroundColor: "#dde4d7", shadowOpacity: 0, elevation: 0 },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  buttonTextSecondary: { color: "#294c3e" },
  // White on the pale disabled fill was unreadable; a disabled label still has to be read.
  buttonTextDisabled: { color: color.inkFaint },
  steps: { flexDirection: "row", paddingVertical: 12 },
  step: { flex: 1 },
  stepHead: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#dfe7d8",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotOn: { backgroundColor: color.deep },
  stepDotDone: { backgroundColor: "#698447" },
  stepDotText: { fontSize: 11, fontWeight: "800", color: color.inkFaint },
  stepDotTextOn: { color: "#ffffff" },
  stepLine: { flex: 1, height: 3, borderRadius: 2, marginHorizontal: 4 },
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
  tabPill: { paddingHorizontal: 18, paddingVertical: 3, borderRadius: radius.pill },
  tabPillOn: { backgroundColor: color.lime },
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
