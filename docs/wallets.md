<!--
wallets.md: cómo dejar Cavos y Freighter listos para una firma real en testnet, y qué falta.
Contiene las llaves que hay que crear, dónde van y cómo se comprueba la firma.
No es el guion del teléfono (app/README.md) ni la evidencia (verificacion.md): aquí no se anota resultado.
-->

# Wallets reales: Cavos y Freighter

Estado a 2026-09-25. El motor de pago **rechaza una firma que no verifica** contra la cuenta que
paga, antes de enviarla a Horizon (`stellar-payment.ts`, razón `wallet_rejected`). Una firma real que
pase por aquí es, por construcción, una firma correcta de esa cuenta sobre esa transacción.

Privy salió el 2026-09-25 — D-85.

## Qué hay en el código

| Wallet | Adaptador | Puente | Pantalla |
|---|---|---|---|
| Cavos | `wallet-cavos.ts` — completo | `src/cavos-bridge.ts` — código por correo + `Cavos.connect` | banco `/firma` (D-85); ⏳ no en el recorrido de pago |
| Freighter | `wallet-freighter.ts` — completo | ⏳ **no existe**: no hay paquete WalletConnect instalado | ⏳ no |

Las dos firman el **sobre** sin enviarlo (`signingMethod: "envelope"`), así que comparten la misma
comprobación en `payQuote`.

## Cavos

1. **App en el panel de Cavos:** `EXPO_PUBLIC_CAVOS_APP_ID` (✅ existe). En *Callback URLs*,
   exactamente `knowni://cavos-auth`; en *Allowed web origins / passkey RP*,
   `https://knowni.vercel.app`.
2. **Variable en EAS:** `EXPO_PUBLIC_CAVOS_APP_ID` en el entorno del perfil que se construye.
3. **Dominio:** `knowni.vercel.app` ya sirve `assetlinks.json` y `apple-app-site-association`
   (`web/`). El plugin de `@cavos/kit` en `app/app.json` lo declara como `rpId`. Solo hace falta
   para passkeys; entrar por código no lo usa.
4. **Dev build.** Expo Go no carga el módulo nativo de Cavos. iOS 16+ o Android 9+.

## Freighter (WalletConnect)

1. Crear un proyecto en el panel de WalletConnect (Reown) y copiar el Project ID a
   `EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID`.
2. Instalar Freighter en el teléfono, en testnet, con una cuenta fondeada (Friendbot).
3. ⏳ Falta escribir el `WalletConnectBridge` (`pair`, `signStellarTransaction`, `close`) sobre un
   cliente WalletConnect. `wallet-freighter.ts` ya define la interfaz.

## Cómo se comprueba una firma real

1. Abrir `knowni://firma`, pedir el código, entrar, pulsar *Fondear con Friendbot* y luego
   *Pagarme 1 XLM*. Si la firma no es de la cuenta o no es sobre esa transacción, el pago termina en
   `wallet_rejected` **sin llegar a Horizon** — eso ya es un resultado a anotar.
2. Si paga, abrir `https://stellar.expert/explorer/testnet/tx/<hash>`: la cuenta origen es la de la
   wallet y el memo es el `paymentRef` de la cotización.
3. Anotar una fila en `docs/verificacion.md`: fecha, wallet, teléfono, cuenta, hash y enlace, pase o
   falle.
