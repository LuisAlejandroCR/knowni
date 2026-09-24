<!-- docs/handoff.md
     Estado del proyecto al cierre del 2026-09-24 y cómo continuar en un chat nuevo:
     qué corre, qué está comprobado, qué falta y qué decisiones esperan al humano.
     Se distingue de plan.md, que fija el alcance, y de memoria.md, que guarda el porqué. -->

# Traspaso — 2026-09-24

Para retomar en un chat nuevo. Leer en este orden: `AGENTS.md`, `CLAUDE.md`, este archivo,
`docs/memoria.md` (decisiones, D-01 a D-61), `docs/verificacion.md` (qué está comprobado y qué no).

## Dónde está el proyecto

| | Estado |
|---|---|
| Pruebas | **407 del dominio** + **32 de la app**, verdes en CI |
| CI | cinco jobs: suite en Node 22 y 24, app, contrato Soroban, circuitos |
| Ramas | solo `main` (`e00fba1`); 65 PRs integrados; sin PRs abiertos |
| Lenguaje | todo el repositorio pasa por `tsc --strict` con `noUncheckedIndexedAccess`, y por ESLint con reglas de tipos |

## Lo que se cerró en las últimas sesiones

El hilo largo fue **hacer que `core/` y el circuito hablen del mismo número**. Está cerrado:

| | |
|---|---|
| Poseidon | Implementado en `core/`, derivado con el generador de Grain que reproduce las constantes BN254 de circomlib. Plantilla propia en circom que da el mismo valor que el gadget de circomlib con las mismas 243 restricciones |
| Curva | El circuito compila sobre **BN254 y BLS12-381** con constantes derivadas para cada campo. CI compila las dos. Cierra D-02, que desde el día 1 decía *«Groth16 sobre BLS12-381, nunca BN254»* y hasta ahora no se podía cumplir |
| Compromisos | `commitClaim` de `core/` y `IdentityCommitment`/`IncomeCommitment` del circuito dan **el mismo número**, fijado contra testigos del gadget compilado |
| Contrato | Compila, 11 pruebas de política, `wasm` construido en CI. El orden de señales lo escribe el compilador de Circom y CI lo verifica |

**Seis bugs salieron de ese trabajo**, ninguno visible antes: el contrato leía la instantánea de
listas del índice de `minMonthsPaid` (D-51); `core/` y el circuito hasheaban distinto mientras el
código afirmaba lo contrario (D-54); al circuito le faltaba el hash de la hoja entero (D-55);
`idCommit` no ataba `attestedAt`, así que no había forma de exigir frescura (D-60); y tres sitios en
producción fabricaban referencias con SHA-256 fuera del campo (D-59).

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

### 3. Recuperar el resto del 29% de restricciones — **trabajo técnico, sin bloqueo**

Una parte ya se recuperó: la plantilla llana gastaba una señal por sumar la constante de ronda y tres
por cada celda que una ronda parcial se limita a copiar. Eso salió (D-62) sin tocar la permutación.
Lo que queda es de circomlib: sus matrices dispersas `S` y `P`, que aquí nunca se reprodujeron y que
D-52 dejó nombrado. Las cifras medidas salen del job `circuits` en CI.

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
npm run verify        # lint + typecheck + 407 pruebas
cd app && npm install && npm test   # 32 pruebas, proyecto aparte
```

Para los circuitos y el contrato hace falta `cargo` y `circom` construido desde fuente; CI lo hace
en cada PR y los comandos exactos están en `circuits/README.md`.
