<!-- docs/MOBILE.md
     La app de iOS y Android: por qué nativo y no PWA, el stack elegido y los que
     se descartaron, dónde viven las llaves y las credenciales, y el flujo de
     pantallas. Se distingue de ARCHITECTURE.md, que describe el sistema entero
     sin suponer un cliente. -->

# La app — iOS y Android

## La tesis decide la plataforma

una nota propia de procedimientos deja escrita la regla, y aquí aplica sin matices:

> **Se elige nativo cuando el proving en el dispositivo es la tesis del proyecto.** Si la tesis es
> otra —que el dato no viaja, que la contraparte verifica sin creer— la PWA la demuestra igual.

Para Knowni el proving en el dispositivo **es** la tesis. La promesa del producto no es "no
compartimos tus datos"; es que **el dato nunca sale del teléfono**. Un proof server remoto ve el
testigo: ve el IBC, ve el estado de la cédula, ve el resultado del screening. Si la prueba se genera
allá, el producto se reduce a una promesa contractual, que es exactamente lo que ya existe y no
funciona.

Lo demás se sigue de ahí.

## Lo que se descartó, con su razón

| Descartado | Razón |
|---|---|
| **PWA instalable** | Sin proving en el dispositivo, sin enclave seguro, sin passkey. Es el camino barato y correcto para *otra* tesis; para esta vacía el producto |
| **Nativo dos veces (Swift + Kotlin)** | Dos implementaciones de la misma lógica de predicados es dos veces la superficie donde pueden divergir. La divergencia entre plataformas en un predicado es un fallo de seguridad, no un bug de UI |
| **Un SDK nativo de ZK para Android** | Resuelve exactamente el trío que hace falta —proving en dispositivo, identidad por passkey, wallet embebida— pero es **solo Android** y va atado a una sola cadena. Queda como referencia de diseño, no como dependencia |
| **Flutter** | Viable por FFI al mismo núcleo Rust. Se descarta porque el dominio ya está en TypeScript y correría sin tocarlo en React Native; con Flutter habría que portarlo o exponerlo por FFI también |

Un descarte sin razón se vuelve a discutir a las 3 de la mañana. Por eso están escritos.

## El stack

| Capa | Elección | Por qué |
|---|---|---|
| UI y navegación | **React Native + Expo** | Una interfaz, dos tiendas |
| Dominio | **`@knowni/core` tal cual** | Ya es TypeScript sin dependencias y sin `node:` en los predicados. Corre en el teléfono sin puerto |
| Prover | **Núcleo Rust sobre UniFFI** | Una implementación, bindings a Kotlin y Swift generados. Groth16 en JS sobre móvil no es una opción de rendimiento |
| Llaves | **Secure Enclave (iOS) · StrongBox Keystore (Android)** | La llave no se exporta, ni siquiera a la app |
| Credenciales | Almacén cifrado en disco, llave en el enclave, apertura con biometría | |
| Red | Solo en emisión y en anclaje. La prueba no la necesita | |

Expo Go no basta: hay módulos nativos, así que el camino es **development build + EAS Build**. Es
una decisión de arranque, no un detalle: empezar en Expo Go y descubrirlo al integrar el prover
cuesta un día.

## Dónde vive cada secreto

Tres cosas distintas, en tres sitios distintos, y confundirlas es el fallo clásico:

| Qué | Dónde | Si se pierde |
|---|---|---|
| `subjectSecret` — deriva el nullifier | **Enclave**, no exportable, generado en el dispositivo | Se pierde la continuidad: los nullifiers cambian. No se pierde nada verificado |
| Sales y caminos de Merkle de cada credencial | Almacén cifrado, llave en el enclave | Hay que re-emitir. El emisor puede, la raíz no cambia |
| Factores de cegado de anclajes pasados | Almacén cifrado, **con respaldo** | **Se pierde la capacidad de abrir un anclaje ante un juez.** Es el único que necesita respaldo, y es el que más fácil se olvida |

El respaldo del tercero es una decisión de producto abierta: frase de recuperación, respaldo en el
llavero del sistema, o custodia opcional. Las tres tienen costes distintos y ninguna es obvia.

## El flujo, en pantallas

```
  1. ALTA                 2. EMISIÓN                3. SOLICITUD
  ───────────             ──────────                ────────────
  Passkey + biometría     "Autorizo consultar:      Llega por QR o deep link.
  Se genera el secreto     · Registraduría          La pantalla muestra QUIÉN
  en el enclave.           · Antecedentes           pregunta, PARA QUÉ, y cada
  Sin frase semilla.       · Insolvencia"           predicado por separado.
                          Se consulta, se
                          compromete, llega la
                          raíz del emisor.
                                                            │
  6. RESPALDO             5. ANCLAJE                4. APROBACIÓN
  ──────────              ──────────                ─────────────
  Los factores de         Compromiso cegado a       Se puede aprobar predicado
  cegado, si el           Stellar. Opcional:        por predicado. Negar uno no
  usuario quiere          sin red, la respuesta     cancela los demás.
  poder abrir un          igual se entregó.         La prueba se genera aquí,
  anclaje después.                                  en el teléfono.
```

Lo que casi ninguna app de este tipo hace bien, y aquí es requisito:

1. **La pregunta antes de la respuesta.** El sujeto lee quién pregunta y qué, y puede negarse por
   predicado. Un botón único de "aceptar todo" es el patrón que convierte el consentimiento en
   trámite.
2. **`unavailable` no es `false`.** Son dos pantallas distintas: una dice *espera*, la otra dice
   *no*. Colapsarlas le dice a alguien que no califica cuando no se evaluó nada.
3. **La revisión humana es visible.** Un `ambiguous` en una consulta por nombre es una persona
   esperando, no un spinner indefinido.
4. **Nunca se pide una foto de la cédula.** Es el artefacto que el producto existe para eliminar;
   pedirlo "solo para el alta" lo reintroduce entero.

## Sin red

Una vez emitidas las credenciales y publicada la raíz, **probar no necesita red**. Ni el emisor ni
la fuente están en el camino. Eso no es una optimización: en el mercado objetivo el teléfono tiene
datos intermitentes, y una verificación que falla en la puerta de un apartamento porque no hay señal
es una verificación que no existe.

Lo que sí necesita red: la emisión (una vez) y el anclaje (opcional, y degrada).

## Rendimiento — qué se sabe y qué no

**No hay ninguna medición.** Ninguna cifra de tiempo de prueba aparece en este repositorio, y no
aparecerá hasta que exista un circuito compilado corriendo en un teléfono real.

Lo que se puede decir sin medir:

- El circuito es pequeño: un camino de Merkle de profundidad 20 más un puñado de comparaciones. No
  es un circuito de rollup.
- La generación del testigo suele dominar sobre la prueba misma en circuitos de este tamaño.
- El presupuesto de producto es **mantener la interfaz respondiendo**: la prueba se genera fuera del
  hilo de UI, con progreso real y cancelable.

Referencia de coste conocida: el proyecto ZK anterior midió ~23,7 s por prueba de *backing* sobre Midnight en
escritorio. No es comparable —otro sistema de prueba, otro circuito, otra máquina— y se cita solo
para fijar que esto se mide, no se estima.

## Tiendas

Dos cosas que hay que preparar antes de enviar, no después:

- **Declaración de privacidad.** La app recolecta menos de lo que un formulario de las tiendas
  espera, lo cual es bueno y confunde el formulario. Hay que poder explicar qué se guarda en el
  dispositivo y qué no sale de él.
- **Políticas de criptomoneda.** El anclaje escribe en Stellar. No hay compra, venta ni custodia de
  activos — lo que se ancla es un hash — y eso hay que poder sostenerlo por escrito.

## Qué falta decidir

1. **Respaldo de los factores de cegado.** Frase, llavero del sistema o custodia. Ninguna es obvia.
2. **Quién paga el anclaje.** Si el usuario necesita XLM, el alta tiene fricción de cripto; si la
   paga la plataforma, hace falta un patrocinador de transacciones.
3. **Lectura del documento en el alta.** Sin foto de la cédula, el número se teclea. NFC del
   pasaporte o de la cédula digital es alternativa, y cambia el alcance.
