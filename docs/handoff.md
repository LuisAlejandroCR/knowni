<!-- docs/handoff.md
     Estado del proyecto al cierre del 2026-09-21 y cómo continuar en una sesión
     nueva: qué corre, qué está decidido, qué bloquea y cuál es el siguiente bloque.
     Se distingue de plan.md, que fija el alcance, y de memoria.md, que guarda el porqué. -->

# Traspaso — 2026-09-21

Para retomar en un chat nuevo. Leer en este orden: `AGENTS.md`, este archivo, `docs/memoria.md`
(decisiones), `docs/verificacion.md` (qué está comprobado y qué no).

## Dónde está el proyecto

| | Estado |
|---|---|
| Pruebas | **289 del dominio** + **20 de la app**, verdes en CI (Node 22 y 24) |
| Ramas | solo `main`; 25 PRs integrados |
| Repositorio | **privado** — las bases del evento exigen público |
| Entrega | faltan los dos videos; la evidencia on-chain ya existe |

## Lo que corre de verdad

1. **Dominio** (`core/`, `attestation/`, `sources/`, `anchoring/`, `retrieval/`): predicados,
   compromisos, Merkle, credencial firmada, presentación atada a la sesión, anti-replay. Sin una
   sola dependencia externa y **sin `node:crypto` ni `Buffer`**, así que corre en el teléfono.
2. **Emisor** (`issuer/`): único proceso con llave de proveedor. Consulta Croma de verdad, cobra
   comprobando el pago contra Horizon, y avisa por WhatsApp sin decir el veredicto.
3. **App** (`app/`, Expo SDK 57): ocho pantallas, el dominio corriendo dentro del bundle, wallet del
   pagador con Privy y aceptación real en la pantalla del verificador.
4. **Stellar**: transacción real en testnet
   [`0dc0fdf4…f8161`](https://stellar.expert/explorer/testnet/tx/0dc0fdf46ebffc72257b068fe0022a6b732c6f4b9dda5503aaa8b005f18f8161),
   memo idéntico al compromiso. XDR, StrKey y firma ed25519 escritos a mano.

## Las decisiones que gobiernan el resto

| | Decisión |
|---|---|
| D-25 | La llave del proveedor vive en `issuer/`, nunca en el teléfono |
| D-26 | Paga quien pregunta; **pagar no es autorizar** |
| D-27 | Privy y Freighter **firman**, no envían; el saldo se lee de Horizon |
| D-28 | Tres evidencias que no se sustituyen: `contribution_base`, `verified_income`, `cashflow` |
| D-29 | Ruta al IBC: Aportes en Línea → UGPP documental → open finance como credencial aparte |
| D-30 | Passkey es la puerta; el magic link solo recupera; sesión de 15 minutos atada al dispositivo |

## Lo que bloquea, y de quién depende

| Bloqueo | De quién |
|---|---|
| Repositorio público (lo exigen las bases) | del titular; decidir antes si `CLAUDE.md` sale con él |
| Correr la app en un teléfono físico — criterio **A12** | del titular: `cd app && npm start` |
| `EXPO_PUBLIC_PRIVY_APP_ID`, `WALLETCONNECT_PROJECT_ID`, `KAPSO_*` o `META_*`, `KNOWNI_TREASURY_ACCOUNT` | llaves pendientes; cada una ausente apaga su función |
| Cómo se comprueba la autenticidad del Estado Único de Cuenta de UGPP | sin resolver; bloquea el camino documental |
| Si existe API de IBC con autorización delegada | conversación con Aportes en Línea |

## Siguientes bloques, en orden

1. **Llaves, cuota y caché en `issuer/`**: hoy `POST /issue` está abierto y cualquiera con la URL
   gasta la cuota de Croma. Es el hueco más grande que queda.
2. **Pago de punta a punta**: construir la transacción con el `paymentRef` en el memo, firmarla con
   Privy (`signRawHash` sobre el hash de la transacción) y enviarla con el submitter propio.
3. **Lector del Estado Único de Cuenta** y su comprobación de autenticidad.
4. **Emisión por fuente con resultados parciales**: una emisión de cuatro fuentes tardó 83 s; hoy es
   todo o nada.
5. **`NullifierLedger` y pagos gastados con persistencia**, que hoy viven en memoria.

## Lo que no se hace, y no es negociable

Sin antecedentes penales, sin Sisbén ni clasificación de pobreza, sin puntaje agregado de confianza,
sin foto de la cédula, sin reusar las credenciales del ciudadano, y sin que la contraparte consulte
una fuente. Un `unavailable` **nunca** se convierte en un `false`.
