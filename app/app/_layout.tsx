// _layout.tsx: the router shell. Eight journey screens and two benches, one stack.
// Header hidden because every screen of design/day-08 draws its own top bar.
// Privy wraps the stack only when its app id is set; without it no hook runs.

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PrivyProvider } from "@privy-io/expo";
import { installPlatformCrypto } from "../src/domain/platform.ts";
import { createDeviceNullifierStore } from "../src/domain/nullifier-store.ts";
import { hydrateLedger } from "../src/domain/verifier.ts";
import { PRIVY_APP_ID, privyConfigured } from "../src/domain/wallet-privy.ts";

installPlatformCrypto();

// Reads the spent set off the device before anything can be accepted against
// it — D-36. Until it lands the verifier refuses rather than accepting an
// answer it cannot check for replay.
void hydrateLedger(createDeviceNullifierStore(), (error) => {
  console.warn("nullifier write failed; a spent answer may return after a restart", error);
});

export default function Layout() {
  const shell = (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#fafbf7" } }} />
    </SafeAreaProvider>
  );
  if (!privyConfigured()) return shell;
  const clientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID;
  return (
    <PrivyProvider appId={PRIVY_APP_ID} {...(clientId ? { clientId } : {})}>
      {shell}
    </PrivyProvider>
  );
}
