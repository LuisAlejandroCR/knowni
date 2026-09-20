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

Y de los dos proyectos de Croma, que no son lo mismo:

- [**`creva_score`**](https://github.com/LuisAlejandroCR/creva_score) — **la hackathon** (IA
  Hackathon GovTech, 12–16 ago 2026). De ahí sale el cliente maduro, el caché, `SourceResult<T>`
  y, sobre todo, un conjunto de decisiones de producto ya publicadas.
- [`Digentia`](https://github.com/LuisAlejandroCR/Digentia) — **producto sin terminar**, debida
  diligencia notarial para compraventa. Mismo dominio que esto, así que su mapa de rutas `/co/*`
  vale; su estado obliga a re-verificar antes de depender.

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

## 4. Dónde encaja Croma — y dónde no

Primero la corrección, porque costó un workspace: esta sección decía **Chroma**, la base de datos
vectorial, y sobre esa lectura se construyó `retrieval/` entero — búsqueda semántica, normalización
de nombres, política de resolución.

[**Croma**](https://docs.usecroma.com) es otra cosa, y es mucho mejor noticia: una **API de datos de
gobierno de Latinoamérica**. Una sola integración contra registros oficiales de Colombia, Perú y
México, devueltos como JSON tipado. Una autenticación, un cliente y un contrato en vez de un portal
distinto por registro.

Cambia el riesgo principal del proyecto. En la sección 7 estaba escrito que *"el acceso a las
fuentes es el riesgo real, no la criptografía"*. Croma resuelve la mitad de ese riesgo de un golpe:

| Predicado | Antes | Con Croma |
|---|---|---|
| `personhood` | convenio con Registraduría, el más lento | `POST /co/registraduria/vital-status/v1` |
| `standing` | indexar cuatro listas públicas y mantenerlas | Policía, Procuraduría, Contraloría y Contaduría, por documento |
| `capacity` | no estaba en el catálogo | `/co/sicaac/insolvency-cases/v1` y Rama Judicial |
| `solvency`, `formality` | operador de PILA | **sigue abierto** — ver más abajo |

Y hay algo mejor todavía: ya trabajaste contra esta API, dos veces. El cliente sale de
[**`creva_score`**](https://github.com/LuisAlejandroCR/creva_score) —la hackathon— y el mapa de
rutas colombianas de [`Digentia`](https://github.com/LuisAlejandroCR/Digentia). Ninguno se
reescribe. Detalle completo en [`CROMA.md`](CROMA.md).

### Lo que sigue abierto

Croma **no** cubre aportes a seguridad social ni certificado de tradición. Son exactamente las
fuentes de `solvency`, `formality` y `propertyStanding` — es decir, la pregunta *"¿le alcanza?"*,
que es la que de verdad decide un arriendo. Confirmar si están en el catálogo es la primera tarea
de integración, porque cambia el alcance del hackathon.

### Lo que sí sobrevive de la lectura equivocada

Dos endpoints de Croma consultan **por nombre** y devuelven varios candidatos:
`rama-judicial/cases-by-entity` y `rues/entities-by-name`. Ahí *"MARIA RODRIGUEZ coincide con
miles"* sigue siendo el problema real, y la regla de dos partes —piso **y** margen sobre el
segundo— sigue siendo la respuesta. Si no pasa el margen, es `ambiguous`, va a revisión humana, y
**nunca** se degrada a "limpio". Un sistema optimizado para conveniencia devolvería "no hay
procesos" ahí y dejaría pasar a alguien.

### La frontera, que no cambia con el proveedor

Una consulta lleva en claro lo que busca. Da igual si el motor es vectorial o una API tipada: si la
corre la contraparte, la inmobiliaria termina con el expediente que los predicados reemplazaban.

| Momento | ¿Se consulta? |
|---|---|
| **Emisión**, por el sujeto o bajo su autorización | Sí. El resultado se vuelve un reclamo |
| **Verificación**, por la contraparte | **Nunca.** Recibe un sobre |

Una `CROMA_API_KEY` en el dispositivo del arrendador convertiría esto en un buscador de personas con
un paso extra.

## 5. El producto es una app, y eso decide cosas

No es un detalle de entrega. La tesis del producto es que **el dato no sale del teléfono**, y eso
solo es cierto si la prueba se genera ahí. Un proof server remoto ve el testigo entero: ve el
ingreso, ve el estado de la cédula, ve el resultado del screening. Si la prueba se genera allá, el
producto se reduce a una promesa contractual — que es exactamente lo que ya existe y no funciona.

Tu propia nota lo tiene escrito como regla (`procedures/00_Files/kuira_android_midnight.md`):

> **Se elige nativo cuando el proving en el dispositivo es la tesis del proyecto.**

Aquí lo es, así que la PWA —que es el camino barato y correcto para otra tesis— queda descartada
por escrito. iOS y Android sobre React Native, con un núcleo Rust para el prover. El dominio ya es
TypeScript sin dependencias, así que corre en el teléfono sin puerto. Detalle y descartes en
[`MOBILE.md`](MOBILE.md).

Tres consecuencias que no son obvias:

1. **Funciona sin red.** Publicada la raíz del emisor, probar no necesita ni al emisor ni a la
   fuente. En este mercado el teléfono tiene datos intermitentes, y una verificación que falla en la
   puerta de un apartamento no existe.
2. **Hay un secreto que sí hay que respaldar.** El secreto del sujeto y las sales se pueden
   regenerar o re-emitir. Los **factores de cegado** de anclajes pasados, no: sin ellos nadie puede
   abrir un anclaje ante un juez. Es el que más fácil se olvida.
3. **El alta no puede pedir una foto de la cédula.** Es el artefacto que el producto existe para
   eliminar. Pedirlo "solo para el alta" lo reintroduce entero — el número se teclea, o se lee por
   NFC.

## 6. Lo que `creva_score` ya decidió, y que aquí hay que respetar

Tu hackathon de Croma no solo dejó código. Dejó **decisiones de producto publicadas**, y dos de
ellas chocan de frente con lo que yo había escrito. Las dos las tienes tú bien y yo mal.

### Antecedentes penales: fuera

`creva_score` lo dice sin matices: *"No usamos antecedentes penales. Ni de ella, ni de nadie. Es
una decisión firme y no va a cambiar."*

Yo había metido `/co/policia/criminal-records/v1` dentro de `standing`. Se retira, y la razón
aguanta sola: un antecedente penal no dice si alguien puede pagar un arriendo. Dice que cumplió una
condena. Convertirlo en filtro de vivienda le cierra la puerta a quien ya pagó, a escala y en
silencio — que es el daño exacto que este producto existe para no causar.

Lo que sí se mantiene es **otra pregunta**, y la diferencia no es de grado:

| | Pregunta | ¿Se responde? |
|---|---|---|
| `sanctions` | ¿Hay una **inhabilidad legal vigente** para contratar? (OFAC, ONU, Procuraduría, Contraloría, Contaduría) | Sí. Es una restricción vigente, y una contraparte regulada tiene obligación de mirarla |
| ~~antecedentes penales~~ | ¿Qué hizo esta persona en el pasado? | **No.** Nadie impuso ese castigo adicional |

### El puntaje: yo dije "nunca", y estaba mal formulado

Escribí *"nunca emitir un puntaje"* como exclusión no negociable. `creva_score` **sí emite uno**, y
tiene razón — lo que lo hace defendible es que **el resultado se declara a sí mismo**:

```
kind: 'descriptive'
does_not_estimate:
  · La probabilidad de que dejes de pagar un crédito.
  · Tu historial crediticio, ni lo sustituye.
  · Una decisión de una institución financiera.
```

Eso es exactamente lo que le falta a `SolvencyTier`. `STRONG` es una banda descriptiva —"el ingreso
cubre tres veces el canon"— y hoy no lo dice en ninguna parte, así que un arrendador lo puede leer
como "buen pagador", que es una predicción que nadie hizo.

Lo que cambia: el sobre lleva una declaración con esa forma. Lo que no cambia: Knowni sigue sin
emitir un número agregado, y ahora por una razón concreta en vez de un principio de folleto —
`creva_score` le da a un banco algo que mirar donde no había nada, y un puntaje es la forma correcta
de eso; Knowni le quita a un arrendador un expediente que no debía tener, y un puntaje se lo
devolvería convertido en cifra.

### Medir la cobertura antes de que una fuente puntúe

El sello de negocio de `creva_score` no aporta al puntaje, y la razón está medida, no supuesta: *"el
directorio cubre muchísimo mejor a unos estados que a otros; si diera puntos, premiaría el código
postal"*.

Aquí aplica igual y más fuerte: PILA cubre a quien cotiza. Si `formality` alimentara una decisión
agregada, premiaría la formalidad laboral y castigaría a la mitad informal del país por su forma de
trabajar, no por su capacidad de pagar. Por eso es un predicado separado que la contraparte tiene
que pedir **a la vista** — y antes de medir nada, hay que medir a quién cubre.

### Y una pieza que no había considerado

`creva_score` resuelve "este reporte no se puede falsificar" **sin cadena**: huella por archivo,
firma con la llave de Creva, folio visible, y el banco lo comprueba sin pedirle nada al usuario.

Merece una pregunta honesta: para el caso de uso de un arrendador, ¿hace falta anclar en Stellar, o
un sello firmado resuelve lo mismo más barato? La respuesta que le veo: el sello demuestra
*integridad y origen*; el ancla demuestra *que existía en un momento* y no depende de que la llave
de Creva siga viva en diez años. Son complementarios, no alternativos — y el sello es la que
funciona sin cripto en el flujo, que es lo que `MOBILE.md` marca como fricción abierta.

## 7. El catálogo de predicados

Construidos hoy:

| Predicado | Pregunta | Divulga |
|---|---|---|
| `personhood` | ¿Existe, vigente, vivo, mayor de edad? | un booleano |
| `solvency` | ¿Le alcanza para el canon? | una banda: 1×, 2×, 3× |
| `formality` | ¿Cotiza, y hace cuánto? | un booleano |
| `sanctions` | ¿Hay una inhabilidad legal vigente para contratar? | un booleano |

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

- **Un número agregado**, aquí. No por principio universal —ver la sección 6— sino porque en este
  producto le devolvería al arrendador una cifra opaca sobre la que decidir, que es exactamente lo
  que se le está quitando. Knowni responde preguntas que el arrendador formuló; no le da una
  opinión.
- **Antecedentes penales**, de nadie, por ninguna vía. Decisión firme, heredada de `creva_score`.
- **Cualquier predicado sobre datos no públicos y no consentidos** — redes
  sociales, scraping, "señales de comportamiento". Un registro público es el
  publicado por una autoridad, no lo que se puede encontrar.

## 8. Quién paga

Vale la pena decidirlo temprano porque cambia el diseño.

| Modelo | Quién paga | Riesgo |
|---|---|---|
| **Por verificación**, la paga la inmobiliaria | El verificador | Alineado: paga quien reduce riesgo. Es el default |
| Suscripción de la inmobiliaria | El verificador | Mejor retención, peor entrada |
| El arrendatario paga su credencial | El sujeto | Peligroso: cobrarle a quien ya está en desventaja |
| Gratis para el sujeto, la fuente cobra por emisión | El emisor | Es donde termina el mercado maduro |

El default: **paga el verificador, por verificación**. Es el único que no le
cobra a la persona por demostrar que es quien dice.

## 9. Riesgos honestos

**El acceso a las fuentes sigue siendo el riesgo, pero es la mitad del que era.**
Croma cubre identidad, antecedentes, insolvencia y registro mercantil con una
sola key. Lo que no cubre es PILA — y PILA es la fuente de la pregunta que de
verdad decide un arriendo, *¿le alcanza?*. Eso sigue siendo un acuerdo con un
operador de información, y un acuerdo comercial no se resuelve programando. La
arquitectura está escrita para que sea un adaptador y no un bloqueo: todo corre
hoy contra fuentes sintéticas.

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

## 10. Regional

Croma cubre **Colombia, Perú y México** con un solo contrato, así que la parte
de acceso ya está resuelta para los tres. Lo que sigue decidiendo el orden es la
calidad del registro de aportes, que es lo que Croma no cubre:

| País | Identidad | Ingreso / formalidad | Nota |
|---|---|---|---|
| Colombia | Registraduría | **PILA** | El registro de aportes es inusualmente bueno |
| Perú | RENIEC | SUNAT, planilla electrónica | RENIEC tiene el mejor servicio de verificación de la región |
| México | RENAPO / CURP | IMSS | CURP es universal; IMSS cubre menos |
| Chile | Registro Civil | Previred | Estructura muy parecida a PILA |
| Brasil | CPF | eSocial / CNIS | Mercado grande, integración más pesada |

Lo que no cambia entre países: los cuatro predicados, el sobre, el anclaje y
la frontera de privacidad. Lo que cambia es `sources/` — y con Croma, para tres
de estos países, cambia menos de lo que parecía.

## 11. Decisiones que necesitan tu criterio

Estas no las tomé; están abiertas a propósito. Dos de la versión anterior ya no lo están: móvil es
nativo (sección 5) y la fuente de registros públicos es Croma (sección 4).

1. **¿Confirmamos PILA y SNR en Croma antes de fijar el alcance?** Es la pregunta que decide el
   hackathon. Si Croma expone aportes a seguridad social, `solvency` y `formality` son reales y el
   producto está completo. Si no, son sintéticos —declarados como tales en pantalla— y la demo se
   apoya en `personhood`, `standing` y `capacity`, que sí son reales.
2. **¿El inmueble entra en el alcance?** `propertyStanding` —matrícula libre de gravámenes, el
   vendedor es el titular— le da la vuelta al producto: hoy el arrendatario prueba todo y el
   arrendador nada. Depende de la respuesta anterior sobre SNR.
3. **¿Sello firmado, ancla en cadena, o los dos?** `creva_score` ya demuestra que un reporte
   infalsificable no necesita cadena: huella por archivo, firma, folio visible. El sello prueba
   integridad y origen y funciona sin cripto en el flujo; el ancla prueba que existía en un momento
   y no depende de que una llave siga viva en diez años. Mi lectura: complementarios, y el sello
   primero porque quita la fricción de que el usuario necesite XLM.
4. **¿Demo con anclaje `memo` o con contrato Soroban?** `memo` corre hoy en testnet sin desplegar
   nada; el contrato es el producto y es el que demuestra la protección contra replay.
5. **¿Prueba ZK real o atestación firmada?** Depende de cerrar el hueco de Poseidon sobre
   BLS12-381. El puerto las hace intercambiables, así que se pueden mostrar las dos.
6. **¿Arrendamiento o compraventa primero?** Compraventa tiene notario —un verificador
   institucional con obligación legal de verificar, y por tanto presupuesto— y es el cliente que
   `Digentia` ya estaba atendiendo. Arrendamiento tiene volumen y ciclos cortos.
