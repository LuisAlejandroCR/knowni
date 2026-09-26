// cavos-bridge.ts: the only file that touches the Cavos native kit.
// Signs a person in by email code and hands the wallet port a plain bridge,
// so the adapter and the payment stay testable under Node.

import { Cavos, NativeCavosAuth, type Identity } from "@cavos/kit/react-native";
import { CAVOS_APP_ID, type CavosBridge } from "./domain/wallet-cavos.ts";

// Must match the dashboard's Callback URLs exactly.
export const CAVOS_REDIRECT = "knowni://cavos-auth";

// The HKDF salt of the Stellar key: changing it changes every address.
const APP_SALT = "knowni";

export const createCavosAuth = (): NativeCavosAuth =>
  new NativeCavosAuth({ appId: CAVOS_APP_ID, redirectUri: CAVOS_REDIRECT });

export async function connectCavos(identity: Identity, auth: NativeCavosAuth): Promise<CavosBridge> {
  const wallet = await Cavos.connect({
    chain: "stellar",
    network: "testnet",
    appSalt: APP_SALT,
    appId: CAVOS_APP_ID,
    identity,
  });
  if (wallet.chain !== "stellar") throw new Error(`Cavos devolvió una wallet ${wallet.chain}, no Stellar`);
  return {
    address: async () => wallet.address,
    signXdr: (unsignedXdr) => wallet.signXdr(unsignedXdr),
    logout: () => auth.clearStoredIdentity(),
  };
}
