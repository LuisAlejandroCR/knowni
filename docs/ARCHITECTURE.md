<!-- docs/ARCHITECTURE.md
     Las decisiones técnicas del sistema: las dos formas de confiar en un emisor,
     la coincidencia de curvas, dónde va cada proveedor y el anti-replay.
     Se distingue de MOBILE.md, que baja al cliente, y de memoria.md, que guarda
     la bitácora fechada de esas mismas decisiones. -->

# Arquitectura

## El flujo, completo

```
  EMISIÓN (con consentimiento del sujeto, una vez)
  ─────────────────────────────────────────────────
  Registro público ──► SourcePort ──► Claim ──► commitClaim ──┐
  (por Croma:            (adaptador     (el hecho     (+ sal)  │
   Registraduría,         por pregunta)  mínimo)               │
   Procuraduría, SICAAC)                                       │
                                                                ▼
                                          issueClaimSet ──► árbol de Merkle
                                                                │
                                                     raíz publicada y firmada
                                                                │
  PRUEBA (en el teléfono del sujeto, sin el emisor y sin red)    │
  ──────────────────────────────────────────────────────────────┤
  Claim + sal + camino ──► circuito ──► prueba + señales públicas
                              │
                              └─► predicados evaluados, solo el resultado sale
                                                                │
  VERIFICACIÓN                                                   ▼
  ──────────────────────────────────────────────────────────────────
  Contrato: ¿raíz conocida? ¿nullifier gastado? ¿predicado se cumple?
            └─► verificar emparejamiento ──► marcar gastado ──► anclar
                                                                │
  El arrendador recibe:  Disclosure { 4 respuestas, sessionId, nullifier }
```

## Las dos formas de confiar en un emisor

Es la decisión estructural del repositorio, así que está escrita aquí y no en
un comentario.

**Opción A — firma verificada dentro del circuito.** Es lo que hace
`creva-zk`: el emisor firma la atestación, el sujeto la entrega como testigo,
y el circuito verifica la firma antes de confiar en el reclamo.

- *A favor*: no hay nada que publicar. El emisor firma y desaparece.
- *En contra*: la verificación de firma es la operación más cara que puede
  hacer un circuito de predicado, y **amarra la curva embebida del circuito a
  la llave del emisor**.

**Opción B — raíz de Merkle publicada.** Es lo que hace este repositorio: el
emisor publica una raíz sobre los compromisos que emitió y firma **la raíz**,
una vez, fuera del circuito. El sujeto prueba inclusión.

- *A favor*: un hash por nivel. Indiferente a cómo firma el emisor. La
  revocación sale gratis — el emisor republica sin esa hoja. El tamaño del
  circuito no depende del número de emisores.
- *En contra*: el emisor tiene que publicar algo, y el verificador tiene que
  saber qué raíz es la vigente. Eso es lo que hace `register_issuer_root` en
  el contrato.

**Elegimos B**, y A sigue siendo válida: `creva-zk` la tiene funcionando
sobre Midnight, y `AttestationPort` puede exponer las dos. En un despliegue
donde el emisor se niega a publicar nada, A es la respuesta.

## La coincidencia de curvas

Esto merece su propia sección porque decide el cronograma.

| | Curva de prueba | Curva embebida | Verificación nativa en Stellar |
|---|---|---|---|
| Midnight / Compact | BLS12-381 | **Jubjub** | — |
| Circom, default | BN254 | BabyJubjub | **No** — bloqueado en CAP-0074 |
| Circom `-p bls12381` | BLS12-381 | **Jubjub** | **Sí** — CAP-0059, Protocolo 22+ |
| Noir / Barretenberg | BN254 | — | No |
| RISC Zero → Groth16 | BN254 | — | No |

El Schnorr sobre Jubjub de `creva-zk` está escrito sobre la curva embebida de
BLS12-381. Stellar verifica BLS12-381 nativamente hoy. **Es el mismo campo.**

El hueco que queda no es de curva, es de biblioteca: `circomlib` trae
constantes de Poseidon para BN254. Ver `circuits/README.md`.

## El contrato es un perfil

La capa de dominio no sabe qué es un arriendo, y esa es la diferencia entre un producto y una
aplicación de ese producto.

Un **perfil** es lo que compone quien pregunta: qué predicados pide, con qué parámetros públicos, y
bajo qué `purpose`. Vive del lado de la contraparte, no en `core/`.

```
  Perfil "vehicle-sale"           Perfil "lease"
  ─────────────────────           ──────────────
  personhood   { jurisdiction }   personhood  { jurisdiction }
  capacity     { … }              solvency    { monthlyObligationMinor, currency }
  sanctions    { … }              formality   { maxMonthsSince… }
  assetStanding{ plate }          sanctions   { … }
        │                               │
        └──────────► VerificationRequest ◄──────────┘
                            │
                     core/src/verify.ts
                  (no sabe cuál de los dos es)
```

`Purpose` es una cadena abierta validada por la misma razón que `ChainId`: una unión cerrada haría
que añadir un tipo de contrato sea un cambio en el dominio. El formato se restringe —minúsculas,
guiones, ≤64— porque el propósito se hashea en el `sessionId` **y se le muestra al sujeto antes de
que responda**. Un valor que no puede leer es una pregunta que no puede rechazar.

Y porque entra en el `sessionId`, un mismo juego de credenciales **no** produce la misma prueba para
dos contratos: una prueba obtenida para arrendar no verifica contra una sesión de compraventa.

## Dónde se consulta

La frontera principal del producto, y es una regla sobre **quién llama**, no sobre tipos.

| Momento | ¿Se consulta una fuente? |
|---|---|
| **Emisión** — el sujeto, o una fuente bajo su autorización | Sí. El resultado se vuelve un reclamo, se compromete y entra en la raíz publicada |
| **Verificación** — la contraparte | **Nunca.** Recibe un sobre |

Una consulta lleva en claro lo que busca. Da igual si el motor es una API tipada o una búsqueda
semántica: si la corre la contraparte, la inmobiliaria termina con el expediente que los predicados
reemplazaban. Una `CROMA_API_KEY` en el dispositivo del arrendador convertiría el producto en un
buscador de personas con un paso extra.

No hay camino de código de una sesión de verificación a una consulta, y añadirlo no es una
optimización: es el cambio que colapsa el producto.

## Dónde va cada vendor

Ningún workspace fuera de `*/adapters/` importa un SDK. No es una convención
de estilo — es lo que hace que el adaptador sea reemplazable.

| Vendor | Puerto | Adaptadores hoy | Por qué importa |
|---|---|---|---|
| Stellar | `AnchoringPort` | `memo`, `contract`, `memory` | Un banco pedirá su propia cadena |
| [Croma](https://docs.usecroma.com) | `SourcePort` | ⏳ pendiente (B2), sintético | Es un proveedor, no la fuente: detrás de él están Registraduría, Procuraduría, SICAAC. Si mañana hay acceso directo a una, entra como otro adaptador |
| PILA | `SourcePort` | sintético | Croma no la cubre. Cada país trae su operador |
| Groth16 | (pendiente) `ProverPort` | — | Ver [`ROADMAP.md`](ROADMAP.md) |

`core/test/no-vendor-imports.test.ts` lo verifica sobre `core/`, que es donde
más dolería.

## Por qué `ChainId` es una cadena abierta

`creva-zk` usa `type ChainId = "cardano" | "evm"`. Aquí es `string`, validada
al registrar.

Una unión cerrada hace que **añadir una cadena sea un cambio en la capa de
dominio** — exactamente el acoplamiento que el puerto existe para evitar.
El costo es que un error de tipeo se atrapa al registrar y no al compilar,
así que el registro valida el formato.

El id nombra una **red**, no un protocolo: `stellar:testnet` y
`stellar:pubnet` no son evidencia intercambiable, y un recibo que no dice
cuál no es auditable.

## Los dos compromisos, y por qué no se tocan

| | `commitClaim` | `commitOutcome` |
|---|---|---|
| Sobre qué | un reclamo + sal | un resultado + factor de cegado |
| Para qué | ser hoja del árbol del emisor | ser lo único que llega a una cadena |
| Quién lo ve | nadie fuera del dispositivo | cualquiera que mire la cadena |

No hay función que convierta un reclamo en algo anclable. Está forzado por
los tipos: `commitOutcome` recibe un `Outcome`, y no existe ninguna función
que produzca un `Outcome` desde los campos de un `Claim`.

## Anti-replay: las dos mitades

Un Groth16 es un archivo portable. Sin lo de abajo, la prueba que el
arrendatario le dio a una agencia es una prueba que esa agencia le presenta a
otro arrendador como si fuera de su propio solicitante.

**`sessionId`** — quién pregunta, para qué, y hasta cuándo. Entra como señal
pública, así que una prueba construida para una sesión no verifica contra
ninguna otra. El `purpose` va adentro: una prueba obtenida para arrendar no
se puede presentar para abrir un cupo de crédito.

**`nullifier`** — derivado del secreto del sujeto **y** del `sessionId`. El
contrato lo guarda y rechaza una segunda prueba. Que el `sessionId` esté
mezclado es lo que hace que los nullifiers que un sujeto deja en dos
arrendadores **no se puedan enlazar** — la propiedad que un esquema ingenuo
de "un nullifier por persona" destruye.

## `degraded` no es `failed`

Heredado de `creva-zk` literalmente, porque la distinción es la misma:

- **`failed`** — el predicado no se cumple. Es una respuesta, y es "no".
- **`degraded`** — nadie pudo verificar. El registro está caído, la consulta
  expiró. No es una respuesta.

Renderizar `degraded` como `failed` le dice a alguien que no califica cuando
en realidad no se evaluó nada. En el sobre eso es `PredicateResult =
boolean | "unavailable"`, y `meetsAll` no cuenta `"unavailable"` como
aprobado — pero tampoco como rechazo del que haya que informar al sujeto.
