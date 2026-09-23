// nullifier-store.ts: the counterparty's spent set, on the device's disk.
// One key per nullifier, so appending is a single write and never a
// read-modify-write over a list two acceptances could race on.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NullifierEntry, NullifierStore } from "@knowni/attestation";

// Namespaced so a prefix scan finds the spent set and nothing else that the
// app may come to store beside it.
const PREFIX = "knowni/nullifier/v1/";

export function createDeviceNullifierStore(): NullifierStore {
  return {
    async load() {
      const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(PREFIX));
      if (keys.length === 0) return [];
      const pairs = await AsyncStorage.multiGet(keys);
      const entries: NullifierEntry[] = [];
      for (const [key, presentationId] of pairs) {
        // A key whose value went missing says a nullifier was spent but not by
        // which presentation. Dropping it would hand back a spent answer, so
        // it is kept as spent by nobody: any presentation meets a mismatch.
        entries.push({ nullifier: key.slice(PREFIX.length), presentationId: presentationId ?? "" });
      }
      return entries;
    },
    async append(entry) {
      await AsyncStorage.setItem(`${PREFIX}${entry.nullifier}`, entry.presentationId);
    },
  };
}
