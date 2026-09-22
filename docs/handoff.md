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
| Pruebas | **317 del dominio** + **28 de la app**, verdes en CI (Node 22 y 24) |
| Ramas | solo `main`; 30 PRs integrados |
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
| D-29 | Ruta al IBC: integración delegada con operador; UGPP es fallback manual, no piso automático |
| D-30 | Passkey es la puerta; el magic link solo recupera; sesión de 15 minutos atada al dispositivo |
| D-31 | `/issue` exige llave de contraparte y límite por minuto, antes de pago y antes de Croma; sin llave el emisor no arranca |
| D-32 | El EUC de UGPP no trae verificación pública ni es certificación según su propio emisor; `needs_human_review` es la respuesta correcta, no un pendiente |
| D-33 | La cotización nombra monto, destino y activo; otro activo nunca paga por coincidencia numérica |
| D-34 | El conjunto gastado sobrevive al proceso: `NullifierStore` es puerto y `claim` sigue síncrono a propósito |

## Lo que bloquea, y de quién depende

| Bloqueo | De quién |
|---|---|
| Repositorio público (lo exigen las bases) | del titular; decidir antes si `CLAUDE.md` sale con él |
| Correr la app en un teléfono físico — criterio **A12** | del titular: `cd app && npm start` |
| `EXPO_PUBLIC_PRIVY_APP_ID`, `WALLETCONNECT_PROJECT_ID`, `KAPSO_*` o `META_*`, `KNOWNI_TREASURY_ACCOUNT` | llaves pendientes; cada una ausente apaga su función |
| `KNOWNI_ISSUER_ACCESS_KEYS` y `EXPO_PUBLIC_ISSUER_ACCESS_KEY` | llave pendiente, pero no opcional: sin ella el emisor no arranca — D-31 |
| UGPP como fallback documental | requiere operación humana, precio y SLA; sin ellos permanece en `needs_human_review` y fuera del flujo automático — D-29/D-32 |
| Si existe API de IBC con autorización delegada | conversación con Aportes en Línea |

## Coordinación en curso — 2026-09-22

Tres agentes tocando el repo a la vez. Para no chocar, cada uno anota aquí qué toma antes de tocar
un archivo compartido.

| Agente | Toma | Archivos | Estado |
|---|---|---|---|
| Codex | Bloque 1 — caché idempotente y single-flight en `issuer/` — D-35 | `issuer/src/{cache,main,service}.ts`, tests del emisor, `.env.example`, `issuer/README.md` | **Cerrado.** PR #31 |
| Codex | Bloque 2 / P9 — `quote → firma → Horizon → issue` — D-33 | `app/src/domain/{issuer-client,stellar-payment,wallet-*}.ts`, `issuer/src/{main,payments,service}.ts` | **Cerrado.** PR #29 y #30 mergeados; falta solo el ejercicio real con llaves |
| Esta sesión | Llave y cuota en `/issue` — D-31 · bloqueo de autenticidad UGPP — D-32 | `issuer/src/access.ts`, `docs/{verificacion,memoria}.md` | **Cerrados.** PR #27 y #28 mergeados |
| Esta sesión | Bloque 5a — `NullifierLedger` persistido — D-34 | `attestation/src/acceptance.ts`, `app/src/domain/verifier.ts` | **Cerrado.** PR #32. Falta elegir el almacén del dispositivo |
| Sesión de revisión de main | Cerró D-30 (Privy); sin bloque nuevo tomado | — | Idle, a la espera del titular |

**Mientras Codex tenga `issuer/src/{cache,main,service}.ts` sin commitear, nadie más entra ahí.** El
bloque 5 se parte por eso: **5a** es el `NullifierLedger` (`attestation/` + `app/`, libre) y **5b**
son los pagos gastados (`issuer/src/payments.ts`, espera a que el caché aterrice).

## Siguientes bloques, en orden

1. **Persistencia del caché del emisor**: el caché idempotente y single-flight ya corre — D-35 —,
   pero es volátil y por proceso; entre réplicas no se comparte.
   Después queda persistencia compartida para operar más de una réplica.
2. **Ejercicio real del pago móvil**: faltan las llaves para firmar con Privy/WalletConnect y una
   transacción USDC testnet. El constructor, ambas rutas de firma y el envío ya están probados sin red.
3. **Acceso delegado a IBC**: conversación comercial con Aportes en Línea. El lector UGPP solo se
   construye si un piloto acepta explícitamente revisión humana, costo y SLA; no bloquea el MVP.
4. **Emisión por fuente con resultados parciales**: una emisión de cuatro fuentes tardó 83 s; hoy es
   todo o nada.
5. **Pagos gastados con persistencia** (5b), que hoy viven en memoria en `issuer/src/payments.ts`.
   ~~5a, el `NullifierLedger`~~ **resuelto en el mecanismo — D-34**: el puerto y el ledger hidratado
   están probados; lo que queda es **elegir el almacén del dispositivo**, que es del titular porque
   es una dependencia nativa nueva y no se ejerce sin el criterio A12.

## Lo que no se hace, y no es negociable

Sin antecedentes penales, sin Sisbén ni clasificación de pobreza, sin puntaje agregado de confianza,
sin foto de la cédula, sin reusar las credenciales del ciudadano, y sin que la contraparte consulte
una fuente. Un `unavailable` **nunca** se convierte en un `false`.
