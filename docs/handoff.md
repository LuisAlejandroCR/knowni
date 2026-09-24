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
| Pruebas | **454 del repositorio** + **54 de la app**, verdes en CI |
| CI | cinco jobs: suite en Node 22 y 24, app (typecheck, pruebas y bundle de Metro para iOS y Android), contrato Soroban, circuitos |
| Ramas | solo `main` (`7d4c4a8`); 81 PRs integrados; sin PRs abiertos |
| Lenguaje | todo el repositorio pasa por `tsc --strict` con `noUncheckedIndexedAccess`, y por ESLint con reglas de tipos |

## Criterios de aceptación: dónde están

La tabla completa vive en `docs/plan.md` → *Auditoría de ejecución*. En resumen:

- **Cumplidos:** A1–A8, A11, A13, A14, A15, A16 y todo el bloque de pago móvil (P1–P9) y de caché (C1–C8).
- **Parciales, y por qué:** A9 (faltan llamadas consentidas sobre personas reales) y A10 (falta la
  firma real de Privy —necesita un app id— y que la transacción la produzca el teléfono).
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

### 2b. Wallets reales y una transacción del teléfono (A10) — **bloqueado por una llave**

El pago en USDC ya se ejerció contra la testnet (`fb64700b…`), pero con una firma construida aquí.
Privy necesita un app id para firmar de verdad, y la transacción todavía no la produce el recorrido
móvil.

### 2c. Servir el documento de registro por HTTPS — **falta una URL**

El ancla ya es real. Lo que falta del camino web de A3 es publicar el JSON firmado en algún sitio:
en el ejercicio se sirvió desde memoria, y `docs/verificacion.md` lo dice así. Una página estática
basta; `attestation/tools/publish-registry.ts` imprime el documento y su digest.

### 3. Recuperar el resto del 29% de restricciones — **trabajo técnico, sin bloqueo**

Una parte ya se recuperó: la plantilla llana gastaba una señal por sumar la constante de ronda y tres
por cada celda que una ronda parcial se limita a copiar. Eso salió (D-62) sin tocar la permutación.
Medido por CI: 37 504 → 25 049 restricciones (−33%), por debajo de las 28 975 que costaba la forma
optimizada de circomlib. Hoy el circuito está en 25 221 en total —12 424 no lineales y 12 797
lineales—, porque B4b le añadió la procedencia del ingreso. Lo que queda es suyo: las matrices dispersas `S` y `P`, que aquí nunca se
reprodujeron y que D-52 dejó nombrado. Las 182 no lineales que también bajaron están explicadas: plegado de constantes en la ronda 0, 2
por celda constante × 91 celdas (D-62).

### 4. `outcome` y `session` siguen en SHA-256 — **deliberado**

El compromiso de resultado, la sesión y el nulificador siguen usando `FieldHash` (bytes). El circuito
no los pide todavía. Cuando los pida, el camino es el mismo que se recorrió para los reclamos.

### 5. El contrato nunca se desplegó

Compila y su política está probada, pero nadie lo ha puesto en una red. Antes de desplegarlo está la
lista de `contracts/knowni-verifier/README.md`, y el primer punto de esa lista —el orden de las
señales— ya está cerrado.

## El marco que entra ahora: banca *AI-enabling*

Entrada de esta sesión: dos publicaciones de LinkedIn, de **Mauro Taroco** (Domus) y **Natalia
Jiménez**, sobre la diferencia entre un banco *AI-enabled* y uno *AI-enabling*. No se incrustan aquí
—`AGENTS.md` prohíbe medios de terceros— pero su contenido es el marco, atribuido:

> *AI-enabled* es un banco que usa IA. *AI-enabling* es un banco **que la IA puede usar**. Lo
> primero —copilotos, onboarding, modelos de fraude— cualquier competidor lo copia en 18 meses con
> el mismo proveedor. Lo segundo es que un agente, operando en nombre de un cliente, pueda
> autenticarse contra la infraestructura, mover dinero dentro de límites que definió el cliente,
> validar una contraparte y dejar todo auditable.
>
> El problema: las APIs bancarias se diseñaron asumiendo un humano con un celular. OTP por SMS,
> sesiones que expiran, confirmaciones visuales. Para un agente cada uno de esos pasos es una pared.
>
> — y de la segunda publicación: *«identidad, límites, delegación, reversibilidad, trazabilidad y
> accountability pasan a ser parte del producto. La próxima batalla no es por tener la mejor app:
> es por ser el banco en el que los humanos confían lo suficiente como para dejar actuar a sus
> agentes.»*

### Por qué esto le habla directamente a knowni

La tesis del repositorio —*demuestra que calificas para firmar, sin decir quién eres*— ya está
construida sobre las piezas que ese marco pide, y **no por casualidad**:

| Lo que el marco pide | Lo que ya existe aquí |
|---|---|
| Identidad verificable sin exponer a la persona | `subjectRef` salteado, compromisos, `core/` sin ningún dato personal |
| Permisos delegados con límites del cliente | La sesión ata a una contraparte, una finalidad, un reto y una fecha (criterio A5) |
| Trazabilidad y auditabilidad | Anclaje en Stellar, raíz firmada por el emisor, nulificador de un solo uso |
| Reversibilidad / no repetición | El conjunto gastado persiste en disco y en dispositivo (D-34, D-36, D-37) |
| Una API pensada para que del otro lado haya una máquina | **Esto es lo que falta**: `issuer/` habla HTTP con llave de contraparte, pero nada del producto está pensado como superficie para un agente |

### La pregunta abierta, que es de producto y no de código

El marco sugiere un uso que el repositorio **no** tiene escrito en ningún sitio: que quien presenta
la credencial no sea una persona con un teléfono sino **un agente actuando por ella**. Eso toca la
frontera que `AGENTS.md` declara no negociable —*«una consulta a una fuente ocurre en emisión, con
consentimiento del sujeto; la contraparte nunca consulta»*— y merece una entrada en `docs/memoria.md`
antes de ser una línea de código.

Preguntas concretas para esa entrada:

1. ¿Un agente puede **sostener** una credencial en nombre del sujeto, o solo presentarla? La
   diferencia decide si el secreto del sujeto sale del dispositivo, que hoy nunca sale.
2. Si un agente presenta, ¿qué lo distingue de un replay? El nulificador ata la presentación a una
   sesión; no dice *quién* la presentó.
3. ¿El consentimiento por fuente (D-31) sigue siendo del sujeto, o hay un consentimiento delegado
   con límites? Es exactamente el *«permisos delegados»* del marco, y hoy no existe.

**Ninguna de las tres se responde escribiendo código.** Van a `docs/plan.md` como criterios de
aceptación antes de tocar nada, que es lo que el ciclo SDD del proyecto exige.

## Cómo arrancar el chat nuevo

```bash
npm install           # enlaza los workspaces
npm run verify        # lint + typecheck + 454 pruebas
cd app && npm install && npm test   # 54 pruebas, proyecto aparte
```

Para los circuitos y el contrato hace falta `cargo` y `circom` construido desde fuente; CI lo hace
en cada PR y los comandos exactos están en `circuits/README.md`. Construir circom tarda unos diez
minutos y vale la pena: sin él, un cambio que toque un compromiso no se puede comprobar contra el
circuito, y tomar la cifra de `core/` volvería circular la prueba que une las dos implementaciones.

Para ejercer la cadena hace falta que la política de red del entorno permita
`horizon-testnet.stellar.org`. `friendbot.stellar.org` sigue denegado, pero la cuenta demo ya está
fondeada, así que no hace falta.
