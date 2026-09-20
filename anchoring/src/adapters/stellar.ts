// anchoring/src/adapters/stellar.ts
// Anchors a commitment on Stellar, two ways, behind one port.
//
// Written against a minimal submitter interface rather than against
// @stellar/stellar-sdk. That is not a shortcut around the integration — it
// is what keeps the SDK, its version churn and its raw errors out of every
// other workspace, and what lets these adapters be tested without a network.
// Wiring a real client in means implementing one small interface.
//
// Which of the two to use is a real decision, not a preference:
//
//   memo      a payment to self carrying the commitment in MEMO_HASH. 32
//             bytes exactly, which is the whole commitment and nothing more.
//             Costs ~0.00001 XLM, needs no contract, works on any Stellar
//             network today. It CANNOT refuse a repeated nullifier — there
//             is no state to check against — so replayGuarded is false and
//             the relying party keeps its own spent set.
//   contract  a Soroban invocation that verifies the proof, refuses a spent
//             nullifier and stores the commitment. Replay-guarded, auditable
//             by anyone, and the path the product ships. Costs more and
//             needs the contract deployed. See contracts/knowni-verifier.
//
// The hackathon demo runs `memo` so the whole journey works on testnet with
// nothing deployed; the architecture targets `contract`.

import type {
  AnchorRequest,
  AnchorResult,
  AnchoringPort,
  ChainId,
  Logger,
} from "../types.ts";
import { degraded, nowSeconds } from "../types.ts";

// What a Stellar client must provide for the memo path. `sendMemoHash`
// submits a transaction carrying exactly these 32 bytes as MEMO_HASH.
export interface StellarMemoSubmitter {
  sendMemoHash(hash32: Uint8Array): Promise<{ readonly hash: string }>;
}

// What it must provide for the Soroban path. The contract decides; this
// interface only carries the decision back.
export interface StellarContractSubmitter {
  invokeAnchor(args: {
    readonly commitmentHex: string;
    readonly nullifierHex: string;
  }): Promise<{ readonly hash: string; readonly accepted: boolean; readonly reason?: string }>;
}

export interface StellarMemoOptions {
  // Defaults to "stellar:testnet" rather than "stellar", because an anchor
  // that does not say which network it is on is not evidence of anything.
  readonly chain?: ChainId;
  readonly logError?: Logger;
}

export function createStellarMemoAnchor(
  submitter: StellarMemoSubmitter,
  options: StellarMemoOptions = {},
): AnchoringPort {
  const chain = options.chain ?? "stellar:testnet";
  const logError = options.logError ?? (() => {});

  return {
    chain,
    replayGuarded: false,
    async anchor(request: AnchorRequest): Promise<AnchorResult> {
      let bytes: Uint8Array;
      try {
        bytes = decode32(request.commitment.hex);
      } catch (error) {
        // A commitment that is not 32 bytes is a caller bug, not a provider
        // outage — but it still leaves through the degraded channel, because
        // an adapter that throws would take the whole verification down over
        // a durability feature.
        logError(error);
        return degraded(chain, "invalid_response");
      }

      let response: { readonly hash: string };
      try {
        response = await submitter.sendMemoHash(bytes);
      } catch (error) {
        logError(error);
        return degraded(chain, "provider_unavailable");
      }

      if (!response?.hash) return degraded(chain, "invalid_response");

      return {
        status: "anchored",
        receipt: {
          chain,
          commitment: request.commitment,
          txRef: response.hash,
          anchoredAt: nowSeconds(),
          replayGuarded: false,
        },
      };
    },
  };
}

export interface StellarContractOptions {
  readonly chain?: ChainId;
  readonly logError?: Logger;
}

export function createStellarContractAnchor(
  submitter: StellarContractSubmitter,
  options: StellarContractOptions = {},
): AnchoringPort {
  const chain = options.chain ?? "stellar:testnet";
  const logError = options.logError ?? (() => {});

  return {
    chain,
    replayGuarded: true,
    async anchor(request: AnchorRequest): Promise<AnchorResult> {
      // The contract path exists to refuse replays; calling it without a
      // nullifier asks it to do the one thing it cannot do safely.
      if (request.nullifier === undefined) {
        return degraded(chain, "rejected_by_policy");
      }

      let response: Awaited<ReturnType<StellarContractSubmitter["invokeAnchor"]>>;
      try {
        response = await submitter.invokeAnchor({
          commitmentHex: request.commitment.hex,
          nullifierHex: request.nullifier.hex,
        });
      } catch (error) {
        logError(error);
        return degraded(chain, "provider_unavailable");
      }

      if (!response?.hash) return degraded(chain, "invalid_response");
      if (!response.accepted) {
        // The contract's own reason is mapped onto this port's fixed
        // vocabulary rather than passed through: a contract error string is
        // still an external string.
        return degraded(
          chain,
          response.reason === "nullifier_already_spent"
            ? "nullifier_already_spent"
            : "rejected_by_policy",
        );
      }

      return {
        status: "anchored",
        receipt: {
          chain,
          commitment: request.commitment,
          txRef: response.hash,
          anchoredAt: nowSeconds(),
          replayGuarded: true,
        },
      };
    },
  };
}

// MEMO_HASH is exactly 32 bytes. Anything else would be silently truncated
// or padded by the network layer, producing an anchor that opens to nothing.
function decode32(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw new TypeError(`commitment must be 32 bytes of lowercase hex, got ${hex.length} chars`);
  }
  return Uint8Array.from(Buffer.from(hex, "hex"));
}
