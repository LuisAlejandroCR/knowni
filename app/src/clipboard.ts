// clipboard.ts: copy text, only where the native clipboard module is in the build.
// Same pattern as haptics.ts: a development build made before expo-clipboard
// was added stays silent instead of crashing the screen.

import { requireOptionalNativeModule } from "expo-modules-core";

export function canCopy(): boolean {
  return requireOptionalNativeModule("ExpoClipboard") !== null;
}

export async function copyText(text: string): Promise<boolean> {
  if (!canCopy()) return false;
  const Clipboard = await import("expo-clipboard");
  await Clipboard.setStringAsync(text);
  return true;
}
