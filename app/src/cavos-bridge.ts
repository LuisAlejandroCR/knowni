// cavos-bridge.ts: the only file that touches the Cavos native kit.
// Signs a person in by email code and returns a wallet port whose control seed
// is sealed to this device, so the same account signs after a restart (D-88).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Cavos, NativeCavosAuth, NativeDeviceUnwrapKey, type Identity } from "@cavos/kit/react-native";
import { recallControl, rememberControl, type ControlResult } from "./domain/cavos-control.ts";
import { drainGeneratedSeeds } from "./domain/ed25519-subtle.ts";
import { CAVOS_APP_ID, tokenFromAuthData } from "./domain/wallet-cavos.ts";

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

const sealedStore = {
  get: (key: string) => AsyncStorage.getItem(key),
  set: (key: string, value: string) => AsyncStorage.setItem(key, value),
};

// The kit keeps its control key only in IndexedDB, absent on React Native: a
// new session gets the registered account and no key. The seed it generated
// the first time is sealed here, and opened on every later session.
export async function connectCavos(identity: Identity, auth: NativeCavosAuth): Promise<ControlResult> {
  const wallet = await Cavos.connect({
    chain: "stellar",
    network: "testnet",
    appSalt: APP_SALT,
    appId: CAVOS_APP_ID,
    identity,
    auth: { getAuthToken: () => loginTokens.get(auth) ?? null } as never,
  });
  if (wallet.chain !== "stellar") throw new Error(`Cavos devolvió una wallet ${wallet.chain}, no Stellar`);
  const deps = {
    key: await NativeDeviceUnwrapKey.loadOrCreate({ keyId: `knowni.cavos.control.${identity.userId}` }),
    store: sealedStore,
  };
  const input = { userId: identity.userId, address: wallet.address };
  const fresh = await rememberControl({ ...input, seeds: drainGeneratedSeeds() }, deps);
  return fresh.status === "ready" ? fresh : recallControl(input, deps);
}
