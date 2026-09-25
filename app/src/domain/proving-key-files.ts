// proving-key-files.ts: the KeyFiles port on a real device, over expo-file-system.
// The key lives in the app's document directory, which the OS keeps private
// to the app and does not clear under storage pressure the way caches are.

import { File, Paths } from "expo-file-system";
import type { KeyFiles } from "./proving-key.ts";

const NAME = "eligibility.zkey";

export function deviceKeyFiles(): KeyFiles {
  const file = new File(Paths.document, NAME);
  return {
    // The Rust side opens a plain path, not a file:// URI.
    path: decodeURIComponent(file.uri.replace(/^file:\/\//, "")),
    exists: () => file.exists,
    async download(url) {
      await File.downloadFileAsync(url, file, { idempotent: true });
    },
    remove: () => {
      if (file.exists) file.delete();
    },
  };
}
