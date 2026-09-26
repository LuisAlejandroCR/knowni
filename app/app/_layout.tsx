// _layout.tsx: the router shell. Eight journey screens and two benches, one stack.
// Header hidden because every screen of design/day-08 draws its own top bar.

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { installPlatformCrypto } from "../src/domain/platform.ts";
import { createDeviceNullifierStore } from "../src/domain/nullifier-store.ts";
import { hydrateLedger } from "../src/domain/verifier.ts";

installPlatformCrypto();

// Reads the spent set off the device before anything can be accepted against
// it — D-36. Until it lands the verifier refuses rather than accepting an
// answer it cannot check for replay.
void hydrateLedger(createDeviceNullifierStore(), (error) => {
  console.warn("nullifier write failed; a spent answer may return after a restart", error);
});

export default function Layout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#fafbf7" },
          // Slide in from the side and swipe back from anywhere on the screen, not just the edge.
          animation: "slide_from_right",
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }} />
    </SafeAreaProvider>
  );
}
