<!-- sources/README.md
     Qué vive en @knowni/sources: adaptadores de fuentes oficiales y el emisor de
     conjuntos de reclamos. Se distingue de docs/CROMA.md, que documenta el
     contrato del proveedor y sus endpoints. -->

# `@knowni/sources`

Adaptadores de fuentes y el emisor de conjuntos de reclamos.

**Un adaptador por (país, pregunta)**, nunca por país: la Registraduría y
PILA son instituciones distintas, con disponibilidad distinta y base legal
de acceso distinta. Empaquetarlas en un "adaptador Colombia" haría que una
caída de PILA se viera como una falla de identidad.

Lo que un adaptador devuelve es un **reclamo** — el hecho mínimo que responde
un predicado — no la respuesta del registro. La respuesta se parsea, se
reduce y se descarta adentro: el NIT del empleador, la ARL y el fondo están
en la respuesta real de PILA y ninguno sobrevive al adaptador. Eso está
probado en [`test/unit/pila.spec.ts`](test/unit/pila.spec.ts).

- [`src/colombia/pila.ts`](src/colombia/pila.ts) — la pieza clave. Por qué la
  mediana y no la media, y los dos límites de cobertura, están ahí.
- [`src/colombia/listas.ts`](src/colombia/listas.ts) — el único adaptador que
  llama al puerto de recuperación, y el único lugar donde una búsqueda pasa.
- [`src/issuer.ts`](src/issuer.ts) — compromete, arma el árbol, publica la
  raíz. A partir de ahí el emisor puede estar fuera de línea para siempre.

## Dónde vive cada archivo

```text
src/
  types.ts                 el puerto: SubjectLookup, SourceResult, SourcePort
  issuer.ts                emisión del conjunto de reclamos
  providers/croma/         transporte HTTP, agnóstico a jurisdicción
  country/colombia/        un archivo por registro colombiano
```

Añadir un país es **una carpeta bajo `country/`**: un adaptador reduce la respuesta de su registro
al reclamo mínimo y nada por encima del puerto aprende qué país lo produjo.
