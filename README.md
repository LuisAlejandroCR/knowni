<!-- README.md -->
Front page: what Knowni proves, which workspace owns what, how to run it, and
— under "What is built and what is not" — exactly which claims here rest on
something that runs and which do not.

# Knowni

**Demuestra que calificas para firmar, sin decir quién eres.**

[Español](#español) · [English](#english)

---

## Español

Firmar cualquier contrato en Colombia cuesta un expediente. Para arrendar: cédula, certificación
laboral, certificación bancaria, desprendibles y a veces el puntaje de DataCrédito. Para comprar un
vehículo ante notario: cédula, declaración de origen de fondos, certificado de tradición, paz y
salvo de comparendos. Para ser codeudor, otra vez todo. La contraparte recibe un dossier completo
sobre tu vida — y no tiene ni la obligación ni la capacidad de protegerlo.

No necesita el dossier. Necesita respuestas:

| Pregunta | Lo que hoy entregas | Lo que Knowni entrega |
|---|---|---|
| ¿Existe y es quien dice ser? | Cédula escaneada | `true` |
| ¿Tiene capacidad legal para contratar? | Nada, o una consulta a tu nombre | `true` |
| ¿Hay una inhabilidad vigente? | Antecedentes de todo tipo | `true` |
| ¿Le alcanza? | Certificación bancaria, nómina | `STRONG` (≥3× la obligación) |
| ¿El activo está limpio? | Certificado de tradición, paz y salvo | `true` |

Respuestas. Ni el nombre, ni el número de cédula, ni el salario, ni el empleador, ni la fecha de
nacimiento. El expediente completo de la solicitud cabe en diez campos, y ninguno dice nada de ti
más allá de lo que te preguntaron — eso está verificado, no prometido:
[`journey/test/journey.test.ts`](journey/test/journey.test.ts).

### El contrato es un perfil, no el producto

El arrendamiento es **una aplicación**. Lo que cambia entre un arriendo, una compraventa, una
garantía o un contrato de suministro es **cuáles** predicados se piden y **con qué umbrales** —
nunca qué significa un predicado, y nunca nada dentro de `core/`.

| Perfil | Pide |
|---|---|
| Arrendamiento | `personhood` · `solvency` · `formality` · `sanctions` |
| Compraventa de vehículo | `personhood` · `capacity` · `sanctions` · `assetStanding` |
| Codeudor o garantía | `personhood` · `solvency` · `capacity` |
| Suministro con persona jurídica | `capacity` · `solvency` · `sanctions` |
| Poder o representación | `personhood` · `capacity` |

`Purpose` es una cadena abierta validada, no una unión de los contratos que existían el día que se
escribió el tipo. Añadir un contrato es componer un perfil, no tocar el dominio. Ver
[`docs/memoria.md`](docs/memoria.md) D-14.

**Es una app de iOS y Android, y eso no es un detalle de entrega.** La promesa no es "no
compartimos tus datos": es que **el dato nunca sale del teléfono**. La prueba se genera ahí, sin
servidor en el medio, y una vez emitidas las credenciales funciona sin red. Ver
`docs/MOBILE.md`.

### De dónde salen las respuestas

Los registros oficiales se consultan por [**Croma**](https://docs.usecroma.com),
una API de datos de gobierno de Latinoamérica: Registraduría, Procuraduría,
Contraloría, Contaduría, SICAAC, Rama Judicial y RUES con una sola integración,
y la misma para Colombia, Perú y México. Detalle en
[`docs/CROMA.md`](docs/CROMA.md).

**Lo que no se consulta: antecedentes penales, de nadie — ni Sisbén.** El
catálogo de Croma incluye la clasificación socioeconómica del DNP, y usarla
aquí le entregaría a una contraparte un filtro de pobreza con sello oficial.
Tampoco se consulta.

**Antecedentes penales, de nadie.** No dicen si alguien
puede pagar un arriendo; dicen que cumplió una condena. Como filtro de vivienda
le cierra la puerta a quien ya pagó. La pregunta que sí se responde es si hay una
**inhabilidad legal vigente** para contratar, que es otra cosa y es la que una
contraparte regulada tiene obligación de mirar.

Croma **no** cubre PILA ni el certificado de tradición — confirmado contra el
catálogo, no pendiente. Por eso la demo del hackathon es una **compraventa de
vehículo ante notario**: es el único recorrido que cierra con fuentes reales de
punta a punta, sujeto y activo. El arrendamiento espera a PILA, declarado y no
disimulado.

La pregunta que sigue sin fuente, y que es la que decide un arriendo:

**PILA** — la Planilla Integrada de Liquidación de Aportes. Cuando un
arrendador pide certificación laboral *y* certificación bancaria, está
haciendo dos preguntas que el registro de aportes a seguridad social ya
responde: el IBC dice cuánto, y la continuidad de los aportes dice qué tan
estable. Es mejor fuente que un certificado bancario por tres razones: es
mensual en vez de una foto, es difícil de fabricar porque alguien pagó plata
real contra él, y cubre a los independientes que una carta de nómina no
puede cubrir.

Dos límites que el producto no esconde: un trabajador informal no cotiza y se
ve idéntico a alguien sin ingresos — por eso formalidad es un predicado
aparte y no un proxy de confiabilidad; y muchos independientes cotizan sobre
el mínimo legal, así que el IBC es un **piso** del ingreso, no una medición.
Ambos están escritos en [`sources/src/country/colombia/pila.ts`](sources/src/country/colombia/pila.ts)
y probados en [`sources/test/pila.test.ts`](sources/test/pila.test.ts).

### Empezamos en Colombia; el diseño no es colombiano

Nada en `core/` sabe que Colombia existe. Un predicado recibe una
jurisdicción y compara enteros. Sumar Perú (RENIEC + SUNAT) o México (CURP +
IMSS) es un adaptador nuevo en `sources/`, no un cambio en el dominio.

### Stellar es un adaptador, no la arquitectura

El anclaje va detrás de un puerto con un registro de cadenas. La misma
verificación ancla en Stellar, en EVM o en memoria sin que nada por encima
del registro sepa en cuál — ejercitado, no afirmado:
[`anchoring/test/registry.test.ts`](anchoring/test/registry.test.ts).

Lo mismo con Croma: es **un** adaptador de `SourcePort`. Detrás de él están la
Registraduría, la Procuraduría y el SICAAC; si mañana hay acceso directo a una,
entra como otro adaptador sin tocar un solo predicado.

### Workspaces

- [`core/`](core/) — reclamos, predicados, compromisos, Merkle, sesión y el
  sobre de divulgación. Sin dependencias, y sin SDK de ninguna cadena — eso
  está verificado en `core/test/no-vendor-imports.test.ts`.
- [`sources/`](sources/) — adaptadores de fuentes y el emisor de conjuntos de
  reclamos. Colombia primero.
- [`retrieval/`](retrieval/) — resolución de entidades para las consultas **por
  nombre** de Croma. **Parcialmente marcado para retirarse** — ver su README.
- [`anchoring/`](anchoring/) — el puerto de anclaje y sus adaptadores.
- [`app/`](app/README.md) — iOS y Android: emisión verificada y motor de pago Stellar portable.
  Falta ejecución en teléfono físico y firma real con las wallets configuradas.
- [`circuits/`](circuits/) — los circuitos Circom. Código fuente; ver estado.
- [`contracts/knowni-verifier/`](contracts/knowni-verifier/) — el verificador
  Soroban. Código fuente; ver estado.

### Correrlo

Node 22.18+. El **dominio** no tiene dependencias externas ni paso de compilación. La **app**
(`app/`) es un proyecto aparte con Expo y dos librerías de criptografía pura.

```bash
npm install   # solo enlaza los workspaces entre sí
npm test      # 327 pruebas (unit · fuzz · invariant)
```

Empieza por [`journey/test/journey.test.ts`](journey/test/journey.test.ts):
es el recorrido completo, sin red y sin mocks.

### Anclado en Stellar testnet, no prometido

Un compromiso real de este repositorio está en el ledger 4783364 de la testnet, como `MEMO_HASH`
de una transacción firmada sin SDK ni dependencias:

| Qué | Valor |
|---|---|
| Transacción | [`0dc0fdf4…f8161`](https://stellar.expert/explorer/testnet/tx/0dc0fdf46ebffc72257b068fe0022a6b732c6f4b9dda5503aaa8b005f18f8161) |
| Memo (`hash`) | `a88721ff2ce8c84aca495dd751964fe98f41d06a955b7544394c4702da6df523` |
| Compromiso anclado | `a88721ff2ce8c84aca495dd751964fe98f41d06a955b7544394c4702da6df523` — el mismo, comprobable contra Horizon |
| Comisión | 100 stroops |

El memo son 32 bytes y nada más: un compromiso cegado. Ni el resultado, ni la referencia del
sujeto, ni un reclamo. Reproducirlo: `node --experimental-strip-types anchoring/tools/anchor-testnet.ts`.

### Qué está construido y qué no

| Afirmación | Estado |
|---|---|
| Predicados, compromisos, Merkle, sesión, divulgación | **Corre.** 327 pruebas (CI en Node 22 y 24) |
| Adaptadores PILA, listas restrictivas, emisor | **Corre.** Contra fuentes sintéticas |
| Puerto de anclaje, adaptadores Stellar y memoria | **Corre.** Y ancló de verdad: [tx en testnet](https://stellar.expert/explorer/testnet/tx/0dc0fdf46ebffc72257b068fe0022a6b732c6f4b9dda5503aaa8b005f18f8161), memo igual al compromiso |
| Cliente HTTP de Croma | **Corre.** 21 pruebas sin red y fixtures capturadas de llamadas reales (2026-09-20) |
| Llamada en vivo a Croma | **Sí, acotada.** Catálogo, sondeo de 16 rutas y un `200` sobre una empresa pública. **Ninguna sobre una persona** |
| Credencial firmada y verificable sin cadena | **Corre.** Firma de la raíz, ruta de Merkle y apertura del compromiso, offline — `attestation/` |
| Solicitud firmada y anti-replay | **Corre.** La respuesta se ata a audiencia, finalidad, reto y parámetros; el nullifier se gasta una vez, y el conjunto gastado sobrevive al reinicio de la app |
| Lo que cruza la red | **Corre.** Respuestas firmadas por el emisor. El reclamo y la sal se quedan en el teléfono — y hay una prueba que lo afirma |
| Modo avión y logs sanitizados | **Corre.** El recorrido se completa con `fetch` desactivado y la cadena caída; ningún log lleva documento, nombre, salario ni cuenta |
| Aceptación completa | **Corre.** Solicitud, atadura, evidencia y revocación antes de consumir el nullifier; `unknown` es un estado propio |
| Adaptadores de Croma | **Corren.** Los cuatro del perfil de compraventa, contra los esquemas del OpenAPI de Croma. Ninguno ejercido sobre una persona real |
| App iOS / Android | **Recorrido real, bloque 5 de 5 pendiente.** La app consulta fuentes reales a través del servicio de emisión y verifica las respuestas en el teléfono. Nunca ejecutada en un dispositivo físico — [`app/`](app/README.md) |
| Pago móvil | **Implementado y probado sin red.** `/quote` entrega activo, destino y monto; Privy firma el hash, Freighter el sobre y la app envía a Horizon. Falta una firma real y una transacción USDC testnet |
| Reintentos del emisor | **Corren.** Un HMAC opaco separa contraparte, sujeto, pregunta y pago; retries concurrentes comparten una sola consulta y expiran con el sobre firmado |
| Circuitos Circom | **Escritos.** Sin compilar — ver [`circuits/README.md`](circuits/README.md) |
| Contrato Soroban | **Escrito.** Sin compilar ni desplegar |
| Servicio de emisión | **Corre.** Única llave de proveedor, consentimiento por fuente y respuestas firmadas — [`issuer/`](issuer/README.md) |
| Llamada en vivo a PILA o a un registro sobre una persona | **No.** Ninguna |
| Ejecución en un teléfono físico | **No.** Ninguna |

Ningún número de este repositorio viene de una medición que no se haya
corrido aquí.

### Documentos

Versionados, porque un agente los necesita para trabajar:

- [`docs/plan.md`](docs/plan.md) — alcance, fuentes, fases y criterios de aceptación.
- [`docs/memoria.md`](docs/memoria.md) — las decisiones tomadas, con su razón y su fecha.
- [`docs/verificacion.md`](docs/verificacion.md) — qué está comprobado, contra qué y cuándo.
- [`docs/CROMA.md`](docs/CROMA.md) — la fuente: catálogo, rutas verificadas y contrato HTTP.

`ARCHITECTURE.md`, `BRAINSTORM.md`, `COLOMBIA.md`, `MOBILE.md` y `ROADMAP.md` son material de
exploración y se quedan en local: lo que sobrevive de ellos ya está en los cuatro de arriba.

---

## English

**Prove you qualify to sign, without saying who you are.**

Signing anything in Colombia costs a dossier — a lease, a vehicle sale before a notary, a
guarantee. The counterparty receives a complete file about your life and has neither the
obligation nor the capacity to protect it. They do not need the file. They need answers: does this
person exist, do they have legal capacity, is there a standing disqualification, can they cover
the obligation, is the asset clean.

**The contract type is a profile, not the product.** A lease is one application. What changes
between a lease, a sale, a guarantee or a supply contract is *which* predicates are asked and with
*what* thresholds — never what a predicate means, and never anything inside `core/`. `Purpose` is
an open validated string, not a union of the contract types that existed the day it was written.

**It is an iOS and Android app, and that is not a delivery detail.** The promise is not "we don't
share your data" — it is that the data never leaves the phone. The proof is generated there, and
once credentials are issued it works offline.

Official records are read through [Croma](https://docs.usecroma.com), a Latin American
government-data API covering Colombia, Peru and Mexico through one integration. Croma does not
cover social-security contributions or the property registry, which is why the hackathon profile is
a **vehicle sale**: the only one the catalogue covers end to end with real sources, subject and
asset alike.

Colombia is the first jurisdiction, not the design: nothing in `core/` knows Colombia exists.
Stellar is the first chain, behind a port with a chain registry. Croma is one adapter of a source
port, for the same reason.

See the Spanish section above for the workspace map, how to run it, and the table of what is built
and what is not. All documentation is in `docs/`.

---

Licensed Apache-2.0.
