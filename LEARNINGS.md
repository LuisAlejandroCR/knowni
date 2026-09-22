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
  el Schnorr del proyecto ZK anterior para Midnight. Stellar verifica BLS12-381 nativamente desde CAP-0059
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
  estima. El proyecto GovTech anterior ya lo tenía; yo había escrito "nunca un puntaje" como si fuera un principio,
  cuando el principio real es *un resultado que no dice qué es, se lee como una predicción*.
- `2026-09-20` — La diferencia entre "inhabilidad legal vigente" y "antecedente penal" no es de
  grado y decide si un producto de vivienda es justo. La primera es una restricción actual sobre la
  capacidad de contratar; la segunda es un castigo adicional que nadie impuso.

- `2026-09-20` — Un catálogo de fuentes oficiales no es neutral. El de Croma para Colombia trae
  `DNP Social Classification (Sisbén IV)` junto a Registraduría y RUNT, con el mismo aspecto y la
  misma facilidad de llamada. Lo que decide si un producto discrimina no es qué puede consultar,
  sino qué decide no consultar — y eso hay que escribirlo antes de tener la key, no después.
- `2026-09-20` — Un predicado puede filtrar por la puerta de atrás. ADRES responde formalidad, pero
  distingue régimen contributivo de subsidiado; devolver `false` ahí es publicar una inferencia de
  pobreza en un booleano. La regla asimétrica —`true` o `unavailable`, nunca `false`— es lo que lo
  evita, y solo se ve si uno se pregunta *qué se lee* en el `false`, no solo qué significa.

- `2026-09-20` — El caso de uso con el que uno arranca se cuela en la definición del producto si no
  se vigila. Escribí la misión como *"arrendar o comprar un inmueble"* y el dominio acabó con
  `type Purpose = "lease" | "purchase" | …` — la capa que no puede saber qué es un arriendo,
  sabiéndolo. El producto es *demuestra que calificas para firmar*; el contrato es un perfil.

## 2. ¿Qué costó más de lo esperado, y por qué?

- `2026-09-20` — Un workspace entero (`retrieval/`) construido sobre la lectura equivocada de
  "croma". **Causa:** se diseñó sobre un nombre casi homógrafo sin confirmar el origen —
  `usecroma.com` es una API de datos de gobierno, no la base vectorial Chroma. El enlace estaba
  disponible desde el principio y no se pidió. Coste: un puerto, dos adaptadores y 26 pruebas que
  hay que retirar.
- `2026-09-20` — Las cabeceras de código salieron de 10–30 líneas con narrativa. **Causa:** se
  escribió el código antes de leer `procedures/templates/AGENTS.md`, que pide 2–3 líneas sin
  justificaciones. El arranque de la constitución existe justo para eso y se saltó.
- `2026-09-20` — Atribuí el trabajo previo de Croma al proyecto equivocado. **Causa:** lo deduje de
  una fila de `HARVEST.md` en vez de abrir los dos repositorios. Coste real: no el crédito, sino que
  me perdí las **decisiones de producto ya publicadas** en el proyecto correcto —sin antecedentes
  penales, el resultado se declara a sí mismo, medir cobertura antes de puntuar— y escribí
  exclusiones que las contradecían.

## 3. ¿Qué se decidió, y por qué?

| Fecha | Decisión | Alternativa descartada | Motivo |
|---|---|---|---|
| `2026-09-20` | Raíz de Merkle publicada | Firma dentro del circuito (como el proyecto ZK anterior) | Un hash por nivel contra el gadget más caro del circuito; revocación gratis |
| `2026-09-20` | Groth16 sobre BLS12-381 | BN254 (default de Circom) | Es lo único que Stellar verifica hoy; BN254 espera a CAP-0074 |
| `2026-09-20` | `ChainId` abierto y validado | Unión cerrada | Una unión cerrada hace que añadir una cadena sea un cambio en el dominio |
| `2026-09-20` | Nativo iOS + Android (React Native + núcleo Rust) | PWA instalable | El proving en el dispositivo **es** la tesis; la PWA vacía el producto |
| `2026-09-20` | React Native | Flutter, Kotlin Multiplatform, nativo dos veces | El dominio ya es TypeScript sin dependencias y corre en el teléfono sin puerto |
| `2026-09-20` | Mediana de 12 meses para el ingreso | Media, o último mes | La media la arrastra una prima; el último mes se lee como cero si se radicó tarde |
| `2026-09-20` | Sin número agregado **en este producto**, y cada respuesta declara qué no estima | Un score sin declaración | Un resultado que no dice qué es se lee como predicción. El proyecto GovTech anterior emite puntaje y hace bien: son productos distintos |
| `2026-09-20` | Sin antecedentes penales, de nadie | Incluirlos en `standing` | No dicen si alguien puede pagar un arriendo; como filtro de vivienda castigan a quien ya cumplió. Decisión firme heredada del proyecto GovTech anterior |
| `2026-09-20` | `Purpose` abierto y validado; el contrato es un perfil que compone quien pregunta | Unión cerrada de tipos de contrato | Una unión cerrada hace que añadir un contrato sea un cambio en el dominio — el mismo error que `ChainId`, dos veces |
| `2026-09-20` | Sisbén nunca, y ADRES solo en la dirección positiva | Usar la clasificación socioeconómica, o devolver `false` por régimen subsidiado | Sería un filtro de pobreza con sello oficial, entregado listo |
| `2026-09-20` | La demo es compraventa de vehículo, no arrendamiento | Arrendamiento con `solvency` sintética | Sin PILA, `solvency` no tiene fuente; vehículo cierra con fuentes reales de punta a punta |
| `2026-09-20` | Medir la cobertura de una fuente antes de dejarla influir en un resultado | Suponer que una fuente oficial es neutral | Una fuente de cobertura desigual que puntúa es un sesgo con respaldo oficial |

## 4. ¿Qué se volvería a hacer igual?

- El invariante de divulgación como **test sobre el sobre serializado**, no como forma del tipo. Un
  campo nuevo falla antes de poder llenarse con algo revelador.
- Adaptadores escritos contra una interfaz mínima propia en vez de contra el SDK del proveedor. Es
  lo que permitió probar Stellar y Croma sin red y sin key.
- Separar `degraded` de `failed` desde la primera línea. Heredado del proyecto ZK anterior; ya son dos
  proyectos seguidos y no ha fallado una vez.
- `2026-09-22` — Derivar claves de idempotencia desde todos los campos que cambian una respuesta,
  pero guardar solo un HMAC. Un identificador público de pago puede omitir al sujeto precisamente
  por privacidad; reutilizarlo como clave interna habría mezclado respuestas de personas distintas.

## 5. ¿Qué no se volvería a hacer?

- Dejar que el primer caso de uso escriba la definición del producto. Se cuela hasta el tipo de un
  campo, y ahí ya es una unión cerrada en el dominio.
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
- [ ] `Lo que decide si un producto discrimina no es qué puede consultar, sino qué decide no
      consultar — escrito antes de tener la credencial` → tema propuesto: `catalogues-are-not-neutral`
- [ ] `Preguntarse qué se LEE en un false, no solo qué significa: un negativo puede publicar una
      inferencia que nadie pidió` → tema propuesto: `what-a-false-reads-as`
- [ ] `El caso de uso con el que se arranca se cuela en la definición del producto y termina como
      una unión cerrada en el dominio` → tema propuesto: `first-use-case-leaks-into-the-domain`
- [ ] `Una clave pública útil para pago no necesariamente identifica una operación idempotente;
      derivar la clave interna completa y no reversible` → tema propuesto: `idempotency-keys-are-private`

## Verify

- Cada viñeta lleva fecha: PASS
- Cada causa es una causa, no un síntoma: PASS
- Ninguna viñeta contiene el valor de una key o un secreto: SÍ
- Lo marcado como "listo para destilar" existe en `procedures/knowledge/`: FAIL — pendiente de
  anonimizar y subir

- **Meter un monorepo sin dependencias dentro de Expo cuesta cuatro ajustes, y todos se descubren
  igual: el bundler falla, o la app arranca y avisa tarde.** (1) Metro no lee los `paths` de
  tsconfig: un paquete propio no instalado desde el registro necesita `watchFolders`,
  `resolver.extraNodeModules` y `nodeModulesPaths` apuntando a `app/node_modules`, o el código de
  fuera de `app/` no encuentra `@babel/runtime`. (2) `expo-crypto` no se puede importar bajo
  `node --test`, porque arrastra `expo-modules-core`, que es TypeScript dentro de `node_modules`:
  la binding nativa va en un archivo aparte para que la criptografía siga siendo comprobable en
  Node. (3) La base de tsconfig de Expo acota `types`, así que unas pruebas con `node:test`
  necesitan `"types": ["node", "react"]` escrito a mano. (4) Subir de SDK con `npm install` deja el
  árbol a medias y `ERESOLVE` se vuelve indescifrable: se sube con `npx expo install --fix`, se
  borran `node_modules` y el lock, y se cierra con `npx expo-doctor` en verde —21/21 en SDK 57—
  antes de dar la app por buena. Comprobado el 2026-09-20 sobre expo 52 y el 2026-09-21 sobre
  expo 57.0.24, expo-router 57.0.22, react-native 0.86.3 y react 19.2.3.
