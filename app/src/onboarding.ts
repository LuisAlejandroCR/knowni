// onboarding.ts: whether this phone has already seen the welcome.
// One flag in AsyncStorage; if storage fails the welcome shows again, which is harmless.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const KEY = "knowni/onboarding-seen/v1";

export async function markOnboardingSeen(): Promise<void> {
  await AsyncStorage.setItem(KEY, "1");
}

// Starting over means starting from the welcome, as a new phone would.
export async function clearOnboardingSeen(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

// undefined while reading, so a screen can wait instead of flashing.
export function useOnboardingSeen(): boolean | undefined {
  const [seen, setSeen] = useState<boolean | undefined>();
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((value) => setSeen(value === "1"))
      .catch(() => setSeen(false));
  }, []);
  return seen;
}
