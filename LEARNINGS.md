<!-- LEARNINGS.md: la respuesta de este proyecto a una sola pregunta fija. -->
<!-- Plantilla: procedures/templates/LEARNINGS.md · Procedimiento: procedures/00_Files/project_learnings.md -->

# ¿Qué aprendí con este proyecto?

> Este archivo se llena mientras el proyecto vive, no el día que muere. Una línea el día que algo
> cuesta caro vale más que una retro de una hora seis meses después.

**Proyecto:** `knowni`
**Arrancó:** `2026-09-20` · **Última actividad:** `2026-09-20` · **Estado:** ⏳ activo
**Forma:** en curso
**Fecha límite:** `—` (hackathon Stellar, fecha ⏳ pendiente)
**Alias calendario:** `—`
**URL:** —
**Última actualización de este archivo:** `2026-09-20`

---

## 0. Qué es este proyecto

Verificación de persona por predicados para arrendamiento y compraventa de inmuebles. La contraparte
recibe cuatro respuestas —existe, le alcanza, cotiza, está limpio— en vez de cédula, nómina y
extractos. App de iOS y Android; la prueba se genera en el teléfono. Colombia primero, diseño
regional. La restricción que lo define: **el dato no sale del dispositivo**, y eso obliga a proving
nativo y prohíbe cualquier atajo de servidor.

## 1. ¿Qué aprendí que no sabía antes de empezarlo?

- `2026-09-20` — La curva embebida de BLS12-381 es **Jubjub**, la misma sobre la que estaba escrito
  el Schnorr de `creva-zk` para Midnight. Stellar verifica BLS12-381 nativamente desde CAP-0059
  (Protocolo 22+). No es portar entre ecosistemas: es el mismo emparejamiento. Elegir la curva es la
  decisión que separa demo de producto, y estaba tomada sin saberlo.
- `2026-09-20` — La verificación de firma dentro del circuito no es obligatoria para confiar en un
  emisor. Publicar una raíz de Merkle y firmarla **fuera** cuesta un hash por nivel, es indiferente
  a cómo firme el emisor, y regala la revocación.
- `2026-09-20` — `enum` de TypeScript es la única sintaxis que emite código en tiempo de ejecución,
  así que el *type stripping* nativo de Node 22 la rechaza. Un objeto `as const` más un tipo del
  mismo nombre da lo mismo y permite un repositorio **sin paso de compilación y sin dependencias**.
- `2026-09-20` — Una búsqueda vectorial sobre registros públicos **no es una operación de
  conocimiento cero**: la consulta lleva en claro lo que busca. Si la corre la contraparte, el
  producto se convierte en un buscador de personas con un paso extra. La frontera no es técnica, es
  sobre *quién llama*.

- `2026-09-20` — Un resultado se puede declarar a sí mismo, y eso es lo que separa un puntaje
  defendible de una central de riesgo: `kind: 'descriptive'` más una lista explícita de lo que **no**
  estima. `creva_score` ya lo tenía; yo había escrito "nunca un puntaje" como si fuera un principio,
  cuando el principio real es *un resultado que no dice qué es, se lee como una predicción*.
- `2026-09-20` — La diferencia entre "inhabilidad legal vigente" y "antecedente penal" no es de
  grado y decide si un producto de vivienda es justo. La primera es una restricción actual sobre la
  capacidad de contratar; la segunda es un castigo adicional que nadie impuso.

## 2. ¿Qué costó más de lo esperado, y por qué?

- `2026-09-20` — Un workspace entero (`retrieval/`) construido sobre la lectura equivocada de
  "croma". **Causa:** se diseñó sobre un nombre casi homógrafo sin confirmar el origen —
  `usecroma.com` es una API de datos de gobierno, no la base vectorial Chroma. El enlace estaba
  disponible desde el principio y no se pidió. Coste: un puerto, dos adaptadores y 26 pruebas que
  hay que retirar.
- `2026-09-20` — Las cabeceras de código salieron de 10–30 líneas con narrativa. **Causa:** se
  escribió el código antes de leer `procedures/templates/AGENTS.md`, que pide 2–3 líneas sin
  justificaciones. El arranque de la constitución existe justo para eso y se saltó.
- `2026-09-20` — Atribuí el trabajo previo de Croma al repo equivocado: `Digentia` en vez de
  `creva_score`. **Causa:** lo deduje de una fila de `HARVEST.md` en vez de abrir los dos
  repositorios. Coste real: no el crédito, sino que me perdí las **decisiones de producto
  publicadas** de `creva_score` —sin antecedentes penales, el resultado se declara a sí mismo,
  medir cobertura antes de puntuar— y escribí exclusiones que las contradecían.

## 3. ¿Qué se decidió, y por qué?

| Fecha | Decisión | Alternativa descartada | Motivo |
|---|---|---|---|
| `2026-09-20` | Raíz de Merkle publicada | Firma dentro del circuito (como `creva-zk`) | Un hash por nivel contra el gadget más caro del circuito; revocación gratis |
| `2026-09-20` | Groth16 sobre BLS12-381 | BN254 (default de Circom) | Es lo único que Stellar verifica hoy; BN254 espera a CAP-0074 |
| `2026-09-20` | `ChainId` abierto y validado | Unión cerrada | Una unión cerrada hace que añadir una cadena sea un cambio en el dominio |
| `2026-09-20` | Nativo iOS + Android (React Native + núcleo Rust) | PWA instalable | El proving en el dispositivo **es** la tesis; la PWA vacía el producto |
| `2026-09-20` | React Native | Flutter, Kotlin Multiplatform, nativo dos veces | El dominio ya es TypeScript sin dependencias y corre en el teléfono sin puerto |
| `2026-09-20` | Mediana de 12 meses para el ingreso | Media, o último mes | La media la arrastra una prima; el último mes se lee como cero si se radicó tarde |
| `2026-09-20` | Sin número agregado **en este producto**, y cada respuesta declara qué no estima | Un score sin declaración | Un resultado que no dice qué es se lee como predicción. `creva_score` emite puntaje y hace bien: son productos distintos |
| `2026-09-20` | Sin antecedentes penales, de nadie | Incluirlos en `standing` | No dicen si alguien puede pagar un arriendo; como filtro de vivienda castigan a quien ya cumplió. Decisión firme heredada de `creva_score` |
| `2026-09-20` | Medir la cobertura de una fuente antes de dejarla influir en un resultado | Suponer que una fuente oficial es neutral | Una fuente de cobertura desigual que puntúa es un sesgo con respaldo oficial |

## 4. ¿Qué se volvería a hacer igual?

- El invariante de divulgación como **test sobre el sobre serializado**, no como forma del tipo. Un
  campo nuevo falla antes de poder llenarse con algo revelador.
- Adaptadores escritos contra una interfaz mínima propia en vez de contra el SDK del proveedor. Es
  lo que permitió probar Stellar y Croma sin red y sin key.
- Separar `degraded` de `failed` desde la primera línea. Heredado de `creva-zk`; ya son dos
  proyectos seguidos y no ha fallado una vez.

## 5. ¿Qué no se volvería a hacer?

- Diseñar sobre un nombre de herramienta sin abrir su documentación primero. Costó un workspace.
- Escribir código antes de leer la constitución del proyecto, teniéndola a un `cat` de distancia.
- Deducir de qué proyecto viene un trabajo previo en vez de abrir los repositorios. Lo caro no fue
  la atribución: fueron las decisiones de producto ya tomadas que contradije sin saberlo.

---

## Listas para destilar

- [ ] `degraded ≠ failed: "no calificas" y "no se pudo consultar" son respuestas distintas y no se
      colapsan en ninguna capa` → tema propuesto: `degraded-vs-failed`
- [ ] `El id de un adaptador nombra la red, no el protocolo: stellar:testnet, no stellar. Un recibo
      que no dice en cuál no es auditable` → tema propuesto: `adapter-ids-name-the-network`
- [ ] `Una búsqueda sobre datos ajenos pertenece al momento de emisión con consentimiento, nunca al
      momento de verificación` → tema propuesto: `query-at-issuance-not-verification`
- [ ] `Un resultado declara qué es y qué no estima; si no lo dice, se lee como predicción`
      → tema propuesto: `results-declare-themselves`
- [ ] `Medir a quién cubre una fuente antes de dejarla influir en un resultado`
      → tema propuesto: `measure-coverage-before-scoring`

## Verify

- Cada viñeta lleva fecha: PASS
- Cada causa es una causa, no un síntoma: PASS
- Ninguna viñeta contiene el valor de una key o un secreto: SÍ
- Lo marcado como "listo para destilar" existe en `procedures/knowledge/`: FAIL — pendiente de
  anonimizar y subir
