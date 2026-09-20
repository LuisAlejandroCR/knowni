<!-- docs/memoria.md
     Enfoque técnico y bitácora: las decisiones tomadas, su razón y su fecha.
     Se distingue de plan.md, que dice qué se construye y con qué criterios, y de
     BRAINSTORM.md, que razona el producto sin comprometerse a una implementación. -->

# Memoria

El razonamiento va aquí, no en el commit. Un commit de este repositorio es una línea.

## Arquitectura, en una frase por capa

```
core/        reclamos → predicados → sobre. Sin dependencias, sin SDK de cadena
sources/     una fuente oficial → un reclamo mínimo. Adaptador por (país, pregunta)
anchoring/   un compromiso cegado → una cadena. Puerto con registro
circuits/    el mismo predicado, como circuito. Groth16 sobre BLS12-381
contracts/   verificar, aplicar política, marcar gastado
app/         iOS y Android. El proving pasa aquí                        ⏳ pendiente
```

La dirección de dependencias es una sola: `app` y `sources` consumen `core`; `core` no consume a
nadie. Verificado en `core/test/no-vendor-imports.test.ts`.

## Decisiones clave

### 1 — Raíz de Merkle publicada, no firma dentro del circuito · 2026-09-20

`creva-zk` verifica la firma del emisor dentro del circuito. Aquí el emisor publica una raíz sobre
los compromisos emitidos y firma **la raíz**, una vez, fuera.

*Razón:* la verificación de firma es la operación más cara de un circuito de predicado y amarra la
curva embebida del circuito a la llave del emisor. Un camino de Merkle cuesta un hash por nivel y
es indiferente a cómo firme el emisor.

*Efecto secundario que no se buscaba:* la revocación sale gratis — el emisor republica sin la hoja.

*Coste aceptado:* el emisor tiene que publicar algo, y el verificador tiene que saber qué raíz está
vigente. Eso es `register_issuer_root` en el contrato.

### 2 — Groth16 sobre BLS12-381, nunca BN254 · 2026-09-20

*Razón:* es la única curva que Stellar verifica nativamente hoy (CAP-0059, Protocolo 22+). BN254
—el default de Circom, de Noir y de RISC Zero— está bloqueado hasta CAP-0074.

*Hallazgo:* la curva embebida de BLS12-381 es Jubjub, que es sobre la que ya está escrito el
Schnorr de `creva-zk`. El trabajo de Midnight apunta al mismo campo que Stellar verifica. No fue
planeado.

*Modo de falla si se ignora:* todo parece funcionar hasta la llamada al contrato.

### 3 — `ChainId` es cadena abierta validada, no unión cerrada · 2026-09-20

Corrección sobre `creva-zk`, que la tiene cerrada (`"cardano" | "evm"`).

*Razón:* una unión cerrada hace que añadir una cadena sea un cambio en la capa de dominio — justo
el acoplamiento que el puerto existe para evitar.

*Coste aceptado:* el id se valida al registrar en vez de al compilar.

*Detalle:* el id nombra una **red** (`stellar:testnet`), no un protocolo. Un recibo que no dice en
cuál no es auditable.

### 4 — "croma" era Croma, no Chroma · 2026-09-20

La primera versión leyó "croma" como la base vectorial **Chroma** y construyó `retrieval/` sobre
esa lectura. Croma es una **API de datos de gobierno de Latinoamérica** que devuelve JSON tipado
indexado por documento.

*Efecto:* para `personhood` y `standing` no hay nada que desambiguar. La búsqueda difusa resolvía
un problema que la fuente ya resolvió.

*Qué sobrevive:* la política de resolución y la normalización de nombres, porque dos endpoints de
Croma consultan **por nombre** y devuelven varios candidatos.

*Qué se retira:* el adaptador de Chroma, `RecordIndexPort` y el índice en memoria — bloque B3.

*Lección:* un nombre de producto casi homógrafo costó un workspace entero. El origen debía haberse
confirmado antes de diseñar sobre él. Ver [`../LEARNINGS.md`](../LEARNINGS.md).

### 5 — Nativo, no PWA · 2026-09-20

*Razón:* la tesis del producto es que el dato no sale del teléfono, y eso exige proving en el
dispositivo. Un proof server remoto ve el testigo entero.

*Regla aplicada:* `procedures/00_Files/kuira_android_midnight.md` — "se elige nativo cuando el
proving en el dispositivo es la tesis del proyecto".

*Elección:* React Native + Expo con núcleo Rust sobre UniFFI. El dominio ya es TypeScript sin
dependencias y corre en el teléfono sin puerto. Descartes y razones en [`MOBILE.md`](MOBILE.md).

### 6 — La mediana, no la media, para el ingreso · 2026-09-20

*Razón:* una prima o una liquidación arrastra la media y la contraparte termina suscribiendo un año
contra un evento único. El último mes se leería como cero cuando el aporte se radicó tarde.

*Estado:* la fuente que la alimenta (PILA) no está confirmada en Croma — bloque B4.

### 7 — Tests planos en vez de `unit/ fuzz/ invariant/` · 2026-09-20 · **deuda**

La suite actual está en `*/test/*.test.ts`. La constitución pide
`test/unit/ · test/fuzz/ · test/invariant/` con sufijo `.spec.ts`.

*Razón de la desviación:* velocidad de arranque. *No es una decisión, es deuda*, y está anotada en
[`verificacion.md`](verificacion.md).

### 8 — Cabeceras de código largas · 2026-09-20 · **deuda**

La constitución pide 2–3 líneas, `// <filename>: <what this file does>`, sin narrativa. Los archivos
actuales traen cabeceras de 10–30 líneas con justificaciones.

*Razón de la desviación:* se escribieron antes de leer la constitución. El razonamiento de esas
cabeceras pertenece a este archivo; las cabeceras hay que recortarlas. Deuda anotada.

## Bitácora

| Fecha | Qué pasó |
|---|---|
| 2026-09-20 | Arranque. `core`, `sources`, `retrieval`, `anchoring`, `journey`. 111 pruebas. Circuitos y contrato escritos sin compilar |
| 2026-09-20 | Corrección de Croma. Rutas reales tomadas de `Digentia`. Documentada la deuda de `retrieval/` |
| 2026-09-20 | Decisión de móvil: nativo iOS + Android sobre React Native |
| 2026-09-20 | Adoptada la constitución de `procedures/templates/AGENTS.md`: commits de una línea sin trailers, cabeceras en `.md`, reparto por agente |

## Límites de proceso — estado del ejercicio real

La constitución exige que todo lo que cruza un límite de proceso se ejercite contra la cosa real al
menos una vez.

| Límite | Estado |
|---|---|
| Croma REST | ⏳ nunca llamado en vivo desde este repositorio |
| Stellar Horizon / RPC | ⏳ nunca llamado |
| Contrato Soroban | ⏳ nunca compilado ni desplegado |
| Circom / snarkjs | ⏳ nunca compilado |
| Teléfono físico | ⏳ nunca ejecutado |

Ningún número medido aparece en este repositorio.
