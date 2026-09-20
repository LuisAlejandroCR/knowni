<!-- AGENTS.md
     Constitución del proyecto: las reglas obligatorias para cualquier agente que
     toque este repositorio, y el reparto de trabajo entre varios agentes en paralelo.
     Se distingue de CLAUDE.md, que es la capa específica de este proyecto (misión,
     contexto, stack, exclusiones) y no reemplaza a este archivo. -->

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
  autorizada para este repositorio está escrita en `CLAUDE.md` → *Version control*.

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
