// wallet-port.ts: who signs the payer's transaction, behind one interface.
// Privy, Freighter over WalletConnect or a key on the device — none of them
// submits to Stellar, so the sending and the balance are shared code.

export interface PayerWalletPort {
  readonly id: "privy" | "freighter" | "device";
  readonly label: string;
  readonly signingMethod: "raw_hash" | "envelope" | "unsupported";
  // Present once connected. A wallet with no account id is a wallet that has
  // not been connected yet, not an empty one.
  accountId(): Promise<string | undefined>;
  connect(): Promise<string | undefined>;
  // The payload follows signingMethod: a hex transaction hash for Privy or the
  // device keypair, or an unsigned base64 envelope for Freighter. The caller
  // validates the result.
  signTransaction(unsignedXdr: string): Promise<string | undefined>;
  disconnect(): Promise<void>;
}

export const HORIZON_URL = process.env.EXPO_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";

export interface Balance {
  readonly asset: string;
  readonly amount: string;
}

// A balance is public on Stellar, so it is read from Horizon by account id and
// not from a wallet SDK. Every wallet shows the same number through the same
// code, and an unfunded account reads as empty rather than as an error.
export async function balancesOf(accountId: string, fetchImpl: typeof fetch = fetch): Promise<readonly Balance[]> {
  try {
    const response = await fetchImpl(`${HORIZON_URL}/accounts/${accountId}`);
    if (response.status === 404) return [];
    if (!response.ok) return [];
    const body = (await response.json()) as {
      balances?: { asset_type?: string; asset_code?: string; balance?: string }[];
    };
    return (body.balances ?? []).map((balance) => ({
      asset: balance.asset_type === "native" ? "XLM" : (balance.asset_code ?? "?"),
      amount: balance.balance ?? "0",
    }));
  } catch {
    return [];
  }
}

// The adapter that needs no account anywhere: the app's own key, which is what
// the demo runs on until a Privy app id exists.
export function createDeviceWallet(accountIdValue: string): PayerWalletPort {
  let connected: string | undefined;
  return {
    id: "device",
    label: "Llave de este dispositivo",
    signingMethod: "unsupported",
    accountId: async () => connected,
    connect: async () => {
      connected = accountIdValue;
      return connected;
    },
    signTransaction: async () => undefined,
    disconnect: async () => {
      connected = undefined;
    },
  };
}
