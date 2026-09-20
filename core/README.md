<!-- core/README.md
     Qué vive en @knowni/core y cuáles son los tres archivos que hay que leer.
     Se distingue de docs/ARCHITECTURE.md, que describe el sistema entero; aquí
     solo el workspace de dominio. -->

# `@knowni/core`

Reclamos, predicados, compromisos, Merkle, vinculación de sesión y el sobre
de divulgación. Sin dependencias y sin SDK de ninguna cadena.

## Los tres archivos que hay que leer

- [`src/predicates.ts`](src/predicates.ts) — las cuatro preguntas, como
  funciones puras sobre un reclamo y parámetros públicos. Es la
  implementación de referencia contra la que el circuito debe coincidir.
- [`src/disclosure.ts`](src/disclosure.ts) — todo lo que el verificador
  recibe, en un tipo. Es la promesa del producto escrita como estructura de
  datos.
- [`src/verify.ts`](src/verify.ts) — la cintura angosta: reclamos en
  memoria, sobre afuera. Pura y síncrona, que es lo que permite probar el
  invariante como propiedad de una función.

## El invariante

[`test/disclosure.invariant.test.ts`](test/disclosure.invariant.test.ts)
verifica que el sobre serializado no contiene ningún valor de los reclamos
que lo produjeron, y que sus campos son exactamente los permitidos. Un campo
nuevo falla ahí antes de poder llenarse con algo revelador.

```bash
npm test --workspace core
```
