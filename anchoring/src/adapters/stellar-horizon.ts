// stellar-horizon.ts: a real StellarMemoSubmitter against Horizon. Loads the account's
// sequence, builds and signs a payment to self carrying the commitment as MEMO_HASH, and
// submits it.

import type { StellarMemoSubmitter } from "./stellar.ts";
import {
  encodeEnvelope,
  encodeTransaction,
  keypairFromSeed,
  transactionHash,
} from "./stellar-xdr.ts";
import { createHash } from "node:crypto";

export const TESTNET_HORIZON = "https://horizon-testnet.stellar.org";
export const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

// 100 stroops is the network's base fee. The anchor is one operation, and
// paying more would not make a durability feature arrive sooner.
const BASE_FEE_STROOPS = 100;
// One stroop to self: the payment exists to carry the memo, not to move
// value, and the smallest possible amount says so.
const AMOUNT_STROOPS = 1n;

export interface HorizonOptions {
  readonly horizonUrl?: string;
  readonly networkPassphrase?: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

// Horizon writes JSON. When something in front of it does not, that is a
// failed call and not a crash in the caller.
async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await response.json();
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function isSequence(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

export function createHorizonMemoSubmitter(seed: Uint8Array, options: HorizonOptions = {}): StellarMemoSubmitter {
  const horizonUrl = (options.horizonUrl ?? TESTNET_HORIZON).replace(/\/+$/, "");
  const passphrase = options.networkPassphrase ?? TESTNET_PASSPHRASE;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const keypair = keypairFromSeed(seed);

  const call = async (path: string, init?: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(`${horizonUrl}${path}`, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    async sendMemoHash(hash32: Uint8Array): Promise<{ readonly hash: string }> {
      const accountResponse = await call(`/accounts/${keypair.accountId}`);
      if (!accountResponse.ok) {
        // An unfunded account is the common case on testnet and worth
        // naming: Horizon answers 404 until friendbot has created it.
        throw new Error(`horizon account lookup failed with ${accountResponse.status}`);
      }
      const account = (await readJson(accountResponse)) as { sequence?: unknown };
      // A sequence is a non-negative integer written as a string. `BigInt` on
      // anything else throws a message about JavaScript instead of about
      // Horizon, and a sequence read wrong builds a transaction nobody wanted.
      if (!isSequence(account.sequence)) throw new Error("horizon returned no usable sequence");

      const transaction = encodeTransaction({
        source: keypair.publicKey,
        destination: keypair.publicKey,
        sequence: BigInt(account.sequence) + 1n,
        feeStroops: BASE_FEE_STROOPS,
        amountStroops: AMOUNT_STROOPS,
        memoHash32: hash32,
      });

      const signature = keypair.sign(Buffer.from(transactionHash(passphrase, transaction), "hex"));
      const envelope = encodeEnvelope(transaction, keypair.publicKey, signature);

      const submitted = await call("/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ tx: envelope }).toString(),
      });
      // Read before the status is judged, and a body that is not JSON is an
      // empty one: a proxy answering HTML in front of Horizon used to surface
      // as a parse error instead of the status Horizon never sent.
      const result = (await readJson(submitted)) as { hash?: unknown; extras?: { result_codes?: unknown } };
      if (!submitted.ok || typeof result.hash !== "string") {
        // Horizon's result codes say why — they are operational detail, not
        // anything about a subject, so they are safe to raise here.
        throw new Error(
          `horizon rejected the transaction: ${submitted.status} ${JSON.stringify(result.extras?.result_codes ?? {})}`,
        );
      }
      return { hash: result.hash };
    },
  };
}

export function accountIdOf(seed: Uint8Array): string {
  return keypairFromSeed(seed).accountId;
}

// Locally computed transaction hash. Matching it against the one Horizon
// returns is what proves the envelope submitted is the envelope built.
export function expectedHash(
  seed: Uint8Array,
  sequence: bigint,
  memoHash32: Uint8Array,
  passphrase = TESTNET_PASSPHRASE,
): string {
  const keypair = keypairFromSeed(seed);
  return transactionHash(
    passphrase,
    encodeTransaction({
      source: keypair.publicKey,
      destination: keypair.publicKey,
      sequence,
      feeStroops: BASE_FEE_STROOPS,
      amountStroops: AMOUNT_STROOPS,
      memoHash32,
    }),
  );
}

// Friendbot funds a testnet account. Testnet XLM has no value; this is the
// documented way to create one, and it exists nowhere but testnet.
export async function fundOnTestnet(accountId: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const response = await fetchImpl(`https://friendbot.stellar.org?addr=${encodeURIComponent(accountId)}`);
  return response.ok;
}

// A deterministic seed for a demo account, derived from a passphrase so the
// same demo can be reproduced. Never for anything holding real value.
export function demoSeedFrom(passphrase: string): Uint8Array {
  return Uint8Array.from(createHash("sha256").update(passphrase, "utf8").digest());
}
