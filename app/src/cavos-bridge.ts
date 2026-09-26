// cavos-bridge.ts: the only file that touches the Cavos native kit.
// Signs a person in by email code and hands the wallet port a plain bridge,
// so the adapter and the payment stay testable under Node.

import { Cavos, NativeCavosAuth, type Identity } from "@cavos/kit/react-native";
import { CAVOS_APP_ID, tokenFromAuthData, type CavosBridge } from "./domain/wallet-cavos.ts";

// Must match the dashboard's Callback URLs exactly.
export const CAVOS_REDIRECT = "knowni://cavos-auth";

// The HKDF salt of the Stellar key: changing it changes every address.
const APP_SALT = "knowni";

// NativeCavosAuth parses the login token and drops it, but the wallet registry
// needs it ("registry lookup skipped: no login token"). The token is captured
// on its way through, the one place the kit sees it.
const loginTokens = new WeakMap<NativeCavosAuth, string>();

export function createCavosAuth(): NativeCavosAuth {
  const auth = new NativeCavosAuth({ appId: CAVOS_APP_ID, redirectUri: CAVOS_REDIRECT });
  const internals = auth as unknown as {
    identityFromAuthData: (data: string, provider: string, email?: string) => Promise<Identity>;
  };
  const original = internals.identityFromAuthData.bind(auth);
  internals.identityFromAuthData = (data, provider, email) => {
    const token = tokenFromAuthData(data);
    if (token !== undefined) loginTokens.set(auth, token);
    return original(data, provider, email);
  };
  return auth;
}

export async function connectCavos(identity: Identity, auth: NativeCavosAuth): Promise<CavosBridge> {
  const wallet = await Cavos.connect({
    chain: "stellar",
    network: "testnet",
    appSalt: APP_SALT,
    appId: CAVOS_APP_ID,
    identity,
    auth: { getAuthToken: () => loginTokens.get(auth) ?? null } as never,
  });
  if (wallet.chain !== "stellar") throw new Error(`Cavos devolvió una wallet ${wallet.chain}, no Stellar`);
  return {
    address: async () => wallet.address,
    signXdr: (unsignedXdr) => wallet.signXdr(unsignedXdr),
    logout: () => auth.clearStoredIdentity(),
  };
}
