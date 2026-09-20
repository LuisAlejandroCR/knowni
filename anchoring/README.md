<!-- anchoring/README.md
     Qué vive en @knowni/anchoring: el puerto agnóstico de cadena y sus
     adaptadores. Se distingue de contracts/knowni-verifier/, que es el contrato
     on-chain al que apunta uno de ellos. -->

# `@knowni/anchoring`

El puerto de anclaje y sus adaptadores. Stellar es uno de ellos.

Lo único que llega a una cadena es un **compromiso cegado** a un resultado:
nunca el resultado, nunca una referencia al sujeto, nunca un reclamo.
`commitOutcome` en `@knowni/core` es su único constructor, y no existe
función que convierta un reclamo en algo anclable.

## Los dos caminos de Stellar

| | `memo` | `contract` |
|---|---|---|
| Qué es | pago a sí mismo con `MEMO_HASH` | invocación Soroban |
| Costo | ~0.00001 XLM | más, y hay que desplegar |
| Rechaza replay | **No** | **Sí** |
| Cuándo | la demo corre hoy en testnet sin desplegar nada | el producto |

Un adaptador que no puede rechazar un replay lo **dice**
(`replayGuarded: false`), para que el verificador sepa que tiene que llevar
su propio conjunto de gastados. Reportar `true` ahí sería la clase silenciosa
de error.

## `ChainId` abierto

Es una cadena validada al registrar, no una unión cerrada: una unión cerrada
haría que **añadir una cadena sea un cambio en la capa de dominio**, que es
justo el acoplamiento que el puerto existe para evitar. Y nombra una **red**
(`stellar:testnet`), porque un recibo que no dice en cuál no es auditable.
