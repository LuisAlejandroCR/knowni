// platform.ts: the one file that touches Expo's native modules.
// Kept apart from crypto.ts so the crypto can be tested under Node, where
// expo-modules-core cannot even be parsed.

import * as Crypto from "expo-crypto";
import { setRandomSource } from "@knowni/core";

// Called once at start-up. Without it the domain refuses to mint a salt rather
// than falling back to something weaker, which is the behaviour we want.
export function installPlatformCrypto(): void {
  setRandomSource((byteLength) => Crypto.getRandomBytes(byteLength));
}
