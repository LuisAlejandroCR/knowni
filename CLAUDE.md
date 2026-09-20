<!-- CLAUDE.md
     Capa específica de este proyecto para Claude Code: misión, contexto, stack,
     exclusiones no negociables, idioma y reglas de version control.
     No reemplaza a AGENTS.md, que es la constitución y manda sobre este archivo. -->

# CLAUDE.md — Knowni

> Guía para Claude Code en este repositorio. **No reemplaza a [`AGENTS.md`](AGENTS.md)** — esa es
> la constitución. Este archivo es la capa específica: contexto, herencia, idioma y estilo.

## Norte — la misión

> *Que una persona pueda arrendar o comprar un inmueble demostrando que califica, sin entregar
> cédula, nómina ni extractos — desde su teléfono, y sin que el dato salga de él.*

Cosas que tienen que ser ciertas:

1. La contraparte recibe respuestas, nunca datos. Su registro completo de la solicitud cabe en diez
   campos y ninguno dice nada del solicitante más allá de lo que preguntó.
2. La app funciona sin red una vez emitidas las credenciales. La prueba se genera en el teléfono.
3. **Nunca se emite un puntaje.** En el momento en que esto devuelve un número de 0 a 1000 es una
   central de riesgo con otro nombre.

## Contexto

| Dato | Valor |
|---|---|
| Entrega / deadline | Hackathon Stellar — fecha ⏳ pendiente |
| Jurado / cliente | ⏳ pendiente |
| Criterio de evaluación | ⏳ pendiente |
| Plataformas | iOS y Android — ver [`docs/MOBILE.md`](docs/MOBILE.md) |
| Fuente de datos | Croma — ver [`docs/CROMA.md`](docs/CROMA.md) |
| Cadena (primera) | Stellar, detrás de un puerto agnóstico |

## Arranque de sesión (obligatorio)

```text
AGENTS.md
CLAUDE.md
docs/memoria.md
docs/verificacion.md
git status
```

Después de `/compact` o `/new`: re-leer este archivo, `AGENTS.md` y `docs/memoria.md`.
No asumir el estado de un archivo sin leerlo.

## Ciclo SDD

| Paso | Dónde vive |
|---|---|
| Specify (qué + criterios de aceptación) | `docs/plan.md` |
| Plan (cómo: enfoque técnico, archivos, datos) | `docs/memoria.md` |
| Tasks (pasos pequeños y verificables) | `docs/plan.md` → *Bloques* |
| Implement | código |
| Verify | tests + lint + typecheck + ejercicio real; bitácora en `docs/memoria.md` |

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
| Un puntaje de 0 a 1000 | Sería una central de riesgo con otro nombre, hereda su regulación, y devuelve a la contraparte a decidir sobre una cifra opaca |
| Datos no públicos y no consentidos | Registro público es lo publicado por una autoridad, no lo que se puede encontrar. Sin scraping, sin redes sociales, sin "señales de comportamiento" |
| Formalidad escondida dentro de otro predicado | Si "cotiza a seguridad social" se vuelve requisito de facto e invisible, el producto excluye a la mitad informal del país |
| Foto de la cédula en cualquier punto del flujo | Es exactamente el artefacto que el producto existe para eliminar |
| PWA como camino principal | No hay proving en el dispositivo, ni enclave seguro, ni passkey. Ver [`docs/MOBILE.md`](docs/MOBILE.md) → *Lo que se descartó* |
| Curva BN254 en los circuitos | Stellar no la verifica hasta CAP-0074. Compilar con el default de Circom produce pruebas inverificables |

## Variables de entorno

Viven en `.env` (gitignored). Documentar el **nombre**, nunca el contenido.

| Variable | Nota |
|---|---|
| `CROMA_API_KEY` | ⏳ pendiente |
| `CROMA_BASE_URL` | Opcional; default `https://api.croma.run` |
| `STELLAR_NETWORK` | ⏳ pendiente — `testnet` para la demo |
| `KNOWNI_ISSUER_SEED` | ⏳ pendiente — firma la raíz publicada |

## Stack

| Capa | Tecnología |
|---|---|
| App | React Native + Expo (iOS y Android) — ver [`docs/MOBILE.md`](docs/MOBILE.md) |
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

- Repo: <https://github.com/LuisAlejandroCR/knowni> · rama de trabajo
  `claude/kyc-blockchain-verification-vbr6m4`.
- **Excepción autorizada a la regla base de `AGENTS.md`:** en este repositorio el humano autorizó
  al agente a commitear y pushear **a la rama de trabajo**. A `main` nunca, y ningún push sin la
  verificación de cierre en verde.
- El repositorio es **privado**, así que `docs/`, `CLAUDE.md` y `AGENTS.md` se commitean en vez de
  ir al `.gitignore` como en un repo público. Si se hace público, esa decisión se revisa antes.

## Output style: ADHD mode (activo por defecto)

*(Fuente: [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd))*

Liderar con la respuesta o próxima acción · numerar el trabajo multi-paso · cerrar con una acción
de menos de dos minutos · máximo 5 ítems por lista · errores con ubicación, causa y arreglo, sin drama.
Excepciones: explicar a fondo cuando se pide una explicación; confirmar antes de acciones destructivas;
tras tres intentos fallidos, parar y nombrar el supuesto dudoso.

## Herencia — qué viene de dónde

| De | Qué se reutiliza |
|---|---|
| [`creva-zk`](https://github.com/LuisAlejandroCR/creva-zk) | La primitiva: verificar un reclamo firmado, evaluar un predicado público, divulgar solo el resultado. El puerto de anclaje. La regla `degraded` ≠ `failed` |
| [`Digentia`](https://github.com/LuisAlejandroCR/Digentia) | El contrato real de Croma: rutas, envoltorio `{data}`, jobs 202, reintento en 502 de Rama Judicial, y el patrón `BlockResult<T>` |
| `procedures/00_Files/kuira_android_midnight.md` | La regla para elegir nativo vs PWA, y su tabla de costes |

## Referencias

- Constitución → [`AGENTS.md`](AGENTS.md)
- Plan y criterios de aceptación → [`docs/plan.md`](docs/plan.md)
- Enfoque técnico y bitácora → [`docs/memoria.md`](docs/memoria.md)
- Datos verificados y pendientes → [`docs/verificacion.md`](docs/verificacion.md)
- Docs de librerías → <https://context7.com/>
- Docs de Croma → <https://docs.usecroma.com>
- Aprendizajes de este proyecto → [`LEARNINGS.md`](LEARNINGS.md)
