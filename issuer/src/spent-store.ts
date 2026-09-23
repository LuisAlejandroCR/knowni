// spent-store.ts: the redeemed transactions, on disk and append-only.
// One hash per line, so recording a spend is a single append and never a
// read-modify-write two issuances in flight could lose. See docs/memoria.md D-37.

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { SpentPaymentStore } from "./payments.ts";

export function createFileSpentPaymentStore(path: string): SpentPaymentStore {
  return {
    async load() {
      let contents: string;
      try {
        contents = await readFile(path, "utf8");
      } catch (error) {
        // A file that does not exist yet is an empty set, which is what the
        // first ever start-up has. Anything else is not ours to interpret:
        // starting with an empty set would silently reopen every spend.
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
      }
      return contents
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "");
    },
    async append(txHash) {
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, `${txHash}\n`, "utf8");
    },
  };
}
