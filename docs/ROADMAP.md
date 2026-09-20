<!-- docs/ROADMAP.md
     El trabajo pendiente ordenado por riesgo: qué puede resultar imposible y qué
     solo es trabajo. Se distingue de plan.md, que parte lo mismo en bloques con
     criterios de aceptación; aquí el porqué del orden, allá el qué y el cómo. -->

# Roadmap

Los bloques y sus criterios de aceptación viven en [`plan.md`](plan.md). Este archivo dice **en qué
orden** y **por qué ese orden**: primero lo que puede resultar imposible, después lo que solo es
trabajo.

## Los dos riesgos que pueden cambiar la arquitectura

### 1 — ¿Existe una vía de consulta de PILA?

Ya no es *"¿Croma cubre PILA?"*: el catálogo lo respondió, y **no la cubre**. Tampoco SNR. Lo que
queda abierto es peor, y es una pregunta antes que una negociación.

La fuente primaria —el ABECÉ de PILA del Ministerio de Salud, junio de 2018— describe cómo un
aportante **liquida y paga** a través de un operador de información. **No establece ningún servicio
por el que un tercero, ni el propio titular, consulte su historial de aportes**, ni con qué
consentimiento ni con qué retención. Hasta hoy este repositorio planeaba "PILA vía operador" como
un acuerdo comercial pendiente; puede que ni siquiera sea eso. Ver `memoria.md` D-15.

Así que el orden es: **confirmar que la vía existe** → si existe, negociar acceso → si no,
`solvency` y `formality` se quedan sintéticos, **declarados como sintéticos en pantalla** y nunca
disimulados, y el perfil de la demo se apoya en `personhood`, `sanctions`, `capacity` y
`assetStanding`, que sí son reales.

**SNR** es más simple: no está en Croma, es pago por consulta y sin convenio. Decide si
`propertyStanding` sobre inmueble entra en alcance.

Va primero porque es barato de responder y porque todo lo demás se planifica distinto según la
respuesta.

### 2 — Poseidon sobre BLS12-381

El único riesgo técnico que puede cambiar la arquitectura. `circomlib` trae constantes de Poseidon
para BN254; para `-p bls12381` hacen falta parámetros de ese campo. Compilar con el `bn128` por
defecto produce pruebas que **no** se verifican en Stellar hasta CAP-0074, y el modo de falla es
cruel: todo parece funcionar hasta la llamada al contrato.

Empezar por `merkle.circom` solo. Si sale, el resto sale.

**Contingencia, si no sale a tiempo:** camino atestado — un verificador off-chain corre la
verificación y firma una atestación; el contrato hace `require_auth` del atestador y aplica
política. Hay que decir lo que es: **no es ZK sin confianza**, es un oráculo de cómputo verificable,
y el supuesto va escrito en el `README.md`, no en una nota al pie.

## Lo que solo es trabajo

| Orden | Qué | Depende de |
|---|---|---|
| 3 | Cliente y bloques de Croma (B2) | la key |
| 4 | Retirar `retrieval/` (B3) | B2 |
| 5 | Unificar el hash: `core/` usa sha256, el circuito necesita Poseidon | riesgo 2 |
| 6 | Prover en el dispositivo (B6) | riesgo 2 |
| 7 | Compilar y desplegar el contrato (B8) | riesgo 2 |
| 8 | App (B7) | B6 |
| 9 | Recorrido en teléfono físico (B9) | B7, B8 |

El paso 5 es la razón por la que existe `FieldHash` y por la que nadie llama a `node:crypto`
directamente: es un cambio de una implementación, no una cacería por el código.

## Se puede paralelizar

`B2 → B3 → B4` y `riesgo 2 → B5 → B6/B8` son independientes. El reparto por agente, con la regla de
que el límite es el puerto, está en [`../AGENTS.md`](../AGENTS.md) → *Varios agentes en paralelo*.

## Lo que se decide después del hackathon

- **`propertyStanding`** — el predicado sobre el inmueble. Probablemente el más valioso del
  catálogo: hoy el arrendatario prueba todo y el arrendador nada.
- **Segunda jurisdicción.** Croma ya cubre Perú y México, así que el coste es un adaptador y un
  catálogo de endpoints por país, no una integración nueva.
- **Segunda cadena**, para ejercitar el puerto contra algo que no sea Stellar.
- **La deuda de `verificacion.md`**: tests planos y cabeceras de código largas.
