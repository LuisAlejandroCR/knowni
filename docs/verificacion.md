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
| El pitch visual conserva assets propios, una sola historia semántica, video y QR explícitos, cero media externa y una experiencia completa con movimiento reducido | `web/test/unit/pitch-assets.spec.ts`; revisión visual del hero a 1581×889; `npm run verify`: lint, tipos y 474 pruebas en verde | 2026-09-25 |
| El plan tiene un corte auditable de sus criterios globales y bloques activos; separa evidencia local, evidencia real pendiente y bloqueos de hardware | Revisión de `docs/plan.md` contra tests, CI, bitácora de límites reales y PRs abiertos; `npm run verify` y la suite de `app/` en verde antes del corte | 2026-09-24 |
| 116 pruebas pasan | `npm test` con Node 24.15.0 en Windows; rutas de fixtures con `fileURLToPath` | 2026-09-20 |
| Nada en `core/` conoce un tipo de contrato; siete perfiles distintos responden con las mismas credenciales | `core/test/session.test.ts` · `core/test/disclosure.invariant.test.ts` | 2026-09-20 |
| El sobre no filtra ningún valor de los reclamos | `core/test/disclosure.invariant.test.ts` | 2026-09-20 |
| `core/` no importa ningún SDK ni declara dependencias | `core/test/invariant/no-vendor-imports.invariant.spec.ts` | 2026-09-20 |
| La misma verificación ancla en dos cadenas sin cambiar nada por encima del registro | `anchoring/test/unit/registry.spec.ts` | 2026-09-20 |
| Node 22 ejecuta TypeScript sin paso de compilación; `enum` no, `const` sí | ejecutado | 2026-09-20 |
| El servicio HTTP no escribe documento, nombre, placa, teléfono ni la llave de la contraparte en ningún log ni cuerpo de respuesta, ni cuando la fuente devuelve el documento en su error | `issuer/test/unit/issue-redaction.spec.ts`: emisión completa, pago rechazado, llamador rechazado y cuerpo malformado, con la consola interceptada | 2026-09-22 |
| Un retry idéntico reutiliza el sobre firmado sin repetir Croma ni el aviso; sujetos distintos bajo el mismo `paymentRef` no comparten entrada | `issuer/test/unit/cache.spec.ts` e `issue-cache.spec.ts` | 2026-09-22 |
| El camino de pago completo en USDC contra la testnet real: el XDR que construye `app/src/domain/stellar-payment.ts` a mano es aceptado por Horizon, y `verifyPayment` del emisor lo lee de vuelta y lo acepta | Testnet de Stellar. Tres cuentas con friendbot, activo `USDC` emitido para la prueba, pago de 2.5 aceptado en la transacción `fb64700b…`; saldos movidos de 1000.0000000 a 997.5000000 (pagador) y 2.5000000 (tesorería). Las cuatro negativas comprobadas sobre la misma transacción: `already_spent`, `wrong_reference`, `underpaid` y activo distinto. Explorer: <https://stellar.expert/explorer/testnet/tx/fb64700b55ab1094f00fc60c48990c035976c0938036a47f8084990800b836b9> — criterio A10 | 2026-09-22 |

| El contrato Soroban compila y su política se sostiene sola: una raíz que nadie registró, un nulificador ya gastado, un `solvency_tier` por debajo del que pidió la contraparte, cada booleano por separado, y un vector plano que no concuerda con las señales nombradas —todos refusados **antes** del emparejamiento | `cargo test` en `contracts/knowni-verifier`: 9 pruebas. El artefacto `wasm32-unknown-unknown` de release se construye: 22 619 bytes. Ninguna prueba Groth16 real verificada — el contrato no ha visto un emparejamiento que dé verdadero | 2026-09-23 |
| Una prueba Groth16 real sobre BLS12-381 verifica en Node y en el contrato Soroban, y cambiar cualquier señal pública la rompe | `circuits/test/unit/groth16.spec.ts` (4 pruebas) y `contracts/knowni-verifier/src/test_real_proof.rs` (4 pruebas, host BLS12-381 del SDK). Llave de desarrollo; sin despliegue ni prueba generada en el teléfono — D-78 | 2026-09-25 |
| El verificador desplegado en Stellar testnet acepta la prueba real y la red rechaza una señal alterada | Contrato `CAGZRVSLNFIFHZHLVA34422YGAUBRXMP37IDXPWOIKCQQIEQGBAL3O6U`; `anchor` en <https://stellar.expert/explorer/testnet/tx/0db7a4790d02c3277877ef4b9e79b3449004735928cb73b192bc7694003b0191>, ledger 4866679; simulaciones: repetición → `#6`, señal alterada → `#4`. Llave de desarrollo; transacción desde el portátil — D-83 | 2026-09-25 |

| Ningún cuerpo malformado en `/quote` ni en `/issue` alcanza una fuente, y todos reciben un estado que el servicio eligió; un predicado que nadie publicó no se cotiza, se llame `constructor`, `__proto__` o `PERSONHOOD` | `issuer/test/fuzz/service.fuzz.spec.ts` (120 cuerpos generados contra ambas rutas, con un proveedor que lanza si lo alcanzan) y `pricing.fuzz.spec.ts` | 2026-09-23 |
| Un fichero de caché corrupto —líneas que no parsean, y líneas que parsean y no son entradas— nunca impide que el emisor arranque, y la entrada viva que haya dentro sobrevive | `issuer/test/fuzz/cache-store.fuzz.spec.ts`: 24 formas de estar mal y 300 ficheros mezclados al azar. Sin la validación del adaptador, las cinco pruebas fallan | 2026-09-23 |

| Ninguna respuesta de Horizon hace lanzar la comprobación de un pago: toda termina en `paid` o en una de las ocho razones de refusal. Un monto que Horizon no pudo haber escrito no se cuenta como dinero | `issuer/test/fuzz/payments.fuzz.spec.ts`: 23 montos inválidos, 5 formas de `records` que no son lista, 300 respuestas generadas. Sin el arreglo fallan 3 de las 5 pruebas | 2026-09-23 |
| El adaptador de anclaje nunca falla con un mensaje de JavaScript: toda respuesta de Horizon que no sirve produce un error que empieza por `horizon `, y un `502` con cuerpo HTML se reporta como `502` | `anchoring/test/fuzz/stellar-horizon.fuzz.spec.ts`: 14 secuencias inválidas, 7 cuerpos que no son JSON, 200 combinaciones. Sin el arreglo fallan 4 de las 5 pruebas | 2026-09-23 |

| Ninguna carga de Croma hace lanzar a los cuatro adaptadores del perfil de compraventa, ninguna deja rastro de sí misma en el resultado, y una carga ilegible nunca se convierte en una respuesta negativa | `sources/test/fuzz/croma-adapters.fuzz.spec.ts`: 400 cargas generadas por adaptador con un marcador plantado, más 9 formas que no son objeto. **Cero hallazgos** — los adaptadores ya validaban | 2026-09-23 |

| `circuits/eligibility.circom` compila, y el orden de sus señales públicas es el que dice el compilador y no el que decía el contrato | circom 2.2.3 construido desde fuente. 10 932 restricciones no lineales, 12 212 lineales, 8 entradas públicas, 5 salidas, 23 194 cables. La tabla de símbolos pone `listSetRoot` en el índice 12; el contrato lo leía del 11, que es `minMonthsPaid`. Corregido y fijado en `contracts/knowni-verifier/src/test.rs` contra `circuits/eligibility.signals.txt` | 2026-09-23 |
| Compilar con `-p bls12381` **no** prueba que el circuito sea correcto sobre esa curva | Mismo comando con `-p bls12381`: mismas 10 932 restricciones y mismo orden de señales que con `bn128`. Las constantes de Poseidon de circomlib son de BN254 y compilan igual contra otro campo. Sigue pendiente generar las de BLS12-381 | 2026-09-23 |

| El generador de constantes de ronda de Poseidon de este repositorio reproduce las que circomlib publica para BN254, en anchos de estado 2 y 3 | `circuits/test/unit/poseidon-params.spec.ts` contra los valores de `circomlib/circuits/poseidon_constants.circom`, cuyo encabezado nombra el `generate_parameters_grain.sage` de referencia como su origen | 2026-09-24 |
| `Poseidon(1,2)` sobre BN254 vale `0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a` | Producido por el propio gadget: `circom p.circom --wasm` sobre `Poseidon(2)` de circomlib y un testigo para las entradas `1, 2`. No tomado de una tabla | 2026-09-24 |
| La matriz MDS generada aquí reproduce la `POSEIDON_M(3)` publicada por circomlib, entrada por entrada, una vez transpuesta | `circuits/test/unit/poseidon.spec.ts`. Cierra el pendiente de D-52: la matriz **reduce** los valores ≥ p donde las constantes los **rechazan** — ver D-53 | 2026-09-24 |
| La implementación de Poseidon de este repositorio calcula lo mismo que el gadget de circomlib | `poseidon([1n,2n])` sobre BN254 da `0x115cc0f5…4417189a`, el valor del testigo del propio gadget | 2026-09-24 |
| ⏳ **Pendiente:** nada está comprobado sobre la salida de Poseidon en BLS12-381 | Se genera y es determinista y está en el campo. No hay segunda implementación contra la cual compararla ni revisión de seguridad. Y `core/` sigue hasheando con SHA-256 | 2026-09-24 |

| `circuits/merkle.circom` y `core/src/merkle.ts` **no** producen la misma raíz: el circuito hashea el par desnudo, `core/` antepone un dominio | `MerkleLevel(7, 9, izquierda)` compilado con circom 2.2.3 y evaluado sobre un testigo da `0x2f447495cd13dfa223b07ada1d51ac114901e15056a30f8bf28f6fbb4a27376a`, idéntico a `poseidon([7n,9n])` de este repositorio — ver D-54 | 2026-09-24 |
| El coste de reconciliarlos por el lado del circuito | `Poseidon(2)` son 243 restricciones no lineales y `Poseidon(3)` con constante de dominio 264: +21 por hash, +840 sobre las 10 932 del circuito completo (+7,7%). Compilado, no estimado | 2026-09-24 |
| El `MerkleLeaf` y el `MerkleLevel` con dominio del circuito producen lo que este repositorio calcula fuera del circuito | Testigos del gadget compilado: `leaf(7) = 0x09403be3…d16a04b4` y `node(7,9) = 0x03b5f4ce…a9672e7`, reproducidos por `poseidon()` en `circuits/test/unit/merkle-domains.spec.ts` | 2026-09-24 |
| Lo que cuesta la separación de dominios en el circuito completo | 10 932 → 12 258 restricciones no lineales (+12,1%), compilado antes y después. El orden de las señales públicas no cambia | 2026-09-24 |

| Dos reclamos distintos nunca producen la misma lista de elementos de campo | `core/test/invariant/claim-fields.invariant.spec.ts`: 4000 reclamos generados de los seis tipos, con la comprobación de que el propio muestreo no es degenerado | 2026-09-24 |
| Una referencia de 32 bytes que no cabe en el campo se rechaza, no se reduce | `core/test/unit/claim-fields.spec.ts`: `ff…ff` como `subjectRef` y como `listSetRoot` lanzan `NotInFieldError` | 2026-09-24 |

| La sal de campo cae siempre dentro del primo, en BN254 y en BLS12-381, y un valor por encima del primo se rechaza y se vuelve a dibujar | `core/test/unit/field.spec.ts`: 500 extracciones por campo, más una fuente guionizada que devuelve el mayor valor enmascarable posible y obliga al segundo intento | 2026-09-24 |

| El puerto de hash de `core/` reproduce los valores que el circuito compilado calcula para una hoja y para un nodo | `core/test/unit/field-hasher.spec.ts`: `hashFields("merkleLeaf",[7n])` da `0x09403be3…d16a04b4` y `hashFields("merkleNode",[7n,9n])` da `0x03b5f4ce…a9672e7`, los mismos que los testigos del gadget | 2026-09-24 |

| `commitClaim`, `hashLeaf` y el plegado de Merkle hashean con Poseidon, y la suite entera sigue verde | 399 pruebas. Tres productores de valores fuera del campo —`subjectRef` del emisor, raíz de listas y raíz de snapshot— quedaron al descubierto y se corrigieron; los encontró el rechazo de D-56, no una revisión | 2026-09-24 |

| `commitClaim` de `core/` y el compromiso del circuito son el mismo número, para identidad y para ingreso | `circuits/test/unit/claim-commitment.spec.ts` contra testigos de `IdentityCommitment` (`0x19426120…3c8f7f1a`) e `IncomeCommitment` (`0x21800de5…87207526`) compilados con circom 2.2.3 | 2026-09-24 |
| Lo que cuesta atar el reclamo entero en el circuito | 12 258 → 12 567 restricciones no lineales (+2,5%), compilado antes y después. El orden de las señales públicas no cambia | 2026-09-24 |

| La plantilla de Poseidon de este repositorio es Poseidon: sobre BN254 reproduce el gadget de circomlib con el mismo número de restricciones no lineales | Testigo de `PoseidonKnowni2` compilado: `0x115cc0f5…4417189a`, 243 restricciones no lineales, igual que `Poseidon(2)` de circomlib | 2026-09-24 |
| Sobre BLS12-381, `core/` y el circuito calculan el mismo digest | `poseidon([1n,2n])` con el spec de BLS12-381 y un testigo de `PoseidonKnowni2` compilado con `circom -p bls12381` dan ambos `0x28ce1942…7dd2a78a` | 2026-09-24 |
| El circuito completo compila sobre BLS12-381 | 12 567 restricciones no lineales y 24 937 lineales, mismo orden de señales públicas que sobre BN254. Dejar la forma optimizada de circomlib cuesta +29% en total (28 975 → 37 504) | 2026-09-24 |
| La plantilla llana deja de gastar señales en sumar la constante de ronda y en copiar celdas en las rondas parciales | 12 385 no lineales y 12 664 lineales, iguales sobre las dos curvas: 37 504 → 25 049 en total (−33%), por debajo de las 28 975 de la forma optimizada de circomlib. Medido por CI, job `circuits`, commit `e980c8b`. Las 182 no lineales que bajaron son el plegado de constantes de la ronda 0 que la plantilla vieja impedía: 2 por celda constante × 91 celdas, medido con sondas compiladas aparte — D-62 | 2026-09-24 |
| Mezclar Poseidon deja de costar una restricción por celda y por ronda: el estado viaja como expresión lineal y solo se materializa lo que se eleva a la quinta | 12 379 no lineales y 254 lineales, iguales sobre las dos curvas: 25 221 → 12 633 en total (−50%) y 25 281 → 12 693 cables. Compilado antes y después con circom 2.2.3 sobre este repositorio; una instancia de `PoseidonKnowni2` aparte pasa de 241 + 197 a 240 + 3. El mismo testigo de `PoseidonKnowni2` (`0x115cc0f5…`) y el mismo compromiso de ingreso (`033ae98c…`), así que la permutación no se movió — D-74 | 2026-09-24 |
| El circuito y `core/` calculan el mismo Poseidon | Paso de CI en las dos curvas: testigo de `PoseidonKnowni2` contra `poseidon([1,2])` de `core/`. Antes eran dos valores copiados a mano en una prueba | 2026-09-24 |

| Una misma presentación se verifica con el registro web y con el de cadena, y un documento fuera de su raíz de confianza se rehúsa con la razón que esa raíz implica | `attestation/test/contract/registry.contract.spec.ts`, una suite contra los dos adaptadores — criterio A3 | 2026-09-24 |
| `not_found`, `degraded` y `failed` no se confunden, y ninguno llega al sobre firmado que recibe la contraparte | `issuer/test/unit/source-states.spec.ts` y `app/test/unit/source-states.spec.ts` — criterio A7 | 2026-09-24 |
| El circuito y `core/` calculan el mismo compromiso de ingreso, con la procedencia dentro | Testigo de `IncomeCommitment` construido con circom 2.2.3 y snarkjs 0.7.5: `033ae98c…`, reconstruido por CI en cada corrida — B4b | 2026-09-24 |
| Renombrar `standing` a `sanctions` no mueve ningún compromiso | El mismo testigo, idéntico antes y después: la clase del reclamo entra como número, no como cadena — B2 | 2026-09-24 |
| La app empaqueta para iOS y Android, no solo compila | `npm run bundle` en el job `app` de CI, que falla si falta alguno de los dos `.hbc` — criterio A14 | 2026-09-24 |

| El digest de un documento de registro anclado en Stellar testnet, leído de vuelta por el adaptador y aceptado por el registro de cadena; un documento distinto contra el mismo ancla se rehúsa | Transacción `66bf1b7d…` en el ledger 4853052, `MEMO_HASH` = `c902165e11b60886dae5968a0f9f9693deab0d5dc770c5b84ff5eeea0affaeee`, comisión 100 stroops. `createStellarRegistryReader` lo lee de Horizon real, `createChainRegistry` resuelve con `trustedVia: chain_anchor`, y un documento con otro `registryId` responde `digest_mismatch`. El documento se sirvió desde memoria: **no** está publicado por HTTPS. Explorer: <https://stellar.expert/explorer/testnet/tx/66bf1b7dffe75e06517389a851f9ecc526b3847e07a13f009c996d943cb4fc49> — criterio A3 | 2026-09-24 |
## Verificado en otra parte, no aquí

| Qué | Fuente | Fecha original | Estado aquí |
|---|---|---|---|
| Rutas `/co/*`, envoltorio `{data}`, jobs `202`, `502` de Rama Judicial, cabeceras de rate limit | El prototipo notarial anterior, comentarios de `src/infra/croma-client.ts` y `src/blocks/*` | 2026-08-11 | **Repetido, no re-verificado.** `docs.usecroma.com` está bloqueado por el proxy de esta sesión, y el prototipo notarial anterior además está sin terminar |
| URL base `https://api.croma.run` y la convención `/{país}/{fuente}/{recurso}/v1` | El proyecto GovTech anterior (`src/config/env.ts`, `src/modules/*/providers/*.types.ts`) **y** el prototipo notarial anterior, independientemente | 2026-08 | **Dos fuentes que coinciden**, con países distintos (`/mx/*` y `/co/*`). Es lo más cerca de verificado que se puede estar sin llamar |
| El proyecto GovTech anterior fue la hackathon de Croma (IA Hackathon GovTech, 12–16 ago 2026); el prototipo notarial anterior es un producto sin terminar | El usuario, y el pie del `README.md` del proyecto GovTech anterior | 2026-09-20 | **Verificado.** Corrige la atribución de la sesión anterior |
| Croma cubre Colombia, Perú y México; 119 endpoints sobre 43 fuentes oficiales; servidor MCP; Banco Finandina e Incomercio en producción | Búsqueda web sobre `usecroma.com` | 2026-09-20 | **Fuente secundaria.** Confirmar contra la documentación |
| El recorrido se completa sin red y con el anclaje caído, y ningún log ni resultado contiene documento, nombre, salario, cuenta ni placa | `journey/test/offline.test.ts` y `journey/test/redaction.test.ts`, con `fetch` desactivado y consola capturada | 2026-09-20 | **Verificado en la suite.** No sustituye un teléfono físico en modo avión: A12 sigue abierto |
| El compromiso `a88721ff2ce8…` quedó anclado como `MEMO_HASH` en la transacción `0dc0fdf46ebf…`, ledger 4783364, comisión 100 stroops | `POST /transactions` a `horizon-testnet.stellar.org` desde este repositorio, releído con `GET /transactions/{hash}` | 2026-09-20 | **Verificado en vivo.** El memo devuelto por Horizon es idéntico al compromiso |
| `@privy-io/expo` 0.74.3 expone passkeys y, en `extended-chains`, `useCreateWallet` y `useSignRawHash` con `chainType: 'stellar'` | tipos del paquete instalado; `tsc --noEmit` compila contra ellos | 2026-09-21 | **Verificado en el SDK.** Sin llamada real. `EXPO_PUBLIC_PRIVY_APP_ID` ya existe (2026-09-25); faltan `EXPO_PUBLIC_PRIVY_RP` —un dominio HTTPS con los ficheros de asociación— y un dev build, porque Expo Go no carga `@privy-io/expo/passkey` ni `extended-chains` |
| El pitch contado con diagramas no se desborda ni pierde el texto | Medido con Chromium 1194 sobre `web/public/index.html`: **8 anchos × 9 anclas = 72 comprobaciones, todas limpias** (320, 360, 375, 390, 430, 768, 1024 y 1440 px × la raíz y las ocho secciones). `scrollWidth > clientWidth` falso en las 72; controles `< 44px` ninguno; un solo `h1`. Los diagramas son HTML y CSS, no imágenes: el texto reflúe, lo lee un lector de pantalla y aguanta el zoom. El video y el QR del build de prueba son huecos marcados en ámbar, no enlaces muertos ni relleno | 2026-09-25 |
| El pitch para jurado cumple W1–W7 y no se desborda en ningún ancho | Medido con Chromium 1194 sobre `web/public/index.html`: **8 anchos × 7 anclas = 56 comprobaciones, todas limpias** (320, 360, 375, 390, 430, 768, 1024 y 1440 px × la raíz y las seis secciones). `scrollWidth > clientWidth` falso en las 56; lista de controles `< 44px` vacía en las 56; **un solo `h1`** en el documento, que era la salvedad que la versión de cuatro pantallas tenía que declarar y esta ya no. W1: el primer titular no nombra cédula, fuente, ZK ni cadena. W2: el único recorrido narrado es la compraventa vehicular. W6: las dos acciones sin destino se dibujan como pendientes, no como enlaces. W7: cero peticiones a terceros | 2026-09-25 |
| La raíz del dominio no se desborda, no tiene controles por debajo de 44 px y muestra un solo `h1` | Medido con Chromium 1194 sobre `web/public/index.html`, **8 anchos × 4 pasos = 32 comprobaciones, todas limpias**: 320, 360, 375, 390, 430, 768, 1024 y 1440 px, en los cuatro pasos y no solo el primero. `scrollWidth > clientWidth` falso en las 32; lista de controles `< 44px` vacía en las 32; un `h1` visible en las 32. El documento contiene cuatro `h1` —uno por paso, uno visible— y el fragmento crudo de `responsive.md` cuenta los cuatro: se publican los dos números. La corrida anterior falló las 32, y por eso se corrigieron dos cosas: `#paso-1` desaparecía con su propia ancla porque `body:has(.screen:target) #paso-1` pesa (1,2,1) contra (1,1,0), y el enlace del pie medía menos de 44 px | 2026-09-25 |
| Los contrastes de la paleta están calculados, no estimados, y hay tres combinaciones prohibidas | Fórmula de luminancia relativa de WCAG 2.1 sobre los valores de `app/src/theme.ts`; tabla completa en `web/DESIGN.md`. **Hallazgo:** `--ink-faint` (`#68756a`) da 3.96 sobre `--page`, 4.12 sobre `--lime-soft` y 4.43 sobre `--amber` — por debajo de AA en las tres. La versión anterior de esta página lo usaba para el eyebrow y el pie, los dos sobre `--page` | 2026-09-25 |
| Los dos ficheros que un dominio tiene que servir para que una passkey funcione se generan, y lo que puede estar mal se rehúsa con nombre antes de escribirse | `web/test/unit/association.spec.ts`: el fichero de Apple ata team id y bundle y no lleva más que `webcredentials`; el de Android delega `common.get_login_creds` y normaliza la huella; team id ausente y mal formado son refusals distintas; los identificadores salen de `app/app.json` y no de una copia | 2026-09-25 | **Verificado en la suite.** Ningún dominio lo sirve todavía y ninguna passkey se ha ejercido: faltan los dos valores —`KNOWNI_APPLE_TEAM_ID`, `KNOWNI_ANDROID_CERT_SHA256`— y un dev build |
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
| La app construye `PAYMENT + MEMO_HASH`, distingue firma cruda de Privy y sobre de Freighter, y envía el sobre firmado a Horizon | `app/test/unit/stellar-payment.spec.ts` | 2026-09-21 | **Verificado sin red.** Falta firma real con ambas wallets y una transacción USDC testnet |
| El conjunto gastado del verificador sobrevive a un reinicio: una entrada escrita en una corrida anterior se detecta como replay en la siguiente | `app/test/unit/nullifier-hydration.spec.ts` y `attestation/test/unit/nullifier-store.spec.ts`, con almacén falso | 2026-09-22 | **Verificado en la suite.** Nadie ha escrito todavía en el AsyncStorage real: eso espera al criterio A12 |
| El bundle de iOS se genera con AsyncStorage dentro: el prefijo `knowni/nullifier/v1/` aparece en el `.hbc` compilado | `npx expo export --platform ios` desde este repositorio | 2026-09-22 | **Verificado en el bundle.** No es una ejecución: nadie ha escrito todavía en el AsyncStorage de un teléfono — A12 |
| Un pago canjeado sigue canjeado tras reiniciar el emisor, y cobrar sin fichero de gastados no arranca | `issuer/test/unit/spent-payments.spec.ts` escribe y relee un fichero real en un directorio temporal; `src/main.ts` ejecutado en los tres casos (cobro sin fichero → `exit 2`; cobro con fichero → arranca; sin cobro → memoria) | 2026-09-22 | **Verificado en vivo, contra el disco y contra el arranque** |
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
9. ~~**Tiempo de prueba en un teléfono real.**~~ **Medido el 2026-09-25:** 1,3 s en un moto g54 5G con la llave ya cargada, 9,7 s la primera vez con descarga. El banco `/prueba` la
   mide; se anota abajo, en *Corrida en teléfono físico*.
9b. **El documento de registro, servido por HTTPS.** El digest ya se ancla de verdad —ver arriba—, pero el documento todavía se sirve desde memoria: falta publicarlo en una URL para que el camino web de A3 quede ejercido igual que el de cadena.
10. **Fecha y rúbrica del hackathon.**

## Corrida en teléfono físico

El guion está en `app/README.md`, *Corrida en un teléfono físico*. Una fila por paso, pase o falle;
la columna de evidencia lleva la captura, el hash de la transacción o el texto del fallo. Vacía hasta
que alguien corra la app en un teléfono: ninguna fila se llena desde un emulador ni desde CI.

| Paso | Fecha | Teléfono y sistema | Commit | Resultado | Evidencia |
|---|---|---|---|---|---|
| 1 · Groth16 en `/prueba` (primera vez, con descarga) | 2026-09-25 | moto g54 5G, Android 15, arm64-v8a | APK EAS `preview` desde `feat/privy-wired` (#105) | ✅ 9,7 s, incluye descargar y cargar la llave de 21 MB; salidas 1 · 3 · 1 · 1 | Texto de la pantalla leído por `uiautomator` vía adb; `libknowni_prover.so` arm64 (1 564 584 bytes) dentro del APK |
| 1 · Groth16 en `/prueba` (segunda vez) | 2026-09-25 | moto g54 5G, Android 15, arm64-v8a | APK EAS `preview` desde `feat/privy-wired` (#105) | ✅ 1,3 s, prueba y verificación con la llave ya cargada | Igual; `logcat` sin errores |
| 2 · Recorrido `/` → `/acuse` con el emisor real | | | | | |
| 3 · Presentación en modo avión (A12) | | | | | |
| 4 · Repetición rechazada tras reiniciar la app | | | | | |
| 5 · Pago testnet firmado en el teléfono | | | | | |

## Deuda conocida

| Deuda | Dónde | Bloque |
|---|---|---|
| ~~`retrieval/` está construido sobre la lectura de Chroma~~ **Saldada el 2026-09-24 (B3):** se retiraron el adaptador de Chroma, el puerto, el índice en memoria y `listas.ts`; el recorrido de `journey/` tamiza listas por el camino de Croma y `sources/` ya no depende del workspace. Quedan `normalize.ts` y `resolve.ts`, hoy sin llamador, para los dos endpoints de Croma que consultan por nombre | `retrieval/` | ✅ |
| ~~El sobre `Disclosure` no admite el perfil vehicular~~ **Saldada el 2026-09-24:** `capacity` y `assetStanding` son respuestas entregables y entran en el compromiso del resultado — D-63, A15. A16 saldada el mismo día: `meetsAll` desaparece y `meetsProfile` recibe el perfil de quien pregunta — D-66 | `core/src/disclosure.ts` | ✅ |
| `ofAge` se deriva de que la cédula de ciudadanía solo se expide a mayores de edad. Es una regla jurídica, no un dato que devuelva la fuente | `sources/src/country/colombia/registraduria.ts` | confirmar con el concepto legal |
| Ningún adaptador se ha ejercido contra una respuesta real sobre una persona: los esquemas vienen del OpenAPI de Croma, no de una llamada | `sources/src/country/colombia/` | requiere un titular que autorice |
| ~~Tests planos sin `unit · fuzz · invariant`~~ **Saldada el 2026-09-20:** 26 archivos movidos a `test/unit` y `test/invariant` con sufijo `.spec.ts`, más tres suites `fuzz` nuevas | todos los workspaces | ✅ |
| ~~Cabeceras de 10–30 líneas con narrativa~~ **Saldada el 2026-09-20:** 65 archivos con cabecera de 2–3 líneas y 146 bloques narrativos retirados. El razonamiento vive en `memoria.md` | todos los `.ts` | ✅ |
| ~~El cliente de Croma sigue reintentando después de que la emisión dejó de esperar esa fuente~~ **Saldada el 2026-09-24:** el cliente acepta un `AbortSignal` y la emisión le da uno por fuente; el mismo plazo que corta la espera cancela la llamada en vuelo, los reintentos y el sondeo — D-69 | `sources/src/providers/croma/client.ts`, `issuer/src/service.ts` | ✅ |
| `sources/src/country/colombia/pila.ts` habla de un operador que todavía no existe como integración | `sources/` | B4 |
| ~~El código sigue llamando `standing` a lo que la documentación ya llama `sanctions`~~ **Saldada el 2026-09-24 (B2):** `SanctionsClaim`, `proveSanctions`, `SanctionsParams`, el campo del sobre, la señal del circuito y el del contrato. El tag del reclamo es un número, así que ningún compromiso cambió; `assetStanding` no se tocó | `core/`, `sources/`, `circuits/`, `contracts/` | ✅ |
| ~~`IncomeBasis` no tiene el eje de procedencia~~ **Saldada el 2026-09-24 (B4b):** `IncomeClaim` lleva `provenance`, entra en el compromiso —ancho 10, `PoseidonKnowni12`— y `SolvencyParams` exige nombrar qué rutas acepta. El circuito y `core/` se comprueban contra un testigo que CI reconstruye en cada corrida | `core/src/claims.ts` | ✅ |
| Los dos commits iniciales llevan cuerpo, contra la regla de una línea | historia de git | no se reescribe historia; la regla aplica desde el tercero. El trailer que también se les señalaba dejó de ser una desviación: desde 2026-09-25 los dos trailers de sesión son obligatorios |

## Auditoría de afirmaciones — 2026-09-20

Cada afirmación del `README.md` contra lo que realmente corre. Comprobado en esta fecha, con el
repositorio en `main` y la suite en 236 pruebas.

| Afirmación | Cómo se comprobó | Veredicto |
|---|---|---|
| "no hay dependencias externas" | `dependencies` de los seis `package.json`: solo enlaces `@knowni/*` entre workspaces | ✅ exacta |
| "236 pruebas" | `npm test` desde un clon limpio, y CI en verde en Node 22 y 24 | ✅ exacta |
| "el expediente cabe en diez campos" | `Disclosure` tenía diez campos de primer nivel | ⚠️ **desactualizada desde 2026-09-24**: son doce sin anclaje y trece con él, porque el sobre admitió `capacity` y `assetStanding` (D-63). El README ya dice doce |
| "ancló de verdad" en Stellar testnet | `GET /transactions/0dc0fdf4…` en Horizon: `successful: true`, ledger 4783364, memo igual al compromiso | ✅ exacta |
| "21 pruebas" del cliente de Croma | 17 en `croma.test.ts` + 4 en `croma-contract.test.ts` | ✅ exacta |
| "llamada en vivo a Croma, acotada" | Catálogo, sondeo de 16 rutas con cuerpo vacío y un `200` sobre una empresa pública | ✅ exacta |
| "ningún log lleva documento, nombre, salario ni cuenta" | `journey/test/redaction.test.ts` captura telemetría, sumidero y los cinco métodos de consola | ✅ exacta, con una excepción declarada: el `logError` inyectado sí recibe el error crudo |
| "circuitos escritos, sin compilar" | No existe `circuits/build/`; nada en el repositorio los ejecuta | ✅ exacta |
| "contrato Soroban escrito, sin desplegar" | `contracts/knowni-verifier` sin dirección. **Desactualizada desde 2026-09-23**: ya compila y sus pruebas corren en CI; el README lo dice así | ⚠️ corregida en el README |
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
