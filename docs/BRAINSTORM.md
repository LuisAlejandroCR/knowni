<!-- docs/BRAINSTORM.md -->
El razonamiento del producto: qué se construye, qué deliberadamente no, y
dónde el diseño todavía necesita una decisión tuya.

# Brainstorming

## 1. El problema no es el KYC. Es la sobre-entrega.

Vale la pena nombrarlo con precisión porque decide todo lo demás.

Cuando un arrendador pide certificación bancaria, no quiere tus extractos.
Quiere saber si le alcanza para el canon. Cuando pide la cédula, no quiere tu
número de documento; quiere saber que existes y que eres quien firmas. El
problema no es que verifiquen — es que la única forma de verificar que
existe hoy es **entregar el documento entero**, y el documento contiene diez
veces más de lo que la pregunta necesitaba.

Eso tiene tres costos, y los tres son reales:

- **Para el arrendatario**: su cédula, su salario y su empleador quedan en un
  Drive compartido de una inmobiliaria. No es hipotético; es el caso normal.
- **Para el arrendador**: ahora es responsable de datos personales bajo la
  Ley 1581 sin haberlo pedido y sin capacidad de cumplir.
- **Para quien no tiene los papeles**: el independiente, el que acaba de
  llegar, el que trabaja por prestación de servicios. No es que no le
  alcance — es que no tiene el formato en que se lo piden.

El tercero es el que hace esto un producto y no una función de privacidad.
Un sistema que responde preguntas en vez de pedir documentos **incluye** a
quien tiene los ingresos pero no el papel.

## 2. La inversión: de documentos a predicados

La idea central cabe en una línea: **el verificador recibe respuestas, no
datos**.

```
Hoy:     Arrendatario --[cédula, nómina, extracto]--> Arrendador
Knowni:  Arrendatario --[true, STRONG, true, true]--> Arrendador
```

Esto no es nuevo como idea — es lo que promete todo el campo de credenciales
verificables. Lo que decide si funciona es una pregunta aburrida: **¿quién
firma el reclamo, y contra qué se puede verificar sin llamarlo?**

La respuesta que usamos: el emisor publica una **raíz de Merkle** de los
compromisos que emitió. El sujeto guarda su reclamo, su sal y su camino. A
partir de ahí prueba solo, para siempre, sin que el emisor esté en línea — y
la revocación es el emisor republicando una raíz sin esa hoja.

## 3. Qué se reutiliza de lo que ya tienes

Busqué en tus repos. `creva-zk` no es un antecedente parecido: es
**exactamente la primitiva**, ya probada en una hackathon.

| De `creva-zk` | Cómo llega aquí |
|---|---|
| `Attestation<T>` genérica: el emisor firma un reclamo, el circuito lo verifica y solo el resultado sale | El patrón completo. `core/` es esta idea con cuatro predicados en vez de dos |
| `identity-check.compact`: `verified ∧ ofAge ∧ taxId coincide` | `provePersonhood` es el mismo predicado con una jurisdicción y una ventana de frescura |
| `backing-tier.compact`: colateral ≥ umbrales → tier, el monto nunca sale | `proveSolvency` es literalmente esto, con el canon como umbral en vez de un límite de tarjeta |
| `anchoring/`: puerto agnóstico + compromiso cegado | `anchoring/` aquí, con dos cambios: `ChainId` abierto con registro, y el nullifier viaja con el compromiso |
| La tabla de divulgación como comentario de cabecera en cada circuito | La convención se mantiene, y además se verifica en un test |
| La disciplina de `degraded` vs `failed` | Idéntica, y por la misma razón: "no calificas" y "no se pudo consultar" son respuestas distintas |

**Y hay una coincidencia afortunada que vale más que todo lo anterior.**

Midnight prueba sobre **BLS12-381**, y la curva embebida de BLS12-381 es
**Jubjub** — que es exactamente la curva sobre la que está escrito el Schnorr
de `creva-zk`. Stellar, desde
[CAP-0059](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0059.md)
(Protocolo 22+), verifica **Groth16 sobre BLS12-381 de forma nativa**.

Es decir: el trabajo criptográfico que hiciste para Midnight apunta al mismo
campo que Stellar verifica hoy. No es portar entre ecosistemas; es el mismo
emparejamiento. Un circuito escrito para BN254 — el default de Circom, de
Noir y de RISC Zero — **no** sirve en Stellar hasta que aterrice CAP-0074.
Esa sola decisión de curva es la diferencia entre demo y producto, y ya la
tomaste sin saberlo.

## 4. Dónde encaja Chroma — y dónde no

Esta es la parte donde hay que tener cuidado, porque es fácil construir un
data broker por accidente.

**Una búsqueda semántica no es una operación de conocimiento cero.** La
consulta lleva, en claro, lo que se está buscando. Si el arrendador corre la
búsqueda, el producto se derrumba en esa capa: la inmobiliaria ahora tiene el
nombre, el resultado del registro y el expediente que los predicados
supuestamente reemplazaban.

Así que la regla no es técnica, es sobre **quién llama**:

| Momento | ¿Se puede consultar? | Qué pasa |
|---|---|---|
| **Emisión** | Sí | El sujeto, o una fuente bajo su autorización, se resuelve contra registros públicos. El resultado se vuelve un **reclamo** |
| **Verificación** | Nunca | El arrendador recibe un sobre. No hay camino de código de una sesión a una búsqueda, y añadirlo colapsa el producto |

Lo que el arrendador recibe en vez de una consulta es un **`listSetRoot`**: la
instantánea que se buscó, publicada y fijable. "No está en listas" se vuelve
auditable sin que nadie vuelva a correr una consulta sobre una persona.

Y entonces, ¿para qué sirve Chroma de verdad? Para el problema que los
registros latinoamericanos tienen de verdad: **los nombres vienen sucios**.
PDFs escaneados, tildes inconsistentes, "apellidos, nombres" vs "nombres
apellidos", segundo apellido que aparece o no. Ahí la búsqueda difusa gana.

Con dos matices que ya están en el código:

- En **listas de sanciones** — cadenas cortas de nombres, sin prosa
  alrededor — el solapamiento de tokens compite de tú a tú con embeddings, y
  además es **determinista**, que es lo que permite que una decisión de
  screening se pueda reproducir y apelar. Por eso el adaptador en memoria no
  es un stub: es la implementación correcta para esa fuente.
- El índice vectorial se gana el puesto en las fuentes difíciles:
  descripciones de RUES, escrituras notariales, boletines en PDF.

Y el problema que de verdad mata un screening: **"MARIA RODRIGUEZ" coincide
con miles**. Por eso la resolución tiene dos reglas y no un umbral — el mejor
candidato tiene que ser bueno *y* tiene que ganarle al segundo por margen. Si
no, la respuesta es `ambiguous`, va a revisión humana, y **nunca** se degrada
a "limpio". Un producto optimizado para conveniencia devolvería "no está en
listas" ahí y dejaría pasar a alguien.

## 5. El catálogo de predicados

Construidos hoy:

| Predicado | Pregunta | Divulga |
|---|---|---|
| `personhood` | ¿Existe, vigente, vivo, mayor de edad? | un booleano |
| `solvency` | ¿Le alcanza para el canon? | una banda: 1×, 2×, 3× |
| `formality` | ¿Cotiza, y hace cuánto? | un booleano |
| `standing` | ¿Está en listas restrictivas? | un booleano |

Candidatos naturales, en orden de valor:

- **`capacity`** — ¿tiene capacidad legal para contratar? (interdicción,
  representación legal). Es el predicado que un notario necesita y que hoy
  nadie verifica bien.
- **`propertyStanding`** — sobre el **inmueble**, no la persona: ¿la matrícula
  inmobiliaria existe, está libre de gravámenes, el vendedor es el titular?
  Esto invierte el producto y es probablemente el más valioso: hoy el
  arrendatario prueba todo y el arrendador nada. Fuente: Superintendencia de
  Notariado y Registro.
- **`rentalHistory`** — ¿cumplió contratos anteriores? Solo funciona si los
  contratos anteriores dejaron anclas, así que se construye solo con el
  tiempo. Es el efecto de red del producto.
- **`guarantorCapacity`** — el codeudor, que es donde de verdad se traba un
  arriendo en Colombia.

Y los que **no** hay que construir, por más que los pidan:

- **Un puntaje**. En el momento en que Knowni emite un número de 0 a 1000,
  es una central de riesgo con otro nombre, hereda toda su regulación, y el
  arrendador vuelve a decidir sobre una cifra opaca. El producto responde
  preguntas que el arrendador formuló; no le da una opinión.
- **Cualquier predicado sobre datos no públicos y no consentidos** — redes
  sociales, scraping, "señales de comportamiento". Un registro público es el
  publicado por una autoridad, no lo que se puede encontrar.

## 6. Quién paga

Vale la pena decidirlo temprano porque cambia el diseño.

| Modelo | Quién paga | Riesgo |
|---|---|---|
| **Por verificación**, la paga la inmobiliaria | El verificador | Alineado: paga quien reduce riesgo. Es el default |
| Suscripción de la inmobiliaria | El verificador | Mejor retención, peor entrada |
| El arrendatario paga su credencial | El sujeto | Peligroso: cobrarle a quien ya está en desventaja |
| Gratis para el sujeto, la fuente cobra por emisión | El emisor | Es donde termina el mercado maduro |

El default: **paga el verificador, por verificación**. Es el único que no le
cobra a la persona por demostrar que es quien dice.

## 7. Riesgos honestos

**El acceso a las fuentes es el riesgo real, no la criptografía.** PILA y
DataCrédito no tienen una API pública que uno consume un sábado. Se llega por
un operador de información con la autorización del sujeto. La arquitectura
está escrita para que eso sea un adaptador y no un bloqueo — todo corre hoy
contra fuentes sintéticas — pero un acuerdo comercial no se resuelve
programando.

**El sesgo de formalidad.** Si "cotiza a seguridad social" se vuelve el
requisito de facto, el producto excluye a la mitad informal del país. Por eso
formalidad es un predicado separado y explícito: el arrendador tiene que
*pedirlo*, a la vista, y no recibirlo escondido dentro de un puntaje.

**El circuito todavía no compila.** `circomlib` está hecho para BN254; para
BLS12-381 hacen falta constantes de Poseidon de ese campo. Es trabajo
conocido, no investigación, pero es trabajo — y el camino de contingencia
(verificación off-chain con atestación firmada) hay que decirlo como lo que
es: un oráculo de cómputo verificable, con su supuesto de confianza escrito.

**La ceremonia de Groth16.** Un setup de fase 2 con un solo contribuyente
permite falsificar pruebas de ese circuito. Para la hackathon está bien y hay
que decirlo; para producción es una ceremonia multi-parte.

**La correlación fuera del protocolo.** El sobre no filtra nada, pero si la
inmobiliaria ya tiene tu correo, la anclaje es igualmente correlacionable por
tiempo. Anclar no es anonimato de red.

## 8. Regional

El orden lo decide la calidad del registro de aportes, no el tamaño del
mercado:

| País | Identidad | Ingreso / formalidad | Nota |
|---|---|---|---|
| Colombia | Registraduría | **PILA** | El registro de aportes es inusualmente bueno |
| Perú | RENIEC | SUNAT, planilla electrónica | RENIEC tiene el mejor servicio de verificación de la región |
| México | RENAPO / CURP | IMSS | CURP es universal; IMSS cubre menos |
| Chile | Registro Civil | Previred | Estructura muy parecida a PILA |
| Brasil | CPF | eSocial / CNIS | Mercado grande, integración más pesada |

Lo que no cambia entre países: los cuatro predicados, el sobre, el anclaje y
la frontera de privacidad. Lo que cambia es `sources/`.

## 9. Decisiones que necesitan tu criterio

Estas no las tomé; están abiertas a propósito.

1. **¿El inmueble entra en el alcance del hackathon?** `propertyStanding` es
   probablemente el predicado más valioso del catálogo y es el que nadie más
   está haciendo. Pero duplica el alcance.
2. **¿La demo corre con anclaje `memo` o con el contrato Soroban?** `memo`
   funciona hoy en testnet sin desplegar nada; el contrato es el producto y
   es el que demuestra la protección contra replay.
3. **¿Prueba ZK real o atestación firmada para la demo?** Real es más fuerte
   y depende de cerrar el hueco de Poseidon/BLS12-381. Atestada corre ya. Se
   pueden mostrar las dos si el puerto las hace intercambiables — que es como
   está escrito.
4. **¿Empezamos por arrendamiento o por compraventa?** Arrendamiento tiene
   más volumen y ciclos más cortos; compraventa tiene notario, que es un
   verificador institucional con obligación legal de verificar — y por lo
   tanto, un cliente que ya tiene presupuesto para esto.
