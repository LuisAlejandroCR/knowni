// confetti.tsx: a short burst of falling pieces over the screen, then nothing.
// Plain Animated, no library and no native module, so it runs on any build;
// it ignores touches so the screen under it stays usable while it falls.

import { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { color } from "./theme.ts";

const COLORS = [color.lime, color.deep, color.amberLine, "#9cc26a", color.limeSoft];
const PIECES = 36;

export function Confetti() {
  const progress = useRef(new Animated.Value(0)).current;
  const { width, height } = Dimensions.get("window");
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, index) => ({
        left: Math.random() * width,
        drift: (Math.random() - 0.5) * 120,
        delay: Math.random() * 0.25,
        spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360),
        size: 6 + Math.random() * 6,
        color: COLORS[index % COLORS.length],
      })),
    [width],
  );

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [progress]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, index) => {
        const t = progress.interpolate({ inputRange: [piece.delay, 1], outputRange: [0, 1], extrapolate: "clamp" });
        return (
          <Animated.View
            key={index}
            style={{
              position: "absolute",
              top: -20,
              left: piece.left,
              width: piece.size,
              height: piece.size * 1.6,
              borderRadius: 2,
              backgroundColor: piece.color,
              opacity: t.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
                { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, piece.drift] }) },
                { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${piece.spin}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
