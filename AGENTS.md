<!-- AGENTS.md
     Constitución del proyecto: las reglas obligatorias para cualquier agente que
     toque este repositorio, y el reparto de trabajo entre varios agentes en paralelo.
     Incluye la capa del producto: misión, contexto, exclusiones, stack e idioma.
     Se distingue de CLAUDE.md, que solo añade lo propio de Claude Code y no lo reemplaza. -->

# AGENTS.md — Constitución del proyecto

> **CONTRATO OBLIGATORIO DEL AGENTE**
>
> Optimizar para **65% calidad de cara al usuario / 35% experiencia de desarrollo**. Las reglas son
> obligatorias. Nunca saltarse la verificación ni inventar el estado del proyecto.
>
> Si un paso requerido no se puede ejecutar:
>
> `BLOCKED: <razón>`

## Arranque

Antes de modificar cualquier archivo, leer/ejecutar en orden:

```text
AGENTS.md
CLAUDE.md
docs/memoria.md
docs/verificacion.md
git status
```

Antes de codear, definir criterios de aceptación explícitos en `docs/plan.md`.

## Bloques de trabajo

Evaluar todo cambio no trivial contra:

### 1. Seguridad

* Validar la entrada no confiable. Toda respuesta de Croma se valida con esquema antes de usarse.
* Aplicar autenticación, autorización y mínimo privilegio.
* Nunca exponer ni hardcodear secretos. `CROMA_API_KEY` vive en `.env`, nunca en el repo.
* Revisar las vulnerabilidades y dependencias relevantes.

### 2. Código limpio

* Identificadores y comentarios en inglés.
* Código simple, enfocado y legible.
* Evitar duplicación y complejidad innecesarias.
* Seguir las convenciones existentes.

### 3. Código muerto

* Eliminar de forma segura el código, imports, variables, flags y rutas obsoletas cuyo desuso esté
  verificado.
* Nunca eliminar por suposición.

### 4. Arquitectura

* Respetar los límites existentes y la dirección de las dependencias.
* **Ningún workspace fuera de `*/adapters/` importa un SDK de proveedor.** Es la regla que hace
  reemplazable a cada adaptador, y está verificada en `core/test/no-vendor-imports.test.ts`.
* Evitar acoplamiento innecesario y refactors no relacionados.
* Documentar las decisiones arquitectónicas significativas en `docs/memoria.md`.

### 5. QA / CI-CD

* Seguir `Write → Test → Fix → Verify`.
* Correr los tests relevantes (unitarios, fuzz e invariantes), lint, verificación de tipos y build.
* Nunca debilitar un test para que pase.

```text
test/unit/       <name>.spec.ts            un comportamiento, entradas fijas
test/fuzz/       <name>.fuzz.spec.ts       entradas arbitrarias o malformadas
test/invariant/  <name>.invariant.spec.ts  propiedades que deben cumplirse para toda entrada
```

* Los tests viven en `test/`, nunca al lado del código fuente.
* Todo módulo nuevo recibe cobertura **unit**; **fuzz** cuando parsea o recibe algo de fuera del
  proceso; un **invariant** cuando una regla debe cumplirse para *toda* entrada.
* Todo lo que cruza un límite de proceso se ejercita **contra la cosa real al menos una vez** antes
  de darlo por listo. Para Croma eso significa una llamada en vivo con key, registrada en
  `docs/verificacion.md` con fecha.

### 6. Observabilidad / fiabilidad

* Considerar logging, métricas, trazas, health checks, timeouts, reintentos, idempotencia y falla
  elegante.
* Nunca loguear secretos ni datos sensibles innecesarios. **Un número de documento es dato sensible**
  y las APIs de registro lo devuelven en el eco del error: nunca sale en un resultado ni en un log.

### 7. Privacidad / cumplimiento

* Minimizar la recolección, el almacenamiento, la exposición y el registro de datos personales.
* No añadir tracking sin requisitos explícitos.
* Nunca inventar afirmaciones de cumplimiento.
* **La frontera del producto:** una consulta a una fuente ocurre en emisión, con consentimiento del
  sujeto. La contraparte nunca consulta. Añadir un camino de código de una sesión de verificación a
  una consulta colapsa el producto — ver `docs/ARCHITECTURE.md`.
* **Nunca antecedentes penales**, de nadie, por ninguna vía. No es una preferencia configurable:
  el endpoint no se llama y el predicado no existe. Ver `docs/memoria.md` D-09.
* **Nunca Sisbén ni ninguna clasificación de pobreza del Estado**, y nunca una respuesta negativa
  derivada del régimen de salud. Una fuente que ordena personas por nivel de pobreza convierte el
  producto en un filtro socioeconómico con sello oficial. Ver D-12.
* **Una inferencia sobre la situación económica de alguien que nadie preguntó es una fuga**, aunque
  el dato venga de una fuente oficial y aunque quepa en un booleano.
* **Medir la cobertura antes de dejar que una fuente influya en un resultado.** Una fuente que
  cubre desigual y además puntúa es un sesgo con respaldo oficial. Ver D-11.
* **Un resultado declara qué es y qué no estima.** Una banda descriptiva que no dice que es
  descriptiva se lee como una predicción. Ver D-10.

### 8. UX / rendimiento

* Priorizar la calidad de cara al usuario: corrección, accesibilidad, capacidad de respuesta, estados
  claros, rendimiento.
* En móvil: la app arranca y responde sin red. Generar una prueba no bloquea la interfaz.
* Medir los cambios de rendimiento significativos cuando sea práctico.

## SDD

```text
Specify → Plan → Tasks → Implement → Verify
```

* Plan y tareas: `docs/plan.md`
* Memoria del proyecto: `docs/memoria.md`
* Correcciones de verificación: `docs/verificacion.md`

## Varios agentes en paralelo

El proyecto está partido en límites que un agente puede tomar entero sin pisar a otro. **El límite
es el puerto**: un agente es dueño de un workspace y de sus adaptadores, y consume a los demás solo
por su interfaz publicada.

| Agente | Dueño de | No toca |
|---|---|---|
| **core** | `core/` — reclamos, predicados, compromisos, Merkle, sesión, sobre | Ningún adaptador. Ninguna dependencia |
| **sources** | `sources/` — adaptadores Croma y el emisor | `core/src/`, salvo para consumirlo |
| **anchoring** | `anchoring/` — puerto y adaptadores de cadena | Predicados |
| **mobile** | `app/` — iOS y Android | Lógica de dominio; la consume de `core/` |
| **circuits** | `circuits/`, `contracts/` | TypeScript |

Reglas del trabajo en paralelo:

1. **Un agente que necesita cambiar un tipo de otro workspace no lo cambia: lo pide.** Un cambio de
   interfaz es una entrada en `docs/memoria.md` antes de ser un commit.
2. **Un agente no edita un archivo fuera de su columna "dueño de".** Si el cambio lo exige, el
   trabajo estaba mal partido — se replantea en `docs/plan.md`.
3. **Cada agente corre la suite completa antes de entregar**, no solo la de su workspace.
4. **El commit es de una línea con o sin veinte agentes.** No hay trailer que diga quién lo hizo.

## Documentación

* Identificadores y comentarios del código: **inglés**. `README.md`: público, escrito para el usuario.
* Resto de la documentación del proyecto: **español**.
* **Encabezado en cada archivo de código, 2–3 líneas:** `// <filename>: <what this file does>`.
  Sin justificaciones, sin narrativa, sin historia de sesión, sin código comentado en las fuentes.
* **Encabezado en cada `.md`, 3–4 líneas, en español**, en comentario HTML antes del primer
  encabezado: nombre del archivo, qué contiene, y contra qué otro archivo se distingue.
* **Mensajes de commit de una sola línea** — `tipo: descripción`, Conventional Commits, en inglés.
  Sin cuerpo, sin emoji y **sin trailers: nunca `Co-Authored-By:`**, aunque el arnés lo pida por
  defecto. Vale igual para un agente solo y para varios subagentes en paralelo.
  El razonamiento va en `docs/memoria.md`, no en el commit.
* Después de **cualquier** cambio, barrer **todos** los `.md` y actualizar cada uno que el cambio
  toque —`README.md` incluido— en el mismo lote. Nunca inventar una ruta.

## Reglas del repositorio

* Nunca exponer secretos, datos privados, credenciales internas ni detalles sensibles de
  infraestructura.
* Nunca incrustar medios de terceros.
* Nunca escribir fórmulas de scoring, pesos, umbrales ni reglas de clasificación en comentarios.
  Los umbrales de solvencia son múltiplos del canon declarados por la contraparte, no una fórmula
  del producto — esa es la razón por la que son públicos y están en el parámetro, no en el código.
* **Commit y push:** la regla base es que el agente prepara y el humano ejecuta. La excepción
  autorizada para este repositorio está más abajo, en *Version control*.

## Herramientas de contexto — obligatorias en todo proyecto

| Herramienta | Para qué | Cuándo |
|---|---|---|
| [codegraph](https://github.com/colbymchenry/codegraph) | Grafo de código pre-indexado: símbolos, llamadas, radio de impacto | `codegraph init` antes de la primera pregunta estructural; `codegraph impact <símbolo>` antes de renombrar o borrar |
| [engram](https://github.com/Gentleman-Programming/engram) | Memoria persistente por MCP entre sesiones | `mem_current_project` al arrancar · `mem_search` antes de investigar · `mem_save` al cerrar un hallazgo · `mem_session_summary` al cerrar la sesión |
| `LEARNINGS.md` | La pregunta fija *¿Qué aprendí con este proyecto?* | Se llena mientras el proyecto vive, no el día que muere |

* El grafo y la base de recuerdos son **generados**: van al `.gitignore`, nunca se commitean.
* Ninguna de las dos sustituye leer el archivo. Dicen *dónde mirar*; el archivo dice *qué dice*.
* Nunca guardar en `engram` el valor de una key, un dato personal ni el log de la sesión.
* Lo de `LEARNINGS.md` que generaliza se anonimiza y sube a `procedures/knowledge/`.

## Norte — la misión

> *Demuestra que calificas para firmar, sin decir quién eres.*

Sin importar qué se firma. Un arrendamiento, una compraventa, una garantía, un contrato de
suministro, un poder: **el tipo de contrato es un perfil de la solicitud, no una rama del dominio**
(ver `docs/memoria.md` D-14). Cada aplicación elige qué predicados pide y con qué parámetros; ningún
predicado sabe para qué contrato lo están usando.

Cosas que tienen que ser ciertas:

0. **Nada en `core/` sabe qué tipo de contrato se está firmando.** `Purpose` es una cadena abierta validada, no una unión de los contratos que existían cuando se escribió.
1. La contraparte recibe respuestas, nunca datos. Su registro completo de la solicitud cabe en doce
   campos —uno por respuesta del catálogo, más el sobre— y ninguno dice nada del solicitante más
   allá de lo que preguntó. Añadir un predicado añade un campo; añadir un contrato no añade nada.
2. La app funciona sin red una vez emitidas las credenciales. La prueba se genera en el teléfono.
3. **Cada respuesta declara qué es y qué no estima.** Un `tier` es una banda descriptiva, no una
   probabilidad de impago, y lo dice. Nunca un número agregado que sustituya el criterio de la
   contraparte.

## Contexto

| Dato | Valor |
|---|---|
| Entrega / deadline | Stellar Odyssey Perú — 25 sep 2026, 23:59 (GMT-5) |
| Jurado / cliente | Jurado técnico del evento; evaluación asíncrona sobre repositorio y video demo |
| Criterio de evaluación | Funcionalidad/testnet 30% · integración Stellar 25% · originalidad 20% · continuidad 15% · claridad 10% |
| Producto | Contract-agnostic: cualquier contrato es un perfil. Ver D-14 |
| Perfil de la demo | **Compraventa de vehículo ante notario** — el único con fuentes reales de punta a punta. Ver D-13 |
| Plataformas | iOS y Android — ver `docs/MOBILE.md` |
| Fuente de datos | Croma — ver [`docs/CROMA.md`](docs/CROMA.md) |
| Cadena (primera) | Stellar, detrás de un puerto agnóstico |

## Reglas críticas para agentes IA

1. **Nunca exponer business logic** (fórmulas, pesos, umbrales, reglas de clasificación).
2. **No inventar estado del proyecto.** Sin verificar → `⏳ pendiente`.
3. **Documentar en el mismo lote — barrido completo de todos los `.md`, `README.md` incluido.**
4. **Degradación elegante con cualquier proveedor externo:** sin key o con Croma caído, la app
   arranca y responde con un resultado neutro tipado. Nunca un 500, nunca una excepción hacia
   arriba. `degraded` y `failed` son respuestas distintas y no se colapsan.
5. **Toda cifra lleva fuente y fecha.** Verificado en fuente primaria · repetido por prensa ·
   supuesto propio son tres cosas distintas y se marcan como tales.
6. **Sin secretos en el repo ni en la conversación.** Nunca imprimir el valor de una key.
7. **Un número de documento es dato sensible.** Las APIs de registro lo devuelven en el eco del
   error; nunca sale en un resultado, en un log ni en un mensaje de excepción.
8. **Aritmética financiera con enteros en unidades menores**, nunca `number` en decimales.
9. **Cabeceras:** código 2–3 líneas (`// <filename>: …`); `.md` 3–4 líneas en español antes del
   primer encabezado.
10. **Commits de una línea, sin cuerpo y sin trailers** — nunca `Co-Authored-By:`, con uno o con
    veinte agentes.

## Exclusiones no negociables

| Excluido | Razón |
|---|---|
| **Sisbén, y cualquier clasificación de pobreza del Estado** | Entregaría a un arrendador un filtro socioeconómico con sello oficial. No hay bandera de configuración ni modo avanzado: el endpoint no existe para este código. Ver `docs/memoria.md` D-12 |
| **Régimen subsidiado como respuesta negativa** | ADRES solo produce `formality: true` para cotizante activo; todo lo demás es `unavailable`, nunca `false`. Un `false` se lee como "es pobre". Ver D-12 |
| **Antecedentes penales, de nadie** | No dicen si alguien puede pagar un arriendo ni si puede contratar; dicen que cumplió una condena. Como filtro de vivienda le cierra la puerta a quien ya pagó, a escala y en silencio. Decisión firme heredada del proyecto GovTech anterior. Ver `docs/memoria.md` D-09 |
| Un número agregado de 0 a 1000 **en este producto** | No es un principio universal —el proyecto GovTech anterior emite un puntaje y hace bien— sino que aquí devolvería a la contraparte a decidir sobre una cifra opaca, que es justo lo que se le está quitando. Ver D-10 |
| Que una fuente de cobertura desigual alimente una decisión agregada | Premiaría el código postal o la formalidad laboral en vez de la capacidad de pagar. Se mide la cobertura antes de decidir. Ver D-11 |
| Datos no públicos y no consentidos | Registro público es lo publicado por una autoridad, no lo que se puede encontrar. Sin scraping, sin redes sociales, sin "señales de comportamiento" |
| Los endpoints globales de Croma (Web Search, Research, Extract) aplicados a una persona | Rompen la exclusión anterior por la puerta de atrás: buscar en la web sobre un sujeto no es consultar un registro público |
| Un tipo de contrato conocido por la capa de dominio | El contrato es un perfil que compone quien pregunta. Una unión cerrada de contratos hace que añadir uno sea un cambio en el dominio. Ver D-14 |
| Formalidad escondida dentro de otro predicado | Si "cotiza a seguridad social" se vuelve requisito de facto e invisible, el producto excluye a la mitad informal del país |
| Foto de la cédula en cualquier punto del flujo | Es exactamente el artefacto que el producto existe para eliminar |
| PWA como camino principal | No hay proving en el dispositivo, ni enclave seguro, ni passkey. Ver `docs/MOBILE.md` → *Lo que se descartó* |
| Curva BN254 en los circuitos | Stellar no la verifica hasta CAP-0074. Compilar con el default de Circom produce pruebas inverificables |

## Variables de entorno

Viven en `.env` (gitignored). Documentar el **nombre**, nunca el contenido.

| Variable | Nota |
|---|---|
| `CROMA_API_KEY` | ✅ en uso desde 2026-09-20; vive en `.env.local`, gitignored |
| `CROMA_BASE_URL` | Opcional; default `https://api.croma.run` |
| `STELLAR_NETWORK` | ⏳ pendiente — `testnet` para la demo |
| `KNOWNI_ISSUER_SEED` | ⏳ pendiente — firma la raíz publicada |
| `KNOWNI_ISSUER_ACCESS_KEYS` | ⏳ pendiente — una llave por contraparte, separadas por coma; sin ella el emisor no arranca. Ver D-31 |
| `KNOWNI_ISSUER_RATE_LIMIT_PER_MINUTE` | Opcional; default 20 por llave |
| `KNOWNI_SPENT_PAYMENTS_FILE` | ⏳ pendiente — obligatoria si hay tesorería: los pagos ya canjeados. Ver D-37 |
| `EXPO_PUBLIC_ISSUER_ACCESS_KEY` | ⏳ pendiente — la llave de este app como contraparte, la misma que `KNOWNI_ISSUER_ACCESS_KEYS` reconoce |
| `JEV_VERCEL_API_KEY` | Vercel AI Gateway, modelo `typesafe-ai/jev`. Solo herramienta de desarrollo: ningún dato de un sujeto sale hacia un modelo |

## Stack

| Capa | Tecnología |
|---|---|
| App | React Native + Expo (iOS y Android) — ver `docs/MOBILE.md`. `@react-native-async-storage/async-storage` guarda el conjunto gastado del verificador — D-36 |
| Dominio | TypeScript, sin dependencias, compartido entre app y backend |
| Prover | Rust sobre UniFFI (Kotlin + Swift) — ⏳ pendiente |
| Fuentes | Croma REST — `https://api.croma.run` |
| Circuitos | Circom, Groth16 sobre BLS12-381 |
| Cadena | Stellar / Soroban, detrás de `AnchoringPort` |
| Deploy | ⏳ pendiente |

## Idioma

| Qué | Idioma |
|---|---|
| Código: identificadores, comentarios, nombres de archivos y carpetas | Inglés |
| Lo que lee el usuario en pantalla | Español (Colombia) |
| `README.md` (público) | Español e inglés, escrito para el usuario, sin jerga |
| `docs/`, `CLAUDE.md`, `AGENTS.md` | Español |
| Commits | Inglés, Conventional Commits, **una línea, sin trailers** |

## Version control

- Repo: <https://github.com/LuisAlejandroCR/knowni> · se trabaja en ramas por entrega
  (`f0-day1`, `f0-day3`, …) y se integra por pull request.
- **Excepción autorizada a la regla base de `AGENTS.md`:** en este repositorio el humano autorizó
  al agente a commitear y pushear **a la rama de trabajo**. A `main` nunca, y ningún push sin la
  verificación de cierre en verde.
- El repositorio es **privado**. Se versionan `AGENTS.md`, `CLAUDE.md`, `LEARNINGS.md`, `README.md`
  y solo cuatro documentos — `docs/plan.md`, `docs/memoria.md`, `docs/verificacion.md` y
  `docs/CROMA.md` — porque son los que un agente necesita para trabajar. El resto de `docs/` está
  en el `.gitignore` y vive en local. Si se hace público, esa decisión se revisa antes.

## Herencia — qué viene de dónde

Trabajo propio anterior, sin dependencia de código entre proyectos.

| De | Qué se reutiliza |
|---|---|
| El proyecto ZK anterior | La primitiva: verificar un reclamo firmado, evaluar un predicado público, divulgar solo el resultado. El puerto de anclaje. La regla `degraded` ≠ `failed` |
| El proyecto GovTech anterior | El cliente de Croma —tope de polls, timeout, `sleep`/`fetch`/`logger` inyectables—, `SourceResult<T>`, el caché, y las decisiones D-09, D-10 y D-11 |
| El prototipo notarial anterior | Mismo dominio en Colombia. El mapa de rutas `/co/*` y sus esquemas de respuesta |
| Notas propias de procedimientos | La regla para elegir nativo vs PWA, y su tabla de costes |

## Referencias externas

* Documentación de librerías y frameworks: <https://context7.com/>. Consultar antes de suponer una
  ruta, un campo, una firma o una opción. Una firma recordada es una suposición hasta comprobarla.
* API de datos de gobierno: <https://docs.usecroma.com>. Toda ruta y todo campo van a
  `docs/verificacion.md` con la fecha en que se comprobaron.
* Estilo de salida: <https://github.com/ayghri/i-have-adhd>.

## Cierre

```text
VERIFICATION
- Build: PASS/FAIL
- Tests: PASS/FAIL
- Docs updated: YES/NO
- LEARNINGS.md updated: YES/NO
- git commit executed: YES/NO
- git push executed: YES/NO
```

Si la verificación falla o no se puede ejecutar: `BLOCKED: <razón>`.
Nunca afirmar que la tarea está completa sin una verificación exitosa.
