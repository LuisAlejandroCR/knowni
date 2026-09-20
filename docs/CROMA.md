<!-- docs/CROMA.md
     Croma como capa de acceso a registros oficiales: qué endpoints existen, qué
     predicado alimenta cada uno, el contrato HTTP, y la corrección de diseño que
     obligó a hacer. Se distingue de COLOMBIA.md, que describe el panorama de
     fuentes y el marco legal sin depender de un proveedor. -->

# Croma

[Croma](https://docs.usecroma.com) es una API de datos de gobierno de Latinoamérica: una sola
integración contra registros oficiales de Colombia, Perú y México, devueltos como JSON tipado. Una
autenticación, un cliente y un contrato en vez de un portal distinto por registro.

## La corrección que obligó a hacer

La primera versión de este repositorio leyó "croma" como **Chroma**, la base de datos vectorial, y
construyó `retrieval/` sobre esa lectura: búsqueda semántica sobre registros públicos, normalización
de nombres latinoamericanos, política de resolución con piso y margen.

Era la herramienta equivocada para el problema principal. Croma **devuelve JSON estructurado
indexado por número de documento**: para `personhood` y `standing` no hay nada que desambiguar —
se consulta la cédula y el registro responde. La búsqueda difusa no era una pieza de la
arquitectura; era una solución a un problema que la fuente ya resolvió.

Lo que sobrevive de `retrieval/`, y por qué:

| Pieza | Destino |
|---|---|
| Política de resolución (piso + margen → `ambiguous`) | **Se queda.** Dos endpoints de Croma buscan **por nombre** y devuelven varios candidatos: `rama-judicial/cases-by-entity` y `rues/entities-by-name`. Ahí "MARIA RODRIGUEZ coincide con miles" sigue siendo el problema real |
| Normalización de nombres | **Se queda**, por lo mismo: la consulta por nombre se arma desde texto |
| Adaptador de Chroma, `RecordIndexPort`, índice en memoria | **Se retira.** No hay corpus que indexar cuando la fuente es una API tipada |
| `snapshotRoot` como raíz del conjunto de listas | **Cambia de origen.** Ya no es el hash de un corpus local; es el `checked_at` y el `verification_code` que devuelve la fuente |

La deuda está abierta: el código de `retrieval/` sigue en el repositorio con su lectura vieja.
Ver [`verificacion.md`](verificacion.md) → *Deuda conocida*.

## Los dos proyectos previos, y cuál pesa más

No son lo mismo y conviene no confundirlos:

| Proyecto | Qué es | Qué aporta aquí |
|---|---|---|
| **El proyecto GovTech** | **La hackathon.** IA Hackathon GovTech, 12–16 de agosto de 2026, sobre Croma. México, para emprendedoras que piden su primer crédito | El cliente de Croma **más maduro** (tope de polls, timeout, `sleep` y logger inyectables), el caché, y — más importante — un conjunto de decisiones de producto ya tomadas y publicadas. Ver abajo |
| **El prototipo notarial** | **Sin terminar.** Debida diligencia notarial para compraventa, Colombia | Las rutas `/co/*` y sus esquemas de respuesta. Es el mismo dominio que Knowni, así que el mapa de endpoints vale; el estado del proyecto no lo invalida, pero sí obliga a re-verificar antes de depender |

**El cliente se toma del proyecto GovTech, no del prototipo notarial.** Mismo contrato, mejor implementación:
tope de polls (un job colgado no cuelga la app), timeout explícito, y `sleep`/`fetch`/`logger`
inyectables — que es lo que permite probarlo entero sin red. Su `SourceResult<T>` es el mismo shape
que este repositorio ya usa.

**Y hay algo que pesa más que el código.** El proyecto GovTech trae decisiones de producto ya publicadas
que este proyecto tiene que respetar o contradecir a la cara. Están en
[`memoria.md`](memoria.md) → D-09 y D-10.

## El catálogo de Colombia, completo

Lista tomada del catálogo real de Croma el **2026-09-20**. Las **rutas** de nueve de ellos están
verificadas en vivo en el prototipo notarial (2026-08-11); las del resto están en el catálogo pero su ruta y su
forma de respuesta siguen sin verificar, y aquí se marcan como tales.

La URL base `https://api.croma.run` y la convención `/{país}/{fuente}/{recurso}/v1` aparecen en dos
repositorios independientes con países distintos, así que son convención documentada y no
coincidencia.

### Lo que responde un predicado

| Fuente | Predicado | Ruta |
|---|---|---|
| Registraduría Vital Status | **personhood** — existe y está vivo | ✅ `/co/registraduria/vital-status/v1` |
| Procuraduría Disciplinary Records | **sanctions** — inhabilidad disciplinaria | ✅ `/co/procuraduria/disciplinary-records/v1` |
| Contraloría Fiscal Records | **sanctions** — responsabilidad fiscal | ✅ `/co/contraloria/fiscal-records/v1` |
| Contaduría State Delinquent Debtor | **sanctions** — moroso del Estado | ✅ `/co/contaduria/state-delinquent-debtors/v1` |
| SICAAC Insolvency Cases | **capacity** — sin proceso de insolvencia | ✅ `/co/sicaac/insolvency-cases/v1` |
| Rama Judicial Cases by Entity | **capacity** — procesos por parte | ✅ `/co/rama-judicial/cases-by-entity/v1` |
| **ADRES Affiliation Status** | **formality** — cotizante activo | ✅ `/co/adres/affiliation-status/v1` — la ruta del catálogo viejo (`health-affiliation-status`) devuelve 404 |
| RUES Entity by NIT · Entities by Name | **capacity** de la persona jurídica | ✅ `/co/rues/entity-by-nit/v1` · `/co/rues/entities-by-name/v1` |
| Supersociedades Financial Statements · Shareholders | **solvency** de la persona jurídica | ✅ ambos: `/co/supersociedades/financial-statements/v1` · `/co/supersociedades/shareholders/v1` |
| RUNT Vehicle by Plate · History · SIMIT | **assetStanding** del vehículo | ✅ `/co/runt/vehicle-by-plate/v1` (`plate` + `document_number`) · `/co/runt/vehicle-history-by-plate/v1` (`plate`) · `/co/simit/account-status/v1` |
| DIAN Electronic Document | **solvency** documental (el sujeto aporta el CUFE) | ✅ `/co/dian/electronic-document/v1` |
| SECOP Contracts by Provider · Sanctions by Provider | **solvency** documental y **sanctions** de un contratista | ✅ `/co/secop/contracts-by-provider/v1` · `/co/secop/sanctions-by-provider/v1` |

### Lo que la verificación en vivo corrigió

Llamadas reales del **2026-09-20** contra `api.croma.run` con la llave del proyecto. El inventario
completo, generado desde la propia API, está en
[`sources/test/fixtures/croma/catalog-co.json`](../sources/test/fixtures/croma/catalog-co.json) y se
regenera con `sources/tools/croma-inventory.ts`.

| Hecho | Valor verificado |
|---|---|
| Catálogo | `GET /catalog` y `GET /openapi` son **públicos y sin autenticación**. 170 endpoints, **87 de Colombia** |
| Descubrimiento del contrato | Un `POST` con cuerpo vacío devuelve `400` con `error.details.issues[].path`: la lista de parámetros requeridos, sin enviar un solo dato del sujeto |
| Límite por endpoint | **100 solicitudes / 24 h**, declarado por el catálogo endpoint por endpoint |
| Presupuesto de cuenta | Cabeceras `X-RateLimit-Limit: 5000`, `-Remaining` y `-Reset` en ISO-8601 |
| Envolvente de error | `{ error: { type, code, message, param, details.issues[] } }` — captura literal en `error-invalid-param.json` |
| **RUAF sí está** | `/co/ruaf/affiliations/v1` (`document_number` + `issue_date`), en vivo. Es afiliación, no IBC: alimenta `continuity`, nunca `solvency` |
| Registro civil | `/co/registro-civil/birth-record/v1`, por nombre y fecha de nacimiento |
| `served_from` | Cada endpoint declara `live` o `dataset`. Un `dataset` tiene fecha de corte y no es una consulta en vivo |

Lo único con respuesta `200` real hasta hoy es `/co/rues/entities-by-name/v1` sobre **una empresa
pública**. Ninguna ruta sobre una persona se ha llamado con un documento real: hacerlo sin
autorización del titular es exactamente lo que este producto existe para impedir.

### Lo que existe y no se usa

| Fuente | Por qué no |
|---|---|
| **DNP Social Classification (Sisbén IV y RUI)** | Es una clasificación de pobreza. Ver D-12: es el endpoint más peligroso del catálogo para este producto |
| **DNP Sisbén Offices** | Solo tiene sentido junto al anterior |
| **Policía Criminal Records** | Antecedentes penales — D-09 |
| **Fiscalía Criminal Case by Number** | Misma regla que D-09 |
| **Superfinanciera Complaints** | Quejas contra entidades financieras, no sobre la persona |
| Consejo de Estado · CNDJ · SAMAI · DIAN Doctrina · ANCP-CCE | Jurisprudencia y doctrina. Material de consulta, no hechos sobre un sujeto |
| SIATA (clima, aire, sismos, cámaras) | Valle de Aburrá. Nada que ver con este producto |
| **Global: Web Search · Research · Extract · Generate JSON** | Aplicados a una persona rompen la exclusión de "registro público es lo publicado por una autoridad". No se llaman sobre un sujeto |

## Las dos preguntas que bloqueaban el alcance, respondidas

### PILA no está — y el sustituto tiene una trampa

No hay endpoint de aportes a seguridad social. La pregunta *"¿cuánto gana?"* **no tiene fuente
directa en Croma**, y eso es firme, no pendiente.

Lo más cerca es **ADRES Health Affiliation Status**. La afiliación a salud distingue régimen
contributivo de subsidiado y afiliado cotizante de beneficiario: un **cotizante activo en régimen
contributivo** está aportando a seguridad social. Eso responde `formality` —hay aporte y es
reciente— pero **no da el IBC**, así que no responde `solvency`.

Y trae la misma trampa que Sisbén por la puerta de atrás: *régimen subsidiado* es un marcador de
pobreza. Por eso ADRES entra con una regla estricta, no como una fuente más — ver
[`memoria.md`](memoria.md) **D-12**.

### SNR no está — pero los vehículos sí

No hay Superintendencia de Notariado y Registro, ni matrícula inmobiliaria, ni certificado de
tradición. `propertyStanding` **sobre un inmueble no se puede construir con Croma**.

Sobre un **vehículo sí, y completo**: RUNT por placa, historial del vehículo y estado de comparendos
en SIMIT. Una compraventa de vehículo se cubre de punta a punta hoy; una de inmueble, no.

### Lo que eso cambia

Cuatro predicados reales sin PILA: `personhood`, `sanctions`, `capacity` y `formality` (vía ADRES).
El que falta es `solvency`, que es justo el que decide un **arrendamiento** — y no el que decide una
**compraventa ante notario**, donde las preguntas son identidad, capacidad e inhabilidades. Ver
[`memoria.md`](memoria.md) **D-13**.

## El contrato HTTP

Verificado en el prototipo notarial el 2026-08-11.

```
POST https://api.croma.run<path>
Authorization: Bearer <CROMA_API_KEY>
Content-Type: application/json
Prefer: wait=55
```

| Respuesta | Forma | Qué hacer |
|---|---|---|
| `200` | `{ data: {...} }` | Listo. `data` puede ser `null` |
| `202` | `{ job: { id, status, status_url }, data?, error? }` | Consultar `status_url` hasta un estado terminal: `completed`, `failed`, `canceled`, `expired` |
| `502` | `upstream_error` | **Rama Judicial es upstream vivo.** Reintentar con backoff exponencial antes de degradar |
| cualquiera | cabeceras `X-RateLimit-Limit` · `-Remaining` · `-Reset` | Registrar, no ignorar |

`Retry-After` manda sobre el intervalo propio, tanto en el `202` inicial como en cada poll.

## Cómo se envuelve

Dos reglas, heredadas del prototipo notarial y de la disciplina del proyecto ZK anterior:

**Ninguna llamada lanza hacia arriba.** Sin key, sin red, con el upstream caído o con el job
fallido, el resultado es un `SourceResult` degradado con una razón de un vocabulario fijo. Una
excepción que sube tumba la verificación entera por una fuente de cuatro.

**Ninguna respuesta cruda sale del adaptador.** Se valida con esquema, se reduce al reclamo mínimo
y se descarta el resto. Importa más de lo que parece: `sicaac/insolvency-cases` devuelve
`document_number` en el cuerpo de la respuesta, y los ecos de error de estas APIs traen el número
de documento consultado. Un `SourceResult` que lo arrastre convierte el adaptador en la fuga que el
producto existe para cerrar.

## Dónde se consulta, y dónde nunca

La regla no es técnica, es sobre **quién llama**, y es la misma con Croma que con cualquier fuente:

| Momento | ¿Se consulta? |
|---|---|
| **Emisión**, en el teléfono del sujeto o por una fuente bajo su autorización | Sí. El resultado se vuelve un reclamo, se compromete y se publica en la raíz del emisor |
| **Verificación**, por la contraparte | **Nunca.** Recibe un sobre. No hay camino de código de una sesión a una consulta |

Una `CROMA_API_KEY` en el dispositivo del arrendador convertiría el producto en un buscador de
personas con un paso extra. Ver `ARCHITECTURE.md` → *Dónde se consulta*.

## Regional, sin tocar el dominio

Croma cubre Colombia, Perú y México con un solo contrato. Es la misma ambición regional del
producto, resuelta en la capa donde toca: **añadir un país es un adaptador en `sources/`**, no un
cambio en un predicado. Confirmar qué endpoints existen por país antes de prometer cobertura.

## MCP

Croma publica un servidor MCP, así que los mismos registros se consultan desde una conversación con
Claude. Sirve para **explorar** el catálogo y comprobar una forma de respuesta sin escribir cliente.
No sirve como camino de producción: la app no habla MCP, habla REST, y lo que se aprenda por MCP se
anota en [`verificacion.md`](verificacion.md) con fecha antes de codificarse.
