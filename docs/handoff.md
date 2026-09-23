<!-- docs/handoff.md
     Estado del proyecto al cierre del 2026-09-22 y cómo continuar en una sesión
     nueva: qué corre, qué está decidido, qué bloquea y cuál es el siguiente bloque.
     Se distingue de plan.md, que fija el alcance, y de memoria.md, que guarda el porqué. -->

# Traspaso — 2026-09-22

Para retomar en un chat nuevo. Leer en este orden: `AGENTS.md`, este archivo, `docs/memoria.md`
(decisiones), `docs/verificacion.md` (qué está comprobado y qué no).

## Dónde está el proyecto

| | Estado |
|---|---|
| Pruebas | **327 del dominio** + **32 de la app**, verdes en CI (Node 22 y 24) |
| Ramas | **solo `main`** (`7947d2b`); 38 PRs integrados; sin worktrees, sin PRs abiertos |
| Repositorio | **privado** — las bases del evento exigen público |
| Entrega | faltan los dos videos; la evidencia on-chain ya existe |

## Lo que corre de verdad

1. **Dominio** (`core/`, `attestation/`, `sources/`, `anchoring/`, `retrieval/`): predicados,
   compromisos, Merkle, credencial firmada, presentación atada a la sesión, anti-replay. Sin una
   sola dependencia externa y **sin `node:crypto` ni `Buffer`**, así que corre en el teléfono.
2. **Emisor** (`issuer/`): único proceso con llave de proveedor. Consulta Croma de verdad, cobra
   comprobando el pago contra Horizon, y avisa por WhatsApp sin decir el veredicto. Exige llave de
   contraparte y límite por minuto antes de todo (D-31), cachea la pregunta repetida para no volver
   a gastar cuota (D-35) y guarda los pagos ya canjeados en disco (D-37).
3. **App** (`app/`, Expo SDK 57): ocho pantallas, el dominio corriendo dentro del bundle, wallet del
   pagador con Privy, pago de punta a punta `quote → firma → Horizon → issue` (D-33) y aceptación
   real en la pantalla del verificador, con el conjunto gastado leído del dispositivo (D-36).
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
| D-35 | El caché del emisor liga la idempotencia al sujeto sin convertirlo en identificador; una pregunta repetida no vuelve a gastar cuota |
| D-36 | AsyncStorage guarda el conjunto gastado; sin leerlo del disco el verificador rehúsa, no acepta |
| D-37 | Cobrar exige un conjunto de pagos gastados durable: sin `KNOWNI_SPENT_PAYMENTS_FILE` el emisor no arranca con cobro |

## Lo que bloquea, y de quién depende

| Bloqueo | De quién |
|---|---|
| Repositorio público (lo exigen las bases) | del titular; decidir antes si `CLAUDE.md` sale con él |
| Correr la app en un teléfono físico — criterio **A12** | del titular: `cd app && npm start` |
| `EXPO_PUBLIC_PRIVY_APP_ID`, `WALLETCONNECT_PROJECT_ID`, `KAPSO_*` o `META_*`, `KNOWNI_TREASURY_ACCOUNT` | llaves pendientes; cada una ausente apaga su función |
| `KNOWNI_ISSUER_ACCESS_KEYS` y `EXPO_PUBLIC_ISSUER_ACCESS_KEY` | llave pendiente, pero no opcional: sin ella el emisor no arranca — D-31 |
| `KNOWNI_SPENT_PAYMENTS_FILE` | obligatoria **si se cobra**: sin ella el emisor no arranca con tesorería configurada — D-37 |
| UGPP como fallback documental | requiere operación humana, precio y SLA; sin ellos permanece en `needs_human_review` y fuera del flujo automático — D-29/D-32 |
| Si existe API de IBC con autorización delegada | conversación con Aportes en Línea |

## Coordinación entre agentes

**Ahora mismo no hay nadie más trabajando.** Los tres worktrees se eliminaron el 2026-09-22 con todo
fusionado y limpio; no quedan ramas aparte de `main`. Un chat nuevo arranca sin colisiones.

Durante el 22 trabajaron tres agentes a la vez —esta sesión, Codex en worktrees hermanos
(`knowni-<tema>`) y otra sesión de Claude en el checkout principal—. Lo que dejó el episodio, y que
conviene respetar si se vuelve a paralelizar:

| Regla | Por qué |
|---|---|
| Anotar en esta tabla qué bloque y qué archivos se toman **antes** de tocarlos | Es la única fuente de atribución que existe |
| **`git log` no distingue agentes**: todos los PRs figuran como `LuisAlejandroCR` | Todos empujan con la misma cuenta; auditar por autoría lleva al lugar equivocado |
| No entrar en archivos que otro tenga sin commitear | `issuer/src/service.ts` y `docs/{memoria,handoff}.md` son donde más se choca |
| Al abrir decisión nueva, mirar primero cuál es el siguiente `D-NN` libre | Dos agentes eligieron D-34 a la vez y hubo que renumerar |

**La siguiente decisión libre es D-38.**

## Siguiente bloque — decidido por el titular, listo para ejecutar

**Hecho: la ventana de durabilidad del pago está cerrada — D-38.** `SpentPayments` tiene
`settled?()`, `/issue` lo espera entre `verifyPayment` y `issueAnswers`, y responde
`503 payment_not_durable` sin consultar ninguna fuente si la escritura no aterrizó. La sub-decisión
que quedaba abierta se resolvió por **soltar el reclamo**: una escritura fallida devuelve la
transacción al comprador, porque no hubo emisión. Ejercido en
[`issuer/test/unit/issue-durability.spec.ts`](../issuer/test/unit/issue-durability.spec.ts). 329 pruebas.

**Hecho también: el caché del emisor persiste — D-39.** `IssuanceCacheStore` como puerto, fichero
JSONL append-only detrás de `KNOWNI_ISSUER_CACHE_FILE`, expiradas descartadas al hidratar. Opcional
a propósito: perderlo cuesta una llamada repetida a Croma, no una emisión de más, y un costo no
gatea el arranque. Ejercido en
[`issuer/test/unit/cache-persistence.spec.ts`](../issuer/test/unit/cache-persistence.spec.ts) contra
el disco real. 336 pruebas.

Lo siguiente sale de la lista de abajo; el primero es el ejercicio real del pago móvil, que necesita
llaves.

## Después, en orden

1. ~~**Persistencia del caché del emisor**~~ — D-39. Lo que sigue abierto es **compartirlo entre
   réplicas**: hoy cada proceso tiene su fichero, así que dos réplicas se pierden el trabajo de la
   otra. Requiere un almacén compartido, no un fichero.
2. **Ejercicio real del pago móvil** — *medio hecho, 2026-09-22*. La transacción USDC testnet ya
   corrió: el XDR que `stellar-payment.ts` construye a mano fue aceptado por Horizon y el emisor lo
   verificó de vuelta, con las cuatro negativas comprobadas sobre la misma transacción. No hizo
   falta ninguna llave: tres cuentas con friendbot y un activo `USDC` emitido para la prueba —el de
   Circle no se puede acuñar—. **Lo que sigue faltando es la firma real de Privy**, que necesita un
   app id, y un teléfono de verdad (A12).

   *Hallazgo suelto:* un pago en un activo distinto al cotizado se rechaza con `wrong_destination`.
   Rechaza bien, pero la razón miente sobre por qué. Añadir `wrong_asset` es decisión, no
   corrección: cambia el cuerpo del `402` que ya ve la contraparte.
3. **Acceso delegado a IBC**: conversación comercial con Aportes en Línea. El lector UGPP solo se
   construye si un piloto acepta explícitamente revisión humana, costo y SLA; no bloquea el MVP.
4. **Emisión por fuente con resultados parciales**: una emisión de cuatro fuentes tardó 83 s; hoy es
   todo o nada.
5. **Bloque 5 cerrado.** ~~5a `NullifierLedger`~~ — D-34 y D-36: puerto, ledger hidratado y
   AsyncStorage en el dispositivo. ~~5b pagos gastados~~ — D-37: fichero append-only, ejercido contra
   el disco real; cobrar sin él ya no arranca. Lo único que le falta a 5a es **un teléfono de
   verdad**, que es A12.

## Lo aprendido que cuesta caro volver a aprender

| | |
|---|---|
| **Un bundle que se genera no prueba que la app arranque** | Faltaban dos peer deps nativas de Privy y *todo* pasaba: tipos, pruebas y `expo export`. Solo `npx expo-doctor` lo vio. Córrelo ante cualquier cambio en `app/package.json` |
| **Dormir milisegundos esperando una escritura no esperada es una carrera** | Dos pruebas de disco dormían 20 ms; fallaban ~1 de cada 5 corridas bajo carga y CI las dejó pasar. Se espera la promesa, no un número — #38 |
| **La autoría entre agentes no se puede reconstruir con git** | Todos los PRs figuran como el titular |

## Lo que no se hace, y no es negociable

Sin antecedentes penales, sin Sisbén ni clasificación de pobreza, sin puntaje agregado de confianza,
sin foto de la cédula, sin reusar las credenciales del ciudadano, y sin que la contraparte consulte
una fuente. Un `unavailable` **nunca** se convierte en un `false`.
