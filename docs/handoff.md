<!-- docs/handoff.md
     Estado del proyecto al cierre del 2026-09-24 y cómo continuar en un chat nuevo:
     qué corre, qué está comprobado, qué falta y qué decisiones esperan al humano.
     Se distingue de plan.md, que fija el alcance, y de memoria.md, que guarda el porqué. -->

# Traspaso — 2026-09-24

Para retomar en un chat nuevo. Leer en este orden: `AGENTS.md`, `CLAUDE.md`, este archivo,
`docs/memoria.md` (decisiones, D-01 a D-73), `docs/verificacion.md` (qué está comprobado y qué no),
`docs/plan.md` (criterios de aceptación y la auditoría del 2026-09-24, que dice el estado de cada uno).

## Dónde está el proyecto

| | Estado |
|---|---|
| Pruebas | **479 del repositorio** + **59 de la app**, verdes en CI |
| CI | cinco jobs: suite en Node 22 y 24, app (typecheck, pruebas y bundle de Metro para iOS y Android), contrato Soroban, circuitos |
| Ramas | solo `main` (`20ae2a4`); 83 PRs integrados; sin PRs abiertos |
| Lenguaje | todo el repositorio pasa por `tsc --strict` con `noUncheckedIndexedAccess`, y por ESLint con reglas de tipos |

## Criterios de aceptación: dónde están

La tabla completa vive en `docs/plan.md` → *Auditoría de ejecución*. En resumen:

- **Cumplidos:** A1–A8, A11, A13, A14, A15, A16 y todo el bloque de pago móvil (P1–P10) y de caché (C1–C8).
- **Parciales, y por qué:** A9 (faltan llamadas consentidas sobre personas reales) y A10 (el app id
  de Privy ya existe; faltan el dominio de passkey, un dev build, y que la transacción la produzca el
  teléfono).
- **Bloqueado:** A12, que exige un dispositivo físico en modo avión.

## Antes de esta sesión

El hilo largo fue hacer que `core/` y el circuito hablen del mismo número: Poseidon propio,
compilación sobre BN254 **y** BLS12-381, y compromisos de reclamo idénticos a los del gadget. Está
cerrado, y sacó seis bugs que nadie veía —el contrato leía la instantánea de listas del índice
equivocado, al circuito le faltaba el hash de la hoja, `idCommit` no ataba `attestedAt`—. El detalle
está en `docs/memoria.md`, D-51 a D-63.

## Lo que se cerró en la sesión del 2026-09-24

| | |
|---|---|
| A3 | `RegistryPort`: un documento de registro firmado y **dos raíces de confianza** sobre él —la firma de la autoridad y el digest anclado en cadena—, con una sola suite corriendo contra las dos. **Anclado de verdad** en testnet: `66bf1b7d…`, y un documento distinto contra la misma ancla responde `digest_mismatch` (D-65, D-73) |
| A7 | `not_found`, `degraded` y `failed` dejan de ser el mismo `unavailable`. La causa viaja **al lado** del sobre firmado, nunca dentro: la contraparte sigue sin saber por qué (D-68) |
| A16 | `meetsAll` desaparece; el perfil es una lista de requisitos que compone quien pregunta, y `core/` no codifica la lista de ningún contrato (D-66) |
| A14 | CI empaqueta la app con Metro para iOS y Android; typecheck y `node --test` corren bajo Node, donde `Buffer` existe, así que nadie preguntaba si la app empaqueta (D-64) |
| P6–P8 | El pago móvil pasa de contrato escrito a prueba: cinco razones de fallo que no colapsan, serialización sin firma ni sobre ni respuesta cruda, y portabilidad comprobada contra el empaquetador (D-64) |
| B2 | El código deja de llamar `standing` a lo que el producto llama `sanctions`, en `core/`, fuentes, circuito, fixture de señales y contrato. **Ningún compromiso cambió**: la clase entra como número (D-72) |
| B3 | El tamizado de listas por nombre se va entero; el recorrido usa la fuente de producción con un Croma sintético. `sources/` deja de depender de `retrieval/` (D-70) |
| B4b | `provenance` en el reclamo de ingreso y **dentro del compromiso**: 12 385 → 12 424 restricciones no lineales, medidas. `SolvencyParams` exige nombrar las rutas que acepta (D-71) |
| Dos deudas que salieron al medir | El plazo de emisión cortaba la espera pero no el trabajo: el cliente de Croma seguía gastando llamadas pagadas (D-69). Y el adaptador de Chroma llevaba 110 líneas sin llamador |

## Lo que falta, en orden

### 1. Setup de confianza y una prueba Groth16 — **espera decisión**

Nunca se ha generado ni verificado una prueba. El camino es `snarkjs powersoftau` y una zkey.

**La decisión es del humano:** una ceremonia de un solo contribuyente produce una **clave de
desarrollo**, y quien tiene la contribución puede falsificar pruebas de ese circuito. Groth16 tiene
setup por circuito y es residuo tóxico. Producción necesita una ceremonia multiparte.

Opciones: generarla y etiquetarla como clave de desarrollo, o no generarla hasta que haya ceremonia.

### 2. Ejecución en un teléfono físico (A12) — **bloqueado por hardware**

El criterio pide emitir una presentación sin red, en modo avión, en un dispositivo real. Necesita el
teléfono del humano; no hay forma de hacerlo desde aquí.

### 2b. Wallets reales y una transacción del teléfono (A10) — **falta un dominio y un dev build**

El pago en USDC ya se ejerció contra la testnet (`fb64700b…`), pero con una firma construida aquí.
`EXPO_PUBLIC_PRIVY_APP_ID` ya existe (2026-09-25), y el adaptador está completo: `wallet-privy.ts`
firma el hash de la transacción como `raw_hash`, que es exactamente lo que Stellar firma. Lo que
queda **no es el app id**:

1. `EXPO_PUBLIC_PRIVY_RP` — un dominio HTTPS que sirva `apple-app-site-association` y
   `assetlinks.json`. Vacío, `loginWithPasskey` no tiene contra qué validar. **El sitio ya está
   escrito**: `web/`, y es el mismo dominio de 2c. Faltan dos valores que no están en el
   repositorio: `KNOWNI_APPLE_TEAM_ID` y `KNOWNI_ANDROID_CERT_SHA256` —la huella del certificado
   con el que se firma el build que se instala, la de Play si hay Play App Signing—.
2. Un dev build. Expo Go no carga `@privy-io/expo/passkey` ni `extended-chains`: son nativos.

El rodeo ya está escrito (2026-09-25, D-75): `wallet-keypair.ts`, un adaptador de keypair local
detrás del mismo `PayerWalletPort`, con `signingMethod: "raw_hash"`. Falta ⏳ ejecutarlo contra
testnet con una cuenta fondeada y conectarlo a una pantalla con la semilla en almacén seguro; eso
cierra la mitad de A10 que dice *el recorrido produce su propia transacción*.

### 2c. Servir el documento de registro por HTTPS — **el sitio existe; falta desplegarlo**

El ancla ya es real. Lo que falta del camino web de A3 es publicar el JSON firmado: en el ejercicio
se sirvió desde memoria, y `docs/verificacion.md` lo dice así.

`web/` es ese sitio, para Vercel: Root Directory `web`, Output Directory `public`, **sin build
command y sin una sola variable de entorno**. Eso último es deliberado — el documento lo firma
`KNOWNI_REGISTRY_SEED`, y firmarlo en el build del proveedor pondría la semilla en su CDN. Se firma
en local con `attestation/tools/publish-registry.ts`, `web/build.ts` deja el resultado en `public/`,
y se commitea. `web/README.md` tiene los tres pasos en orden.

### 3. El sobrecoste de restricciones — **cerrado; lo que queda es el margen**

El +29% de D-61 dejó de ser deuda y pasó a ser margen. Dos movimientos, ninguno de ellos toca la
permutación: primero la clave de ronda y las celdas copiadas dejaron de gastar señal (D-62,
37 504 → 25 049); después el estado entero dejó de ser una señal por celda y por ronda y pasó a
viajar como expresión lineal, materializando solo lo que se eleva a la quinta (D-74,
25 221 → **12 633**, −50%, y 25 281 → 12 693 cables). Hoy: 12 379 no lineales y 254 lineales,
iguales sobre las dos curvas.

Queda **muy por debajo** de las 28 975 de la forma optimizada de circomlib, así que las matrices
dispersas `S` y `P` —que D-52 dejó nombradas y aquí nunca se reprodujeron— ya no son una deuda de
coste: reproducirlas serviría para bajar las no lineales, y las no lineales apenas se movieron
(−45). Si alguien las retoma, que sea con una cifra objetivo delante, no por cerrar un pendiente.

### 4. `outcome` y `session` siguen en SHA-256 — **deliberado**

El compromiso de resultado, la sesión y el nulificador siguen usando `FieldHash` (bytes). El circuito
no los pide todavía. Cuando los pida, el camino es el mismo que se recorrió para los reclamos.

### 5. El contrato nunca se desplegó

Compila y su política está probada, pero nadie lo ha puesto en una red. Antes de desplegarlo está la
lista de `contracts/knowni-verifier/README.md`, y el primer punto de esa lista —el orden de las
señales— ya está cerrado.

## El marco que entra ahora: banca *AI-enabling*

Entrada de una sesión anterior: dos publicaciones de **Mauro Taroco** (Domus) y **Natalia Jiménez**
sobre la diferencia entre un banco *AI-enabled* y uno *AI-enabling*. El marco, lo que ya existe aquí
de lo que pide, las tres preguntas de producto que hay que responder antes de escribir código y los
criterios G1–G6 viven ahora en [`plan.md`](plan.md) → *Bloque futuro — el portador puede ser un
agente*, que es donde el ciclo del proyecto los pone.

**Las tres preguntas están contestadas (2026-09-25, D-76):** el agente presenta y nunca sostiene,
el nulificador sigue siendo el control de replay, y el consentimiento por fuente no se delega. Primer
corte hecho: la delegación firmada (G2). Faltan G1 y G3–G6.

## Cómo arrancar el chat nuevo

```bash
npm install           # enlaza los workspaces
npm run verify        # lint + typecheck + 479 pruebas
cd app && npm install && npm test   # 59 pruebas, proyecto aparte
```

Para los circuitos y el contrato hace falta `cargo` y `circom` construido desde fuente; CI lo hace
en cada PR y los comandos exactos están en `circuits/README.md`. Construir circom tarda unos diez
minutos y vale la pena: sin él, un cambio que toque un compromiso no se puede comprobar contra el
circuito, y tomar la cifra de `core/` volvería circular la prueba que une las dos implementaciones.

Para ejercer la cadena hace falta que la política de red del entorno permita
`horizon-testnet.stellar.org`. `friendbot.stellar.org` sigue denegado, pero la cuenta demo ya está
fondeada, así que no hace falta.
