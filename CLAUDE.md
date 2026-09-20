<!-- CLAUDE.md
     Capa específica de este proyecto para Claude Code: misión, contexto, stack,
     exclusiones no negociables, idioma y reglas de version control.
     No reemplaza a AGENTS.md, que es la constitución y manda sobre este archivo. -->

# CLAUDE.md — Knowni

> Guía para Claude Code en este repositorio. **No reemplaza a [`AGENTS.md`](AGENTS.md)** — esa es
> la constitución. Este archivo es la capa específica: contexto, herencia, idioma y estilo.

## Norte — la misión

> *Demuestra que calificas para firmar, sin decir quién eres.*

Sin importar qué se firma. Un arrendamiento, una compraventa, una garantía, un contrato de
suministro, un poder: **el tipo de contrato es un perfil de la solicitud, no una rama del dominio**
(ver `docs/memoria.md` D-14). Cada aplicación elige qué predicados pide y con qué parámetros; ningún
predicado sabe para qué contrato lo están usando.

Cosas que tienen que ser ciertas:

0. **Nada en `core/` sabe qué tipo de contrato se está firmando.** `Purpose` es una cadena abierta validada, no una unión de los contratos que existían cuando se escribió.
1. La contraparte recibe respuestas, nunca datos. Su registro completo de la solicitud cabe en diez
   campos y ninguno dice nada del solicitante más allá de lo que preguntó.
2. La app funciona sin red una vez emitidas las credenciales. La prueba se genera en el teléfono.
3. **Cada respuesta declara qué es y qué no estima.** Un `tier` es una banda descriptiva, no una
   probabilidad de impago, y lo dice. Nunca un número agregado que sustituya el criterio de la
   contraparte.

## Contexto

| Dato | Valor |
|---|---|
| Entrega / deadline | Hackathon Stellar — fecha ⏳ pendiente |
| Jurado / cliente | ⏳ pendiente |
| Criterio de evaluación | ⏳ pendiente |
| Producto | Contract-agnostic: cualquier contrato es un perfil. Ver D-14 |
| Perfil de la demo | **Compraventa de vehículo ante notario** — el único con fuentes reales de punta a punta. Ver D-13 |
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

Trabajo propio anterior, sin dependencia de código entre proyectos.

| De | Qué se reutiliza |
|---|---|
| El proyecto ZK anterior | La primitiva: verificar un reclamo firmado, evaluar un predicado público, divulgar solo el resultado. El puerto de anclaje. La regla `degraded` ≠ `failed` |
| El proyecto GovTech anterior | El cliente de Croma —tope de polls, timeout, `sleep`/`fetch`/`logger` inyectables—, `SourceResult<T>`, el caché, y las decisiones D-09, D-10 y D-11 |
| El prototipo notarial anterior | Mismo dominio en Colombia. El mapa de rutas `/co/*` y sus esquemas de respuesta |
| Notas propias de procedimientos | La regla para elegir nativo vs PWA, y su tabla de costes |

## Referencias

- Constitución → [`AGENTS.md`](AGENTS.md)
- Plan y criterios de aceptación → [`docs/plan.md`](docs/plan.md)
- Enfoque técnico y bitácora → [`docs/memoria.md`](docs/memoria.md)
- Datos verificados y pendientes → [`docs/verificacion.md`](docs/verificacion.md)
- Docs de librerías → <https://context7.com/>
- Docs de Croma → <https://docs.usecroma.com>
- Aprendizajes de este proyecto → [`LEARNINGS.md`](LEARNINGS.md)
