<!-- docs/BRAINSTORM.md -->
El razonamiento del producto: qué se construye, qué deliberadamente no, y
dónde el diseño todavía necesita una decisión tuya.

# Brainstorming

## 1. El problema no es el KYC. Es la sobre-entrega.

Vale la pena nombrarlo con precisión porque decide todo lo demás.

Cuando una contraparte pide certificación bancaria, no quiere tus extractos: quiere saber si te
alcanza. Cuando pide la cédula, no quiere tu número de documento: quiere saber que existes y que
eres quien firma. El problema no es que verifiquen — es que la única forma de verificar que existe
hoy es **entregar el documento entero**, y el documento contiene diez veces más de lo que la
pregunta necesitaba.

**Y pasa en todo contrato, no solo en un arriendo.** Arrendar, comprar un vehículo ante notario,
salir de codeudor, firmar un contrato de suministro, otorgar un poder: cada uno cuesta un
expediente nuevo, casi siempre el mismo, entregado otra vez a alguien distinto. El arrendamiento es
la aplicación más visible; no es el producto.

Eso tiene tres costos, y los tres son reales:

- **Para quien firma**: su cédula, su salario y su empleador quedan en un Drive compartido de una
  inmobiliaria, de una notaría o de un proveedor. No es hipotético; es el caso normal.
- **Para la contraparte**: ahora es responsable de datos personales bajo la Ley 1581 sin haberlo
  pedido y sin capacidad de cumplir.
- **Para quien no tiene los papeles**: el independiente, el que acaba de llegar, el que trabaja por
  prestación de servicios. No es que no califique — es que no tiene el formato en que se lo piden.

El tercero es el que hace esto un producto y no una función de privacidad. Un sistema que responde
preguntas en vez de pedir documentos **incluye** a quien califica pero no tiene el papel.

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

Busqué en tu trabajo anterior. El proyecto ZK que hiciste no es un antecedente parecido: es
**exactamente la primitiva**, ya probada en una hackathon.

| Del proyecto ZK anterior | Cómo llega aquí |
|---|---|
| `Attestation<T>` genérica: el emisor firma un reclamo, el circuito lo verifica y solo el resultado sale | El patrón completo. `core/` es esta idea con cuatro predicados en vez de dos |
| `identity-check.compact`: `verified ∧ ofAge ∧ taxId coincide` | `provePersonhood` es el mismo predicado con una jurisdicción y una ventana de frescura |
| `backing-tier.compact`: colateral ≥ umbrales → tier, el monto nunca sale | `proveSolvency` es literalmente esto, con el canon como umbral en vez de un límite de tarjeta |
| `anchoring/`: puerto agnóstico + compromiso cegado | `anchoring/` aquí, con dos cambios: `ChainId` abierto con registro, y el nullifier viaja con el compromiso |
| La tabla de divulgación como comentario de cabecera en cada circuito | La convención se mantiene, y además se verifica en un test |
| La disciplina de `degraded` vs `failed` | Idéntica, y por la misma razón: "no calificas" y "no se pudo consultar" son respuestas distintas |

Y de los dos trabajos anteriores sobre Croma, que no son lo mismo:

- **El proyecto GovTech** — **la hackathon** (IA
  Hackathon GovTech, 12–16 ago 2026). De ahí sale el cliente maduro, el caché, `SourceResult<T>`
  y, sobre todo, un conjunto de decisiones de producto ya publicadas.
- **El prototipo notarial** — **sin terminar**, debida
  diligencia notarial para compraventa. Mismo dominio que esto, así que su mapa de rutas `/co/*`
  vale; su estado obliga a re-verificar antes de depender.

**Y hay una coincidencia afortunada que vale más que todo lo anterior.**

Midnight prueba sobre **BLS12-381**, y la curva embebida de BLS12-381 es
**Jubjub** — que es exactamente la curva sobre la que está escrito el Schnorr
del proyecto ZK anterior. Stellar, desde
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
el proyecto GovTech —la hackathon— y el mapa de
rutas colombianas del prototipo notarial. Ninguno se
reescribe. Detalle completo en [`CROMA.md`](CROMA.md).

### Lo que sigue abierto — ya no, está respondido

Revisé el catálogo real de Colombia el 2026-09-20. Dos respuestas firmes, no pendientes:

**PILA no está.** *"¿Cuánto gana?"* no tiene fuente directa en Croma. El sustituto más cercano es
**ADRES** —afiliación a salud—, que dice si alguien es cotizante activo en régimen contributivo.
Responde `formality`; **no** da el IBC, así que no responde `solvency`.

**SNR no está.** Ni matrícula inmobiliaria ni certificado de tradición. `propertyStanding` sobre un
**inmueble** no se puede construir con Croma. Sobre un **vehículo sí, y completo**: RUNT por placa,
historial y comparendos en SIMIT.

**Y apareció algo que no esperaba: `DNP Social Classification (Sisbén IV y RUI)`.** Es una
clasificación de pobreza del Estado. Meterla aquí le entregaría a un arrendador un filtro
socioeconómico con sello oficial — listo, sin que haya que inferir nada. Queda fuera, sin bandera de
configuración, y con ella la misma trampa por la puerta de atrás: ADRES distingue régimen
contributivo de **subsidiado**, así que solo produce `formality: true` para cotizante activo y
`unavailable` —nunca `false`— para todo lo demás. Un `false` ahí se lee como *"es pobre"*.

**Lo que eso cambia:** un arrendamiento se decide por *¿le alcanza?*, que es el predicado sin
fuente. Una **compraventa ante notario** se decide por identidad, capacidad e inhabilidades — los
tres que sí están, y que además un notario tiene obligación legal de verificar. La demo apunta ahí.

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

Una nota propia de procedimientos lo tiene escrito como regla:

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

## 6. Lo que el proyecto GovTech anterior ya decidió, y que aquí hay que respetar

El proyecto GovTech anterior no solo dejó código. Dejó **decisiones de producto publicadas**, y dos de
ellas chocan de frente con lo que yo había escrito. Las dos las tienes tú bien y yo mal.

### Antecedentes penales: fuera

El proyecto GovTech anterior lo dice sin matices: *"No usamos antecedentes penales. Ni de ella, ni de nadie. Es
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

Escribí *"nunca emitir un puntaje"* como exclusión no negociable. El proyecto GovTech anterior **sí emite uno**, y
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
El proyecto GovTech anterior le da a un banco algo que mirar donde no había nada, y un puntaje es la forma correcta
de eso; Knowni le quita a un arrendador un expediente que no debía tener, y un puntaje se lo
devolvería convertido en cifra.

### Medir la cobertura antes de que una fuente puntúe

El sello de negocio del proyecto GovTech anterior no aporta al puntaje, y la razón está medida, no supuesta: *"el
directorio cubre muchísimo mejor a unos estados que a otros; si diera puntos, premiaría el código
postal"*.

Aquí aplica igual y más fuerte: PILA cubre a quien cotiza. Si `formality` alimentara una decisión
agregada, premiaría la formalidad laboral y castigaría a la mitad informal del país por su forma de
trabajar, no por su capacidad de pagar. Por eso es un predicado separado que la contraparte tiene
que pedir **a la vista** — y antes de medir nada, hay que medir a quién cubre.

### Y una pieza que no había considerado

El proyecto GovTech anterior resuelve "este reporte no se puede falsificar" **sin cadena**: huella por archivo,
firma con la llave de Creva, folio visible, y el banco lo comprueba sin pedirle nada al usuario.

Merece una pregunta honesta: para el caso de uso de un arrendador, ¿hace falta anclar en Stellar, o
un sello firmado resuelve lo mismo más barato? La respuesta que le veo: el sello demuestra
*integridad y origen*; el ancla demuestra *que existía en un momento* y no depende de que la llave
de Creva siga viva en diez años. Son complementarios, no alternativos — y el sello es la que
funciona sin cripto en el flujo, que es lo que `MOBILE.md` marca como fricción abierta.

## 7. El catálogo de predicados

Contra el catálogo real de Croma, no contra lo que uno quisiera que existiera.

| Predicado | Pregunta | Divulga | Fuente |
|---|---|---|---|
| `personhood` | ¿Existe, vigente, vivo? | un booleano | Registraduría ✅ |
| `sanctions` | ¿Hay inhabilidad legal para contratar? | un booleano | Procuraduría · Contraloría · Contaduría ✅ |
| `capacity` | ¿Sin insolvencia, sin proceso que lo impida? | un booleano | SICAAC · Rama Judicial ✅ |
| `formality` | ¿Cotiza, y está activo? | un booleano | ADRES ✅ con la regla asimétrica |
| `assetStanding` | ¿El vehículo existe, sin comparendos, historial limpio? | un booleano | RUNT · SIMIT ✅ |
| `solvency` | ¿Le alcanza? | una banda | **sin fuente** — PILA no está en Croma |
| `propertyStanding` | ¿El inmueble está libre de gravámenes? | un booleano | **sin fuente** — SNR no está en Croma |

`assetStanding` es el que le da la vuelta al producto: es un predicado sobre el **activo**, no sobre
la persona. Hoy el comprador prueba todo y el vendedor nada, y resulta que es el único que el
catálogo cubre entero.

### Y el contrato es un perfil, no una rama

Los mismos cinco predicados sirven para todo. Lo que cambia entre contratos es **cuáles** se piden y
**con qué umbrales** — nunca qué significa un predicado:

| Perfil | Pide |
|---|---|
| Arrendamiento | `personhood` · `solvency` · `formality` · `sanctions` |
| Compraventa de vehículo | `personhood` · `capacity` · `sanctions` · `assetStanding` |
| Codeudor o garantía | `personhood` · `solvency` · `capacity` |
| Suministro con persona jurídica | `capacity` · `solvency` · `sanctions` |
| Poder o representación | `personhood` · `capacity` |

Por eso el alcance del hackathon es una **elección de perfil**, no un recorte del producto. Y por
eso `Purpose` tuvo que dejar de ser una unión cerrada: la capa de dominio no puede saber qué es un
arriendo. Ver [`memoria.md`](memoria.md) D-14.

Y los que **no** hay que construir, por más que los pidan:

- **Sisbén, o cualquier clasificación de pobreza.** Está a un endpoint de distancia y por eso hay
  que escribirlo: un producto que promete quitarle expedientes a la gente no puede ser el que
  entrega el filtro socioeconómico.
- **Un número agregado**, aquí. No por principio universal —ver la sección 6— sino porque en este
  producto le devolvería al arrendador una cifra opaca sobre la que decidir.
- **Antecedentes penales**, de nadie. Decisión firme, heredada del proyecto GovTech anterior, y ahora también
  aplica a `Fiscalía Criminal Case by Number`.
- **Los endpoints globales aplicados a una persona** — Web Search, Research, Extract. Rompen por la
  puerta de atrás la regla de que registro público es lo publicado por una autoridad.

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

**El acceso a las fuentes ya no es un riesgo: es una ausencia conocida.**
Croma cubre identidad, inhabilidades, insolvencia, registro mercantil, salud y
vehículos con una sola key. PILA y SNR **no están**, y eso está confirmado
contra el catálogo, no pendiente. Conseguirlos es acuerdo comercial, no
programación. Lo que cambió es que ya no hay que planear a ciegas: el alcance
del hackathon se fijó contra lo que existe.

**El sesgo de pobreza, que es el riesgo nuevo y el más serio.** El catálogo
trae `DNP Social Classification (Sisbén IV)` a un endpoint de distancia, y
ADRES —el sustituto de PILA— distingue régimen contributivo de subsidiado. Las
dos cosas convierten el producto en un filtro socioeconómico con sello oficial
si uno se descuida. Por eso Sisbén queda fuera sin bandera de configuración, y
ADRES solo produce `true`; todo lo demás es `unavailable`, nunca `false`. Un
`false` ahí se lee como *"es pobre"*, y con respaldo del Estado.

**El sesgo de formalidad.** Si "cotiza a seguridad social" se vuelve el
requisito de facto, el producto excluye a la mitad informal del país. Por eso
formalidad es un predicado separado y explícito: la contraparte tiene que
*pedirlo*, a la vista, y no recibirlo escondido dentro de un resultado.

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

El catálogo cerró tres de las que estaban abiertas: la fuente es Croma, PILA y SNR no están, y el
caso de uso de la demo es compraventa. Quedan estas.

1. **¿Vehículo o inmueble en la demo?** El vehículo cierra hoy —sujeto y activo con fuentes
   reales, cero sintético—. El inmueble es el mercado que te interesa, pero sin SNR le falta el
   predicado sobre el activo. Mi lectura: demostrar vehículo, contar inmueble.
2. **¿Sello firmado, ancla en cadena, o los dos?** El proyecto GovTech anterior ya demuestra que un reporte
   infalsificable no necesita cadena. El sello prueba integridad y origen sin cripto en el flujo;
   el ancla prueba que existía en un momento. Complementarios, y el sello primero.
3. **¿Demo con anclaje `memo` o con contrato Soroban?** `memo` corre hoy en testnet sin desplegar
   nada; el contrato demuestra la protección contra replay.
4. **¿Prueba ZK real o atestación firmada?** Depende de cerrar el hueco de Poseidon sobre
   BLS12-381. El puerto las hace intercambiables.
5. **¿Perseguimos PILA por operador después del hackathon?** Es lo que desbloquea el arrendamiento,
   que es el volumen. Es acuerdo comercial, no programación, y conviene empezarlo antes de
   necesitarlo.
