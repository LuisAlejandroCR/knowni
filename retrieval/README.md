# `@knowni/retrieval`

Resolución de entidades sobre registros públicos, detrás de un puerto neutral.

> **Lee [`src/types.ts`](src/types.ts) antes de añadir un llamador.** La
> regla sobre *quién* puede llamar este puerto es la frontera de privacidad
> principal del producto, y es una regla sobre sitios de llamada, no sobre
> tipos: se consulta en **emisión**, con consentimiento; **nunca** en
> verificación.

## Las dos reglas del screening

`MARIA RODRIGUEZ` coincide con miles de registros. Un resolvedor que
devuelve el mejor resultado produce una coincidencia de sanciones contra un
desconocido que comparte nombre, y a alguien le niegan un arriendo por eso.
Por eso hay dos reglas y no un umbral:

- **piso** — el mejor candidato tiene que ser realmente bueno.
- **margen** — tiene que ganarle al segundo por suficiente.

Si no pasa el margen, la respuesta es `ambiguous`, va a revisión humana, y
nunca se degrada silenciosamente a "limpio".

## Por qué el índice en memoria no es un stub

En listas de sanciones — cadenas cortas de nombres — el solapamiento de
tokens compite con embeddings y además es **determinista**, que es lo que
permite reproducir y apelar una decisión de screening. El índice vectorial se
gana el puesto en las fuentes difíciles: RUES, escrituras, boletines en PDF.
