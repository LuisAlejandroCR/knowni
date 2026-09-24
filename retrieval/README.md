<!-- retrieval/README.md
     Estado del workspace tras la corrección de Croma: qué se retira, qué se
     conserva y por qué. Se distingue de docs/CROMA.md, que documenta la fuente
     real y el contrato del proveedor. -->

# `@knowni/retrieval`

> **Retirado en parte el 2026-09-24 (B3). Léelo antes de construir sobre él.**
>
> Se escribió leyendo "croma" como **Chroma**, la base de datos vectorial. Es
> [**Croma**](https://docs.usecroma.com): una API de datos de gobierno de Latinoamérica que
> devuelve **JSON tipado indexado por número de documento**. Para `personhood` y `standing` no hay
> nada que desambiguar — se consulta la cédula y el registro responde. La búsqueda semántica
> resolvía un problema que la fuente ya resolvió.
>
> El desmontaje es el bloque **B3** de [`../docs/plan.md`](../docs/plan.md).

## Qué se retira

| Pieza | Por qué | Estado |
|---|---|---|
| `src/adapters/chroma.ts` | No hay corpus que indexar cuando la fuente es una API tipada | ✅ retirado: no lo llamaba nadie fuera de su propia prueba |
| `src/types.ts` → `RecordIndexPort`, `RecordQuery` | El puerto correcto es `SourcePort`, en `sources/` | ✅ retirado con su último llamador |
| `src/adapters/memory.ts` | Existía para probar el puerto anterior | ✅ retirado |
| `sources/.../listas.ts` | Tamizaba por nombre contra un índice; los tres registros se consultan por número de documento | ✅ retirado: `createSanctionsSource` ya era el camino de producción |

El recorrido de `journey/` ejercita ahora esa misma fuente, con un Croma sintético que responde los
tres endpoints sin red. `sources/` ya no depende de este workspace.

## Qué se conserva, y por qué sigue haciendo falta

Dos endpoints de Croma consultan **por nombre** y devuelven varios candidatos:

- `POST /co/rama-judicial/cases-by-entity/v1` — `{name, entity_type}`
- `POST /co/rues/entities-by-name/v1`

Ahí *"MARIA RODRIGUEZ coincide con miles"* sigue siendo el problema real, y sigue sin resolverse con
un umbral.

| Pieza | Destino |
|---|---|
| [`src/normalize.ts`](src/normalize.ts) | Se queda, hoy sin llamador. La consulta por nombre se arma desde texto, y los registros colombianos traen tildes inconsistentes, `apellidos, nombres` y segundo apellido opcional |
| [`src/resolve.ts`](src/resolve.ts) | Se queda, hoy sin llamador. **Dos reglas, no un umbral**: el mejor candidato tiene que ser bueno *y* ganarle al segundo por margen. Si no, es `ambiguous`, va a revisión humana, y nunca se degrada a "limpio" |

Que hoy no las llame nadie es un hecho, no un descuido: entran en cuanto se integre uno de esos dos
endpoints por nombre, y borrarlas ahora obligaría a reescribir la regla del margen bajo presión de
entrega, que es justo cuando se convierte en un umbral.

Esa última regla es la que impide que un homónimo produzca una coincidencia judicial contra un
desconocido y alguien se quede sin arriendo por eso. Un sistema optimizado para conveniencia
devolvería "no hay procesos" ahí.

## La frontera, que no cambia

Se consulta en **emisión**, con consentimiento del sujeto. La contraparte **nunca** consulta —
recibe un sobre. Vale igual con Chroma, con Croma o con un PDF: una consulta lleva en claro lo que
busca, y quién la corre decide si el producto es una prueba o un buscador de personas.
