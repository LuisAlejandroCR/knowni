<!-- README.md -->
Front page: what Knowni proves, which workspace owns what, how to run it, and
— under "What is built and what is not" — exactly which claims here rest on
something that runs and which do not.

# Knowni

**Demuestra que calificas para firmar, sin decir quién eres.**

[Español](#español) · [English](#english)

---

## Español

Hoy, para arrendar un apartamento en Bogotá, entregas: copia de la cédula,
certificación laboral, certificación bancaria, desprendibles de nómina y a
veces el puntaje de DataCrédito. El arrendador recibe un expediente completo
sobre tu vida — y no tiene ni la obligación ni la capacidad de protegerlo.

Pero el arrendador no necesita ese expediente. Necesita cuatro respuestas:

| Pregunta | Lo que hoy entregas | Lo que Knowni entrega |
|---|---|---|
| ¿Existe y es quien dice ser? | Cédula escaneada | `true` |
| ¿Le alcanza para el canon? | Certificación bancaria, nómina | `STRONG` (≥3× el canon) |
| ¿Tiene ingresos estables? | Certificación laboral | `true` |
| ¿Está en listas restrictivas? | Nada, o una consulta a tu nombre | `true` (limpio) |

Cuatro respuestas. Ni el nombre, ni el número de cédula, ni el salario, ni el
empleador, ni la fecha de nacimiento. El expediente completo de la solicitud
cabe en diez campos, y ninguno dice nada de ti más allá de lo que te
preguntaron — eso está verificado, no prometido:
[`journey/test/journey.test.ts`](journey/test/journey.test.ts).

### De dónde salen las respuestas

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
Ambos están escritos en [`sources/src/colombia/pila.ts`](sources/src/colombia/pila.ts)
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

Lo mismo con Chroma: es **un** adaptador de `RecordIndexPort`, y la política
de resolución significa lo mismo con Chroma, Qdrant o pgvector debajo.

### Workspaces

- [`core/`](core/) — reclamos, predicados, compromisos, Merkle, sesión y el
  sobre de divulgación. Sin dependencias, y sin SDK de ninguna cadena — eso
  está verificado en `core/test/no-vendor-imports.test.ts`.
- [`sources/`](sources/) — adaptadores de fuentes y el emisor de conjuntos de
  reclamos. Colombia primero.
- [`retrieval/`](retrieval/) — resolución de entidades sobre registros
  públicos. **Lee `retrieval/src/types.ts` antes de añadir un llamador**: la
  regla sobre quién puede llamar este puerto es la frontera de privacidad
  principal del producto.
- [`anchoring/`](anchoring/) — el puerto de anclaje y sus adaptadores.
- [`circuits/`](circuits/) — los circuitos Circom. Código fuente; ver estado.
- [`contracts/knowni-verifier/`](contracts/knowni-verifier/) — el verificador
  Soroban. Código fuente; ver estado.

### Correrlo

Node 22.18+. No hay paso de compilación y no hay dependencias externas.

```bash
npm install   # solo enlaza los workspaces entre sí
npm test      # 111 pruebas
```

Empieza por [`journey/test/journey.test.ts`](journey/test/journey.test.ts):
es el recorrido completo, sin red y sin mocks.

### Qué está construido y qué no

| Afirmación | Estado |
|---|---|
| Predicados, compromisos, Merkle, sesión, divulgación | **Corre.** 111 pruebas |
| Adaptadores PILA, listas restrictivas, emisor | **Corre.** Contra fuentes sintéticas |
| Puerto de anclaje, adaptadores Stellar y memoria | **Corre.** Contra submitters de prueba |
| Adaptador de Chroma | **Escrito**, probado contra una colección de prueba; no contra un servidor Chroma |
| Circuitos Circom | **Escritos.** Sin compilar — ver [`circuits/README.md`](circuits/README.md) |
| Contrato Soroban | **Escrito.** Sin compilar ni desplegar |
| Integración con PILA, Registraduría o DataCrédito reales | **No.** Ninguna |

Ningún número de este repositorio viene de una medición que no se haya
corrido aquí.

### Documentos

- [`docs/BRAINSTORM.md`](docs/BRAINSTORM.md) — el razonamiento del producto:
  qué se construye, qué no, y por qué.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — las decisiones técnicas y
  lo que se reutiliza de `creva-zk`.
- [`docs/COLOMBIA.md`](docs/COLOMBIA.md) — el panorama de fuentes y el marco
  legal (Ley 1581, Habeas Data).
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — qué sigue, en orden de riesgo.

---

## English

To rent an apartment in Bogotá today you hand over a scanned ID, an
employment letter, a bank certification, payslips and sometimes a credit
score. The landlord receives a complete dossier about your life, and has
neither the obligation nor the capacity to protect it.

The landlord does not need the dossier. They need four answers: does this
person exist, can they cover the rent, is their income steady, are they on a
restrictive list. Knowni delivers those four answers and nothing else — no
name, no ID number, no salary, no employer, no date of birth.

The answers come from **social-security contribution records** (PILA in
Colombia), which already answer what the employment letter and the bank
certification are really asking, monthly, for employees and independent
workers alike.

Colombia is the first jurisdiction, not the design: nothing in `core/` knows
Colombia exists. Stellar is the first chain, behind a port with a chain
registry — the same verification anchors on Stellar, on EVM or in memory
with no change above the registry. Chroma is one adapter of an index port,
for the same reason.

See the Spanish section above for the workspace map, how to run it, and the
table of what is built and what is not. All documentation is in `docs/`.

---

## Origin

Built on the primitive proven in
[`creva-zk`](https://github.com/LuisAlejandroCR/creva-zk) (Midnight
Hackathon, August 2026): verify a signed attestation, evaluate a public
predicate, disclose only the outcome. What carries over, what changed and
why is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

Licensed Apache-2.0.
