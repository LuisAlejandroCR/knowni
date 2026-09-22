<!-- docs/verificacion.md
     Qué está comprobado, contra qué fuente y en qué fecha; qué sigue sin
     comprobar; y la deuda conocida. Se distingue de memoria.md, que guarda
     decisiones y su razón, y de plan.md, que guarda criterios de aceptación. -->

# Verificación

Tres cosas distintas y se marcan como tales: **verificado en fuente primaria** · **repetido por una
fuente secundaria** · **supuesto propio**. Sin verificar → `⏳ pendiente`.

## Verificado en este repositorio

| Qué | Cómo | Fecha |
|---|---|---|
| 116 pruebas pasan | `npm test` con Node 24.15.0 en Windows; rutas de fixtures con `fileURLToPath` | 2026-09-20 |
| Nada en `core/` conoce un tipo de contrato; siete perfiles distintos responden con las mismas credenciales | `core/test/session.test.ts` · `core/test/disclosure.invariant.test.ts` | 2026-09-20 |
| El sobre no filtra ningún valor de los reclamos | `core/test/disclosure.invariant.test.ts` | 2026-09-20 |
| `core/` no importa ningún SDK ni declara dependencias | `core/test/no-vendor-imports.test.ts` | 2026-09-20 |
| La misma verificación ancla en dos cadenas sin cambiar nada por encima del registro | `anchoring/test/registry.test.ts` | 2026-09-20 |
| Node 22 ejecuta TypeScript sin paso de compilación; `enum` no, `const` sí | ejecutado | 2026-09-20 |

## Verificado en otra parte, no aquí

| Qué | Fuente | Fecha original | Estado aquí |
|---|---|---|---|
| Rutas `/co/*`, envoltorio `{data}`, jobs `202`, `502` de Rama Judicial, cabeceras de rate limit | El prototipo notarial anterior, comentarios de `src/infra/croma-client.ts` y `src/blocks/*` | 2026-08-11 | **Repetido, no re-verificado.** `docs.usecroma.com` está bloqueado por el proxy de esta sesión, y el prototipo notarial anterior además está sin terminar |
| URL base `https://api.croma.run` y la convención `/{país}/{fuente}/{recurso}/v1` | El proyecto GovTech anterior (`src/config/env.ts`, `src/modules/*/providers/*.types.ts`) **y** el prototipo notarial anterior, independientemente | 2026-08 | **Dos fuentes que coinciden**, con países distintos (`/mx/*` y `/co/*`). Es lo más cerca de verificado que se puede estar sin llamar |
| El proyecto GovTech anterior fue la hackathon de Croma (IA Hackathon GovTech, 12–16 ago 2026); el prototipo notarial anterior es un producto sin terminar | El usuario, y el pie del `README.md` del proyecto GovTech anterior | 2026-09-20 | **Verificado.** Corrige la atribución de la sesión anterior |
| Croma cubre Colombia, Perú y México; 119 endpoints sobre 43 fuentes oficiales; servidor MCP; Banco Finandina e Incomercio en producción | Búsqueda web sobre `usecroma.com` | 2026-09-20 | **Fuente secundaria.** Confirmar contra la documentación |
| El recorrido se completa sin red y con el anclaje caído, y ningún log ni resultado contiene documento, nombre, salario, cuenta ni placa | `journey/test/offline.test.ts` y `journey/test/redaction.test.ts`, con `fetch` desactivado y consola capturada | 2026-09-20 | **Verificado en la suite.** No sustituye un teléfono físico en modo avión: A12 sigue abierto |
| El compromiso `a88721ff2ce8…` quedó anclado como `MEMO_HASH` en la transacción `0dc0fdf46ebf…`, ledger 4783364, comisión 100 stroops | `POST /transactions` a `horizon-testnet.stellar.org` desde este repositorio, releído con `GET /transactions/{hash}` | 2026-09-20 | **Verificado en vivo.** El memo devuelto por Horizon es idéntico al compromiso |
| `@privy-io/expo` 0.74.3 expone passkeys y, en `extended-chains`, `useCreateWallet` y `useSignRawHash` con `chainType: 'stellar'` | tipos del paquete instalado; `tsc --noEmit` compila contra ellos | 2026-09-21 | **Verificado en el SDK.** Sin llamada real: falta `EXPO_PUBLIC_PRIVY_APP_ID` |
| Clerk cobra passkeys en producción y sus componentes nativos no corren en Expo Go; Auth0 cuesta $35/mes por 500 MAU | `clerk.com/pricing`, `clerk.com/docs/expo`, `auth0.com/pricing` | 2026-09-21 | **Verificado en documentación** |
| Cómo se comprueba la autenticidad del Estado Único de Cuenta de UGPP —firma electrónica, QR o código contra la fuente— | `ugpp.gov.co/estado-unico-de-cuentas/` y `vue.gov.co` (Ventanilla Única), fuente primaria: ninguna de las dos documenta código de verificación, QR ni firma electrónica; el documento solo se describe como enviado por correo al registrado en Oficina Virtual/RUT. `storm_web_manual.pdf` de UGPP es un sistema distinto —para operadores de información que le reportan a UGPP, no para el ciudadano que recibe el EUC— y tampoco aplica | 2026-09-21 | ⏳ **Sigue bloqueado.** Sin mecanismo público de verificación encontrado tras revisar las dos fuentes primarias disponibles. Ver D-32 |
| Belvo publica Brasil, México y Chile; **Colombia no aparece** en su OpenAPI | `developers.belvo.com/apis/belvoopenapispec` | 2026-09-21 | **Verificado en documentación.** Corrige la ficha de Belvo en `plan.md` |
| SuAporte publica dos Swagger abiertos —`Gestión de Aportantes` y `Generador de Planilla`— del lado del aportante, no del cotizante | `suaporte.com.co/aportantes/v3/api-docs/swagger.json` y `/planillas/v3/api-docs/swagger.json`, descargados | 2026-09-21 | **Verificado en vivo.** No sirve para historial de aportes por titular |
| La documentación de Prometeo está tras login; su cobertura colombiana no está confirmada | `docs.prometeoapi.com`, `prometeoapi.com` | 2026-09-21 | **Por confirmar.** No cuenta como fuente disponible |
| Aportes en Línea tiene histórico PILA y su política contempla entregarlo a terceros para validar experiencia laboral | páginas públicas del proveedor, aportadas por el usuario | 2026-09-21 | **Indicio, no contrato.** Requiere conversación comercial — D-29 |
| Agildata (manual 2019) describía IBC por periodo, promedio de 3 meses y acceso con autorización del titular | manual alojado en Scribd, aportado por el usuario | 2026-09-21 | **Sin vigencia confirmada.** No entra al roadmap |
| Privy soporta Stellar en **nivel 2: firmar**, no enviar; nivel 3 es Ethereum, Solana, Tempo y Tron | `docs.privy.io/wallets/overview/chains` | 2026-09-21 | **Verificado en documentación.** Sin llamada real todavía |
| Freighter tiene apps iOS y Android e integra con móvil por WalletConnect | `freighter.app` y `docs.freighter.app` | 2026-09-21 | **Verificado en documentación** |
| Kapso revende la Cloud API de Meta; ofrece API, CLI, MCP y números multi-tenant | `kapso.com` | 2026-09-21 | **Verificado en documentación** |
| El verificador de pagos acepta la transacción real `0dc0fdf4…` con su memo y la rechaza con una referencia ajena | `verifyPayment` contra `horizon-testnet.stellar.org` | 2026-09-21 | **Verificado en vivo** |
| Quién paga hoy el estudio de arrendamiento en Colombia: se asume que la aseguradora lo traslada al arrendatario | **Supuesto propio**, sin fuente | 2026-09-21 | ⏳ **Pendiente.** Decide si el argumento comercial es sustituir ese cobro o sumarse a él. Ver D-26 |
| El propio EUC de UGPP dice de sí mismo que "no es una certificación válida para trámites de prestaciones económicas" y remite al Ministerio de Salud para eso | `ugpp.gov.co/estado-unico-de-cuentas/`, texto de la página | 2026-09-21 | **Verificado en fuente primaria.** Afecta el alcance del camino documental — ver D-32 |
| El servicio de emisión llama a Croma de verdad: `/issue` con dos fuentes consentidas devolvió un sobre firmado en **83 s**, y con un documento inexistente (`99999999999`) las respuestas son `unavailable`, nunca `false` | `POST http://localhost:8787/issue` contra `api.croma.run`, y la misma consulta directa a Registraduría (`found: false`) | 2026-09-21 | **Verificado en vivo.** Ninguna consulta sobre una persona real |
| La latencia de una emisión de cuatro fuentes supera los 80 s | mismo ensayo | 2026-09-21 | **Medido.** El cliente del teléfono usa 180 s de timeout; una emisión por fuente con resultados parciales sigue pendiente |
| El crédito y el precio de Jev: saldo $5, gasto $0, entrada $0,000000042/token, salida $0, `zdr: all` | `GET https://ai-gateway.vercel.sh/v1/credits` y `/v1/models`, llamados desde este repositorio | 2026-09-20 | **Verificado en vivo.** Medidor en `sources/tools/gateway-credits.ts` |
| El catálogo expone 170 endpoints, 87 de Colombia, con esquema de petición, `served_from` y un límite de 100 solicitudes/24 h por endpoint | `GET https://api.croma.run/catalog`, llamado desde este repositorio | 2026-09-20 | **Verificado en vivo.** Inventario guardado en `sources/test/fixtures/croma/catalog-co.json` |
| ADRES responde en `/co/adres/affiliation-status/v1`; el historial de vehículo en `/co/runt/vehicle-history-by-plate/v1`; RUAF existe en `/co/ruaf/affiliations/v1` | Sondeo con cuerpo vacío contra 16 rutas documentadas | 2026-09-20 | **Verificado en vivo.** Corrige tres afirmaciones de `CROMA.md` |
| El envolvente `{ data }` y el de error `{ error: { type, code, message, param, details.issues[] } }` | `/co/rues/entities-by-name/v1` (200, empresa pública) y `/co/registraduria/vital-status/v1` (400, cuerpo vacío) | 2026-09-20 | **Verificado en vivo.** Fixtures sanitizadas; ninguna llamada sobre una persona |
| Stellar verifica Groth16 sobre BLS12-381 nativamente (CAP-0059, Protocolo 22+); BN254 bloqueado en CAP-0074 | Una guía comunitaria de Stellar | 2026-09 | **Repetido.** Confirmar contra el texto del CAP antes de comprometer la curva |
| ~23,7 s por prueba de *backing* sobre Midnight, en escritorio | El proyecto ZK anterior, `tools/PROOF-LATENCY.md` | 2026-08 | **Medido en otro proyecto.** No comparable con móvil; citado solo como referencia de que esto se mide |

| El catálogo de Colombia de Croma: qué fuentes existen y cuáles no | El propio catálogo de Croma, aportado por el usuario | 2026-09-20 | **Verificado.** PILA y SNR no están; ADRES, RUNT, SIMIT y Sisbén sí |

| PILA: cuatro subsistemas; IBC con piso de 1 SMLMV proporcional; IBC agrega todos los contratos; tres tipos de cotizante independiente (`3`, `59`, `57`); planilla `N` de correcciones; fechas de novedades y horas laboradas **opcionales**; acceso por operador de información | **Fuente primaria**: ABECÉ de PILA, Ministerio de Salud y Protección Social | jun 2018 | **Verificado en fuente primaria**, pero la fuente tiene siete años: umbrales y decretos citados pueden haber cambiado |

## Pendiente de verificar

1. **¿Existe una vía por la que el titular consulte su historial de aportes PILA?** El ABECÉ de
   MinSalud describe cómo se *paga*, no cómo se *consulta*. Antes se daba por hecho que era un
   acuerdo comercial con un operador; ahora hay que confirmar que el servicio existe. Es la
   pregunta que decide si `solvency` es alcanzable. Ver D-15.
2. ~~**¿Croma expone RUAF?**~~ **Resuelto el 2026-09-20:** sí, `/co/ruaf/affiliations/v1`
   (`document_number` + `issue_date`), en vivo. La afiliación a ARL es mejor fuente de `formality`
   que el régimen de salud y **quita la necesidad de la regla asimétrica de D-12 por esa vía**.
   Queda pendiente qué campos devuelve. Ver D-19.
3. **¿Qué campos devuelve ADRES?** Régimen, estado, tipo de afiliado (cotizante/beneficiario) y EPS
   son supuesto propio. De ello depende que `formality` distinga cotizante de beneficiario, que es
   lo que hace funcionar D-12.
4. **`CROMA_API_KEY`** — sin key no hay ninguna llamada en vivo. Bloquea B2 y el criterio A10.
5. **Ruta y forma de respuesta de ADRES Health Affiliation Status.** Está en el catálogo; su ruta
   no aparece en ningún trabajo anterior, así que no se supone.
6. **Rutas de RUNT y SIMIT.** Verificadas en el prototipo notarial; re-confirmar antes de depender.
7. **Cobertura de PILA por tipo de trabajador**, antes de dejar que `formality` influya en nada.
   Es el requisito de D-11 y no está medido.
8. **Parámetros de Poseidon para BLS12-381.** El único riesgo que puede cambiar la arquitectura.
9. **Tiempo de prueba en un teléfono real.** Ninguna cifra hasta que exista.
10. **Fecha y rúbrica del hackathon.**

## Deuda conocida

| Deuda | Dónde | Bloque |
|---|---|---|
| `retrieval/` está construido sobre la lectura de Chroma. El adaptador, el puerto y el índice sobran; la normalización y la política de resolución se quedan | `retrieval/` | B3 |
| El sobre `Disclosure` todavía tiene cinco campos del perfil de arrendamiento; `capacity` y `assetStanding` existen como reclamo y como predicado, pero no como respuesta entregable | `core/src/disclosure.ts` | día 6–7, con emisión y presentación |
| `ofAge` se deriva de que la cédula de ciudadanía solo se expide a mayores de edad. Es una regla jurídica, no un dato que devuelva la fuente | `sources/src/country/colombia/registraduria.ts` | confirmar con el concepto legal |
| Ningún adaptador se ha ejercido contra una respuesta real sobre una persona: los esquemas vienen del OpenAPI de Croma, no de una llamada | `sources/src/country/colombia/` | requiere un titular que autorice |
| ~~Tests planos sin `unit · fuzz · invariant`~~ **Saldada el 2026-09-20:** 26 archivos movidos a `test/unit` y `test/invariant` con sufijo `.spec.ts`, más tres suites `fuzz` nuevas | todos los workspaces | ✅ |
| ~~Cabeceras de 10–30 líneas con narrativa~~ **Saldada el 2026-09-20:** 65 archivos con cabecera de 2–3 líneas y 146 bloques narrativos retirados. El razonamiento vive en `memoria.md` | todos los `.ts` | ✅ |
| `sources/src/country/colombia/pila.ts` habla de un operador que todavía no existe como integración | `sources/` | B4 |
| El código sigue llamando `standing` a lo que la documentación ya llama `sanctions` (`StandingClaim`, `proveStanding`, el campo del sobre). El renombrado va con B2 | `core/`, `sources/`, `journey/` | B2 |
| `IncomeBasis` no tiene el eje de procedencia `observed \| documentary \| self_declared` del proyecto GovTech anterior | `core/src/claims.ts` | B4b |
| Los dos commits iniciales llevan cuerpo y trailer `Co-Authored-By:`, contra la regla de una línea | historia de git | no se reescribe historia; la regla aplica desde el tercero |

## Auditoría de afirmaciones — 2026-09-20

Cada afirmación del `README.md` contra lo que realmente corre. Comprobado en esta fecha, con el
repositorio en `main` y la suite en 236 pruebas.

| Afirmación | Cómo se comprobó | Veredicto |
|---|---|---|
| "no hay dependencias externas" | `dependencies` de los seis `package.json`: solo enlaces `@knowni/*` entre workspaces | ✅ exacta |
| "236 pruebas" | `npm test` desde un clon limpio, y CI en verde en Node 22 y 24 | ✅ exacta |
| "el expediente cabe en diez campos" | `Disclosure` tiene diez campos de primer nivel; `anchor` es opcional y añadiría un onceavo | ⚠️ exacta con matiz: diez **sin** anclaje, once con él |
| "ancló de verdad" en Stellar testnet | `GET /transactions/0dc0fdf4…` en Horizon: `successful: true`, ledger 4783364, memo igual al compromiso | ✅ exacta |
| "21 pruebas" del cliente de Croma | 17 en `croma.test.ts` + 4 en `croma-contract.test.ts` | ✅ exacta |
| "llamada en vivo a Croma, acotada" | Catálogo, sondeo de 16 rutas con cuerpo vacío y un `200` sobre una empresa pública | ✅ exacta |
| "ningún log lleva documento, nombre, salario ni cuenta" | `journey/test/redaction.test.ts` captura telemetría, sumidero y los cinco métodos de consola | ✅ exacta, con una excepción declarada: el `logError` inyectado sí recibe el error crudo |
| "circuitos escritos, sin compilar" | No existe `circuits/build/`; nada en el repositorio los ejecuta | ✅ exacta |
| "contrato Soroban escrito, sin desplegar" | `contracts/knowni-verifier` sin artefactos ni dirección | ✅ exacta |
| "app iOS / Android no escrita" | No existe `app/`. Pero desde el día 8 sí hay diseño aprobado en `design/day-08/` | ⚠️ **corregida en el README**: se añade el diseño |
| Enlaces de archivo del README | 100 % resuelven a un archivo existente | ✅ exacta |
| "ninguna llamada sobre una persona real" | Ningún fixture ni bitácora contiene una consulta con documento real | ✅ exacta |

**Lo que la auditoría no puede cerrar:** A12 —ejecución en un teléfono físico— y la verificación de
una prueba ZK. Siguen abiertos y el README lo dice.

## Afirmaciones que este repositorio **no** hace

- Ningún tiempo de prueba, conteo de restricciones ni fee medido.
- Ninguna prueba verificada on-chain.
- Ninguna integración real con Croma, Registraduría, PILA o DataCrédito.
- Investigación documental 2026-09-20: Croma, Truora, Incode, Belvo, operadores PILA, RUAF,
  ADRES/BDUA, UGPP y Finanzas Abiertas se clasificaron en `plan.md`. Esto no sustituye una llamada
  real, un contrato comercial ni la comprobación de cobertura por endpoint.
- Ninguna ejecución en un dispositivo físico.
- Ninguna afirmación de cumplimiento normativo. `COLOMBIA.md` describe el marco; no es asesoría
  legal ni un concepto.
