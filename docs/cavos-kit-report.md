<!-- docs/cavos-kit-report.md
     Borrador de reporte para el equipo de Cavos: tres defectos de @cavos/kit 0.2.5 en un dev build
     de React Native / Expo sobre Stellar testnet, más un conflicto de dependencias que no es del kit.
     Solo documentación: no se ha enviado, publicado ni abierto como issue sin aprobación del usuario. -->

# `@cavos/kit` 0.2.5 on React Native: Stellar wallet cannot sign after a restart

**Status:** draft, not sent. **Date:** 2026-09-26. **Reporter:** Knowni (`LuisAlejandroCR/knowni`).

## Summary

On a React Native / Expo development build, the Stellar path of `Cavos.connect` cannot produce a
wallet that signs across app restarts without three app-side workarounds:

| # | Finding | Effect on RN | Kit change suggested |
|---|---|---|---|
| 1 | Stellar connect always creates its control key with WebCrypto | `connect` throws `WebCrypto is unavailable` | Yes |
| 2 | `NativeCavosAuth` parses the login token and drops it | registry lookup throws `no login token` | Yes |
| 3 | The Stellar control key is persisted only to IndexedDB | a returning user gets `needs-device-approval` and `signXdr` throws | Yes |
| 4 | `npm install` needs `--legacy-peer-deps` | install fails without the flag | **No** — reproduced without the kit |

With the three workarounds below, the same account signed a payment after a full app restart:
testnet tx [`1c07f12e…6227127`](https://horizon-testnet.stellar.org/transactions/1c07f12ec292d07fb809f768a0fb1653fe215bee3444a06b5de2ed1de6227127)
(ledger 4875857, 2026-09-26T06:07:52Z, `successful: true`, one native `payment` of 1.0000000 XLM
from `GDCI23MF…VWWT` to itself).

## Environment

| Item | Version |
|---|---|
| `@cavos/kit` | 0.2.5 (npm integrity `sha512-xccaFaOnGFOKA3M1VXNbseku51NRMY//YtR9wYqttKUyXO+vJdpTBZFEs47S5OzP5IJ3VaKXDzwnRviX6CFfyw==`, matches our lockfile) |
| Expo SDK | 57 (`expo` ^57.0.24, `expo-modules-core` 57.0.19) |
| React Native / React | 0.86.3 / 19.2.3 |
| Build | EAS `development` profile with `expo-dev-client`, JS served by Metro |
| Device | physical iPhone — **iOS version: _to fill in before sending_** |
| Network | Stellar testnet, email-code login (`sendOtp` / `verifyOtp`), `chain: "stellar"` |

Connect call used in every finding:

```ts
const auth = new NativeCavosAuth({ appId, redirectUri: "knowni://cavos-auth" });
await auth.sendOtp(email);
const identity = await auth.verifyOtp(email, code);
const wallet = await Cavos.connect({ chain: "stellar", network: "testnet", appSalt: "knowni", appId, identity });
```

All line numbers below refer to `node_modules/@cavos/kit/dist/react-native/index.js` in 0.2.5.

---

## 1. Stellar connect requires `crypto.subtle`, which React Native does not have

**Symptom.** `Cavos.connect` rejects on the iPhone with:

```
Cavos: WebCrypto is unavailable. Control keys require a secure context — use HTTPS, or http://localhost.
```

**Root cause.** Without `vault`, `recovery`, `socialRecovery` or `passkey`, `CavosStellar.connect`
always builds a candidate key with `WebCryptoControlKey.create()` (L3105). `create` calls
`assertSubtle()` (L1007–1013), which throws when `crypto.subtle` is undefined — always the case on
Hermes. The kit ships `NativeControlSigner` (L5870, iOS native module), but nothing in
`CavosStellar.connect` or `resolveNativeStellar` (L2943–2954) uses it: every Stellar path imports
through `WebCryptoControlKey`. This contradicts the README ("React Native … keys stay in the
platform's secure storage").

**Minimal repro.** The connect call above in any Expo dev build, no polyfill installed.

**Workaround and cost.** Knowni installs a JS `crypto.subtle` covering exactly the four Ed25519 calls
the kit makes — `generateKey`, `exportKey("raw")`, `importKey("pkcs8")`, `sign` — with
`@noble/curves` (`app/src/domain/ed25519-subtle.ts`, installed by `app/src/crypto-setup.ts`).
Cost: the control seed is a plain `Uint8Array` in JS memory, not a non-extractable key, which
defeats the kit's own `extractable: false` guarantee. The alternative, `react-native-quick-crypto`,
needs a new native build.

**Suggested fix.** On React Native, route Stellar control-key creation, import and signing through
the native module (`NativeControlSigner`, plus an Android implementation), and fail with a
React Native–specific message instead of one that talks about HTTPS and `localhost`.

---

## 2. `NativeCavosAuth` drops the login token that the wallet registry needs

**Symptom.** With `appId` set, `Cavos.connect` rejects with:

```
registry lookup skipped: no login token
```

**Root cause.** The registry built in `CavosStellar.connect` reads its token from
`opts.auth?.getAuthToken?.()` (L3057–3063). `NativeCavosAuth` has no `getAuthToken`:
`verifyOtp` (L5303–5311) passes the token to `identityFromAuthData` (L5356–5376), which parses the
JWT for claims and keeps only the `Identity`; the token itself is discarded. So
`HttpWalletRegistry.lookup` throws (L777–779), and `resolveAddress` rethrows it (L2864–2869)
because its fallback cache is IndexedDB (L2822), which React Native does not have. Passing
`auth: nativeAuth` to `connect` does not help, since the method is missing.

**Minimal repro.** The connect call above with a non-empty `appId`, after finding 1 is worked around.

**Workaround and cost.** Knowni wraps the private `identityFromAuthData` to capture the token as it
passes, then passes `auth: { getAuthToken }` to `connect`, cast with `as never`
(`app/src/cavos-bridge.ts`, `createCavosAuth`; token parsing in `app/src/domain/wallet-cavos.ts`,
`tokenFromAuthData`, tested in `app/test/unit/cavos-token.spec.ts`). Cost: it patches a private
method and duplicates the kit's token parsing, so any kit rename breaks it silently.

**Suggested fix.** Keep the token on `NativeCavosAuth` and expose `getAuthToken()` (persisted next to
the identity it already stores under `cavos-kit:identity:<appId>`), so `auth: nativeAuth` works in
`connect`. Also type `connect`'s `auth` so a native auth object is accepted without a cast.

---

## 3. The Stellar control key is persisted only to IndexedDB

**Symptom.** First session: the account is registered and signs. After the app is closed and
reopened with the same identity, `connect` returns the same `G…` address with status
`needs-device-approval`, and `signXdr` throws
`kit/stellar: this device is not an authorized signer of the wallet`. In Knowni this surfaced as
`wallet_rejected` on account `GBTBYA…MUUQEK`, whose key is now unrecoverable.

**Root cause.** Every persistence step for the Stellar control key is IndexedDB-only and a silent
no-op when it is missing:

- `WebCryptoControlKey.create` stores only `if (opts?.keyId && hasIndexedDB())` (L931–933).
- `persist` returns early without IndexedDB (L936–939); `CavosStellar.connect` calls it for a new
  account (L3134) and nothing is written.
- `load` returns `null` without IndexedDB (L971–976), so `unlockViaDevice` (L3656–3659) finds no key
  for the deployed account and `connect` builds the wallet without a control key (L3126–3127).
- `requireControl` then throws on every signature (L3636–3641).

Each session therefore generates a new random key while the registry correctly returns the old
address. No error is raised at persist time, so the loss only shows on the next launch.

**Minimal repro.** After findings 1–2 are worked around: connect, fund with Friendbot, pay, kill the
app, reopen, connect with the same email, call `signXdr` → throws.

**Workaround and cost.** Knowni seals the seed of the first session to the device instead
(`app/src/domain/cavos-control.ts`, `rememberControl` / `recallControl`): ECIES to the P-256 key
from the kit's own `NativeDeviceUnwrapKey.loadOrCreate` (Secure Enclave / Keystore), in the kit's
envelope format (`cavos-stellar-dek-ecies`, AES-256-GCM), stored in `AsyncStorage` as
`{ address, sealed }`. On later sessions it opens the envelope, checks the public key matches the
registered address, and signs the transaction hash itself, bypassing the kit's `signXdr`. Getting
the seed required the polyfill of finding 1 to keep the seeds it generated. Cost: signing happens
in JS, not in the enclave; accounts created before the workaround have no envelope and are lost;
reinstalling the app deletes the P-256 key and the account with it. Six unit tests plus one
polyfill test cover it; the restart case ran on the iPhone (tx above).

**Suggested fix.** Give `WebCryptoControlKey` (or a native equivalent) a pluggable key store and,
on React Native, persist the control key through the native module — the same envelope the kit
already uses for the DEK, opened by `NativeControlSigner` so the seed never reaches JS. Until then,
throw when `keyId` is given and no store is available instead of returning an unpersisted key: the
comment on `create` (L917–919) already says it should.

---

## 4. `npm install` needs `--legacy-peer-deps` — not a kit defect

**Symptom.** Without `legacy-peer-deps=true` in `.npmrc`, `npm install` fails with `ERESOLVE`:
`expo-modules-core@57.0.19` declares `peerOptional react-native-worklets@"^0.7.4 || … || ^0.10.0"`,
while `react-native-reanimated@4.7.0` (pulled by `expo-router`) needs `react-native-worklets@0.13.x`.

**Root cause.** The npm error lists `@cavos/kit` in the chain (it declares
`peerOptional expo-modules-core@">=2"`), which is why we first attributed it to the kit. Re-running
`npm install --package-lock-only --legacy-peer-deps=false` on a copy of our `package.json` with
`@cavos/kit` removed fails with the same `Conflicting peer dependency: react-native-worklets@0.10.4`.
The conflict is between Expo SDK 57 packages.

**Workaround and cost.** `legacy-peer-deps=true` in `app/.npmrc`. Cost: npm stops checking every
peer range, not only this one.

**Suggested fix.** None for the kit. Listed so the Cavos team does not spend time on it, and so our
own notes (D-85) are corrected.

---

## What we would ask Cavos

1. Is the WebCrypto path on React Native intended, or is `NativeControlSigner` meant to be wired into
   `CavosStellar.connect`? Is Android support planned?
2. Can `NativeCavosAuth` expose `getAuthToken()` in the next release?
3. Can the Stellar control key persist on React Native without IndexedDB — or, at minimum, can
   `persist` fail loudly when it cannot store the key?
4. Is there a supported way to recover an account whose control key was lost this way (e.g. delete
   the registry entry for a `user_social_id`)?
