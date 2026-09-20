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
| [**`creva_score`**](https://github.com/LuisAlejandroCR/creva_score) | **La hackathon.** IA Hackathon GovTech, 12–16 de agosto de 2026, sobre Croma. México, para emprendedoras que piden su primer crédito | El cliente de Croma **más maduro** (tope de polls, timeout, `sleep` y logger inyectables), el caché, y — más importante — un conjunto de decisiones de producto ya tomadas y publicadas. Ver abajo |
| [`Digentia`](https://github.com/LuisAlejandroCR/Digentia) | **Un producto sin terminar.** Debida diligencia notarial para compraventa, Colombia | Las rutas `/co/*` y sus esquemas de respuesta. Es el mismo dominio que Knowni, así que el mapa de endpoints vale; el estado del proyecto no lo invalida, pero sí obliga a re-verificar antes de depender |

**El cliente se toma de `creva_score`, no de `Digentia`.** Mismo contrato, mejor implementación:
tope de polls (un job colgado no cuelga la app), timeout explícito, y `sleep`/`fetch`/`logger`
inyectables — que es lo que permite probarlo entero sin red. Su `SourceResult<T>` es el mismo shape
que este repositorio ya usa.

**Y hay algo que pesa más que el código.** `creva_score` tiene decisiones de producto publicadas
que este proyecto tiene que respetar o contradecir a la cara. Están en
[`memoria.md`](memoria.md) → D-09 y D-10.

## Endpoints y a qué predicado sirven

Rutas tomadas de [`Digentia`](https://github.com/LuisAlejandroCR/Digentia), verificadas en vivo
allí el **2026-08-11**. **No re-verificadas en esta sesión** — el proxy de red bloquea
`docs.usecroma.com`. Antes de implementar, confirmar contra la documentación y anotar la fecha en
[`verificacion.md`](verificacion.md).

Dos cosas suben la confianza en esa lista sin haberla llamado:

- **La URL base `https://api.croma.run` aparece en dos repositorios independientes** — `Digentia` y
  [`creva_score`](https://github.com/LuisAlejandroCR/creva_score).
- **La convención de rutas es `/{país}/{fuente}/{recurso}/v1`** en los dos, con países distintos:
  `/co/registraduria/vital-status/v1` y `/mx/siem/establishments/v1`. Una convención que se sostiene
  entre países es una convención documentada, no una coincidencia.

### Personas naturales

| Endpoint | Devuelve | Predicado |
|---|---|---|
| `POST /co/registraduria/vital-status/v1` | `{found, status: ALIVE\|DECEASED\|UNKNOWN}` | **personhood** — existe y está vivo |
| ~~`POST /co/policia/criminal-records/v1`~~ | antecedentes penales | **excluido** — ver [`memoria.md`](memoria.md) D-09 |
| `POST /co/procuraduria/disciplinary-records/v1` | `{found, has_records}` | **sanctions** (inhabilidad disciplinaria) |
| `POST /co/contraloria/fiscal-records/v1` | `{is_fiscal_responsible, verification_code}` | **sanctions** (inhabilidad fiscal) |
| `POST /co/contaduria/state-delinquent-debtors/v1` | deudores morosos del Estado | **sanctions** (inhabilidad) |
| `POST /co/sicaac/insolvency-cases/v1` | `{cases: [{entity_name, party_type, request_date}]}` | **capacity** — sin proceso de insolvencia |
| `POST /co/rama-judicial/cases-by-entity/v1` | procesos por nombre y tipo de parte | **capacity** (consulta por nombre → resolución) |
| `POST /co/rama-judicial/cases-by-radicado/v1` | un proceso por radicado | detalle |
| `POST /co/samai/processes/v1` · `/co/samai/corporaciones/v1` | procesos de altas cortes | detalle |

### Personas jurídicas

| Endpoint | Devuelve | Predicado |
|---|---|---|
| `POST /co/rues/entity-by-nit/v1` | matrícula mercantil, estado, actividad, representación | **capacity** de la persona jurídica |
| `POST /co/rues/entities-by-name/v1` | varias entidades por nombre | (consulta por nombre → resolución) |
| `POST /co/supersociedades/financial-statements/v1` | estados financieros | **solvency** de la persona jurídica |

### Otros activos

| Endpoint | Devuelve | Predicado |
|---|---|---|
| `POST /co/runt/vehicle-by-plate/v1` · `/co/runt/vehicle-history-by-plate/v1` | vehículo por placa e historial | **assetStanding** (vehículo) |
| `POST /co/simit/account-status/v1` | comparendos | **assetStanding** (vehículo) |
| `POST /co/dian/electronic-document/v1` | factura electrónica por CUFE | **solvency** documental |

### Lo que Croma no cubre, y sigue siendo el bloqueo

- **PILA / aportes a seguridad social.** Es la fuente de `solvency` y `formality` para persona
  natural, y no está en esta lista. Sigue siendo acuerdo con un operador de información.
- **SNR / certificado de tradición.** Es la fuente de `propertyStanding` — el predicado sobre el
  inmueble. Pendiente de confirmar si Croma lo expone.

Confirmar ambos es la primera tarea de integración, porque cambian el alcance del hackathon.

## El contrato HTTP

Verificado en `Digentia` el 2026-08-11.

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

Dos reglas, heredadas de `Digentia` y de la disciplina de `creva-zk`:

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
personas con un paso extra. Ver [`ARCHITECTURE.md`](ARCHITECTURE.md) → *Dónde se consulta*.

## Regional, sin tocar el dominio

Croma cubre Colombia, Perú y México con un solo contrato. Es la misma ambición regional del
producto, resuelta en la capa donde toca: **añadir un país es un adaptador en `sources/`**, no un
cambio en un predicado. Confirmar qué endpoints existen por país antes de prometer cobertura.

## MCP

Croma publica un servidor MCP, así que los mismos registros se consultan desde una conversación con
Claude. Sirve para **explorar** el catálogo y comprobar una forma de respuesta sin escribir cliente.
No sirve como camino de producción: la app no habla MCP, habla REST, y lo que se aprenda por MCP se
anota en [`verificacion.md`](verificacion.md) con fecha antes de codificarse.
