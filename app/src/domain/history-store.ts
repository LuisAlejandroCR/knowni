// history-store.ts: the request history, persisted on this phone.
// One key, JSON, read back through parseHistory so storage cannot inject shape.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseHistory, type HistoryEntry } from "./history.ts";

const KEY = "knowni/history/v1";

export async function loadHistory(): Promise<readonly HistoryEntry[]> {
  return parseHistory(await AsyncStorage.getItem(KEY));
}

export async function saveHistory(history: readonly HistoryEntry[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(history));
}
