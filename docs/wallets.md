<!--
wallets.md: cómo dejar Privy y Freighter listos para una firma real en testnet, y qué falta.
Contiene las llaves que hay que crear, dónde van y cómo se comprueba la firma.
No es el guion del teléfono (app/README.md) ni la evidencia (verificacion.md): aquí no se anota resultado.
-->

# Wallets reales: Privy y Freighter

Estado a 2026-09-25. El motor de pago ya **rechaza una firma que no verifica** contra la cuenta
que paga, antes de enviarla a Horizon (`stellar-payment.ts`, razón `wallet_rejected`). Una firma
real que pase por aquí es, por construcción, una firma correcta de esa cuenta sobre esa transacción.

## Qué falta en el código, antes que las llaves

| Wallet | Adaptador | Puente | Pantalla |
|---|---|---|---|
| Privy | `wallet-privy.ts` — completo | `privy-bridge.tsx` — completo | banco `/firma` (D-84); ⏳ no en el recorrido de pago |
| Freighter | `wallet-freighter.ts` — completo | ⏳ **no existe**: no hay paquete WalletConnect instalado | ⏳ no |

Privy firma desde `/firma` en cuanto tenga su dominio y un dev build. Freighter no firma nada hasta que exista su puente.

## Privy

Lo que ya existe: `EXPO_PUBLIC_PRIVY_APP_ID`.

1. **Dominio de la passkey.** `EXPO_PUBLIC_PRIVY_RP` es un dominio HTTPS que sirve
   `/.well-known/apple-app-site-association` y `/.well-known/assetlinks.json`. Es el sitio de `web/`;
   `web/src/association.ts` los genera y rehúsa si falta un valor.
2. **Dos valores que solo tú tienes:**
   - `KNOWNI_APPLE_TEAM_ID` — 10 caracteres, en developer.apple.com → Membership.
   - `KNOWNI_ANDROID_CERT_SHA256` — la huella del certificado que firma el build instalado:
     ```bash
     cd app/android && ./gradlew signingReport
     ```
     Con Play App Signing, la huella es la de Play, no la local.
3. **Panel de Privy:** habilitar login con passkey, agregar el dominio del paso 1 y los
   identificadores de la app (bundle iOS / paquete Android de `app.json`), y habilitar wallets
   Stellar (cadena extendida).
4. **Dev build.** Expo Go no carga `@privy-io/expo/passkey` ni `extended-chains`:
   ```bash
   cd app && npx expo run:android
   ```

## Freighter (WalletConnect)

1. Crear un proyecto en el panel de WalletConnect (Reown) y copiar el Project ID a
   `EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID`.
2. Instalar Freighter en el teléfono, en testnet, con una cuenta fondeada (Friendbot).
3. ⏳ Falta escribir el `WalletConnectBridge` (`pair`, `signStellarTransaction`, `close`) sobre un
   cliente WalletConnect. `wallet-freighter.ts` ya define la interfaz.

## Cómo se comprueba una firma real

1. Abrir `knowni://firma`, entrar con passkey y pulsar *Pagarme 1 XLM*. La cuenta necesita saldo:
   Friendbot sobre la dirección que muestra la pantalla. Si la firma no es de la cuenta o no es sobre esa transacción,
   el pago termina en `wallet_rejected` **sin llegar a Horizon** — eso ya es un resultado a anotar.
2. Si paga, abrir `https://stellar.expert/explorer/testnet/tx/<hash>`: la cuenta origen es la de la
   wallet y el memo es el `paymentRef` de la cotización.
3. Anotar una fila en `docs/verificacion.md`: fecha, wallet, cuenta, hash y enlace, pase o falle.
