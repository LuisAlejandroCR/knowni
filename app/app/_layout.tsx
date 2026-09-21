// _layout.tsx: the router shell. Eight screens, one stack, no network.
// Header hidden because every screen of design/day-08 draws its own top bar.

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { installPlatformCrypto } from "../src/domain/platform.ts";

installPlatformCrypto();

export default function Layout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#fafbf7" } }} />
    </SafeAreaProvider>
  );
}
