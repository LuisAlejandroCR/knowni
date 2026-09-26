// haptics.ts: a success tap, only where the native haptics module is in the build.
// A development build made before expo-haptics was added has no native side, and
// importing it there would crash the screen instead of just staying silent.

import { requireOptionalNativeModule } from "expo-modules-core";

export async function successTap(): Promise<void> {
  if (requireOptionalNativeModule("ExpoHaptics") === null) return;
  const Haptics = await import("expo-haptics");
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
