<!-- docs/plan.md
     Qué se construye y con qué criterios de aceptación, partido en bloques
     verificables. Se distingue de memoria.md, que guarda el enfoque técnico y la
     bitácora de decisiones, y de ROADMAP.md, que ordena el trabajo por riesgo
     sin criterios de aceptación. -->

# Plan

## Specify

**Para quién:** una persona que quiere arrendar o comprar un inmueble en Colombia y hoy entrega
cédula, certificación laboral, certificación bancaria y desprendibles de nómina para lograrlo.

**Qué cambia:** entrega cuatro respuestas desde su teléfono. La contraparte recibe `true`,
`STRONG`, `true`, `true` — y nada más.

**Cómo se sabe que está terminado:** el recorrido completo corre en un teléfono físico, sin red en
el paso de prueba, y el registro que queda del lado de la contraparte no contiene ningún dato del
solicitante.

## Criterios de aceptación

| # | Criterio | Cómo se verifica |
|---|---|---|
| A1 | El sobre no contiene ningún valor de los reclamos que lo produjeron | `core/test/disclosure.invariant.test.ts` · ✅ pasa |
| A2 | El sobre tiene exactamente los campos permitidos; uno nuevo falla el test | mismo archivo · ✅ pasa |
| A3 | `degraded` y `failed` no se colapsan en ninguna capa | tests de `sources/` y `anchoring/` · ✅ pasa |
| A4 | Ninguna respuesta de fuente cruda sobrevive al adaptador | `sources/test/pila.test.ts` (forma actual) · ⏳ falta la versión Croma |
| A5 | La misma verificación ancla en dos cadenas sin cambiar nada por encima del registro | `anchoring/test/registry.test.ts` · ✅ pasa |
| A6 | Una prueba no se puede reusar en otra sesión ni en otro verificador | `core/test/session.test.ts` · ✅ pasa |
| A7 | Un adaptador que no puede rechazar replays lo declara | `anchoring/test/stellar.test.ts` · ✅ pasa |
| A8 | La app genera una prueba sin red | ⏳ pendiente — necesita B6 y B7 |
| A9 | El circuito y `core/src/predicates.ts` dan el mismo resultado sobre las mismas entradas | ⏳ pendiente — prueba diferencial, necesita B5 |
| A10 | Una llamada en vivo a Croma, con key, registrada con fecha | ⏳ pendiente — B2 |

## Bloques

### B0 — Dominio ✅

`core/`: reclamos, predicados, compromisos, Merkle, vinculación de sesión, sobre de divulgación.
Sin dependencias y sin SDK de ninguna cadena.

*Hecho.* 57 pruebas. Cumple A1, A2, A6.

### B1 — Anclaje agnóstico ✅

`anchoring/`: puerto con registro de cadenas, adaptadores Stellar (`memo` y `contract`) y memoria.

*Hecho.* 15 pruebas. Cumple A5, A7.

### B2 — Fuentes sobre Croma ⏳

Reemplazar el adaptador sintético por el cliente real.

1. Cliente: `POST`, `Bearer`, `Prefer: wait=55`, jobs `202` con poll, reintento en `502`, cabeceras
   de rate limit. Ninguna llamada lanza hacia arriba.
2. Bloque **personhood** — `/co/registraduria/vital-status/v1`.
3. Bloque **standing** — Policía, Procuraduría, Contraloría, Contaduría. Un `SourceResult` por
   fuente; la composición decide.
4. Bloque **capacity** — `/co/sicaac/insolvency-cases/v1`.
5. Validación con esquema y reducción al reclamo mínimo. **Ninguna respuesta cruda sale.**

*Criterio:* A4 y A10. Una llamada en vivo por endpoint, anotada en `verificacion.md` con fecha.

*Bloqueo:* `CROMA_API_KEY` ⏳ pendiente.

### B3 — Retirar `retrieval/` ⏳

Quitar el adaptador de Chroma, `RecordIndexPort` y el índice en memoria. Conservar la normalización
de nombres y la política de resolución, que siguen haciendo falta en las dos consultas por nombre
de Croma (`rama-judicial/cases-by-entity`, `rues/entities-by-name`).

*Criterio:* la suite pasa sin el workspace, y `sources/` no importa nada que ya no exista.

### B4 — Solvencia y formalidad ⏳

Croma no cubre PILA. Antes de codear:

1. Confirmar si Croma expone aportes a seguridad social. *Si sí*, es un bloque más de B2.
2. *Si no*, el camino es un operador de información — acuerdo comercial, fuera del hackathon. El
   adaptador sintético se queda y se **declara como sintético en pantalla**, nunca disimulado.

*Criterio:* la decisión escrita en `memoria.md` con su razón, no un adaptador a medio hacer.

### B5 — Circuito ⏳

1. Parámetros de Poseidon para el campo escalar de BLS12-381.
2. Compilar `merkle.circom` solo. Si sale, el resto sale.
3. Compilar `eligibility.circom`. Registrar el conteo de restricciones.
4. Setup de desarrollo y una prueba.
5. **Prueba diferencial** contra `core/src/predicates.ts`.

*Criterio:* A9.

*Riesgo:* es el único que puede cambiar la arquitectura. Contingencia escrita en `ROADMAP.md`.

### B6 — Prover en el dispositivo ⏳

Núcleo Rust sobre UniFFI, bindings Kotlin y Swift. Generación de testigo y prueba fuera del hilo de
UI, con progreso y cancelación.

*Criterio:* una prueba generada en un teléfono físico, con el tiempo medido y anotado.

### B7 — App ⏳

React Native + Expo, development build. Las seis pantallas de `MOBILE.md`. Llaves en el enclave,
credenciales cifradas, apertura con biometría.

*Criterio:* A8 — una prueba generada en modo avión.

### B8 — Contrato ⏳

Compilar, testear con `testutils`, fijar la llave de verificación en el constructor, asegurar el
orden de señales contra una fixture generada por el circuito, desplegar en testnet.

### B9 — Recorrido en dispositivo ⏳

El recorrido completo en un teléfono físico, grabado.

*Criterio:* el de "terminado" de la sección *Specify*.

## Orden

```
B2 ──► B3 ──► B4
              │
B5 ──► B6 ──► B7 ──► B9
       │             ▲
       └─► B8 ───────┘
```

B2 y B5 son independientes y pueden correr en paralelo — ver el reparto por agente en
[`../AGENTS.md`](../AGENTS.md) → *Varios agentes en paralelo*.
