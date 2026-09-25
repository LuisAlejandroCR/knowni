<!-- web/DESIGN.md
     El sistema de diseño del dominio, escrito para que un agente genere
     interfaz consistente sin abrir el CSS. Se distingue de web/README.md, que
     dice qué se sirve y cómo se despliega, y de app/src/theme.ts, que es la
     fuente de los valores. -->

# Sistema de diseño — Knowni web

La fuente de verdad de los valores es [`app/src/theme.ts`](../app/src/theme.ts).
Aquí no se inventa ninguno: se copian como variables CSS con el nombre del token
al lado. Los contrastes de abajo están **calculados**, no estimados.

El método —tabla de tokens, tabla de contraste, prohibiciones explícitas— viene
del sistema de Creva ZK. Las reglas de pantalla vienen de `responsive.md`. Lo
que no se copia es la paleta: un sistema de diseño se toma en tokens, nunca en
capturas.

## Reglas que no se negocian

1. **No inventar un color.** Si el valor no está en `theme.ts`, no existe.
2. **`--ink-faint` no es tinta de propósito general.** Ver [Contraste](#contraste).
3. **Todo texto cumple AA (4.5:1).** La tabla dice qué tinta va sobre qué superficie.
4. **Ningún control por debajo de 44 px** de alto o de área táctil.
5. **La severidad usa forma, texto y color** — nunca color solo. Por eso cada
   respuesta lleva un símbolo (`✓`, `—`) además del fondo.
6. **El fichero estático ya tiene que ser correcto.** Nada que solo un script
   pueda deshacer. Por eso los pasos son `:target` y la página no lleva
   JavaScript.
7. **Ninguna petición externa.** Este dominio sirve una raíz de confianza; una
   fuente remota aquí es un tercero mirando quién pide el documento.

## Paleta

| Token | Valor | Para qué |
| --- | --- | --- |
| `--deep` | `#193e36` | Acción principal, marca, marcas de paso. |
| `--lime` | `#dbef9e` | Tinta sobre `--deep`; filo de la nota. |
| `--lime-soft` | `#e8f0d8` | Fondo de una respuesta afirmativa. |
| `--amber` / `--amber-line` / `--amber-ink` | `#fff4dd` / `#e8d0a3` / `#745015` | Familia de «no pedido» y de aviso. |
| `--page` | `#e7e9e4` | Fondo de página. |
| `--card` | `#ffffff` | Tarjeta. |
| `--canvas` | `#fafbf7` | Tinta sobre `--deep`. |
| `--ink` / `--ink-soft` / `--ink-faint` | `#182c29` / `#56655b` / `#68756a` | Tinta dominante, secundaria, terciaria. |
| `--line` | `#dce2d8` | Bordes y separadores. |

## Contraste

Calculado con la fórmula de luminancia relativa de WCAG 2.1 sobre los valores de
`theme.ts`. `ok` = 4.5:1 o más; `LG` = solo texto grande (≥24 px, o ≥18.7 px en
negrita); `NO` = prohibido.

| Tinta | `--card` | `--canvas` | `--page` | `--lime-soft` | `--amber` | `--deep` |
| --- | --- | --- | --- | --- | --- | --- |
| `--ink` | 14.67 ok | 14.12 ok | 12.00 ok | 12.50 ok | 13.44 ok | 1.25 NO |
| `--ink-soft` | 6.16 ok | 5.93 ok | 5.04 ok | 5.25 ok | 5.64 ok | 1.91 NO |
| `--ink-faint` | 4.84 ok | 4.65 ok | **3.96 NO** | **4.12 NO** | **4.43 NO** | 2.43 NO |
| `--deep` | 11.77 ok | 11.33 ok | 9.63 ok | 10.03 ok | 10.78 ok | 1.00 NO |
| `--amber-ink` | 7.24 ok | 6.97 ok | 5.92 ok | 6.17 ok | 6.63 ok | 1.63 NO |
| `--lime` | 1.25 NO | 1.20 NO | 1.02 NO | 1.06 NO | 1.14 NO | 9.45 ok |
| `--canvas` | 1.04 NO | 1.00 NO | 1.18 NO | 1.13 NO | 1.05 NO | 11.33 ok |

### Las prohibiciones

- **`--ink-faint` sobre `--page`, `--lime-soft` o `--amber`.** Da 3.96, 4.12 y
  4.43: se queda corto en las tres. Es el color que más parece «gris de
  etiqueta» y el que más tienta. Para eso está `--ink-soft`, que da 5.04 sobre
  `--page`. **Esta página lo usaba y por eso existe esta tabla.**
- **Cualquier tinta clara sobre una superficie clara**, y `--ink` o `--deep`
  sobre `--deep`. Obvio dicho así, y aun así es lo que produce un botón
  ilegible.

### Cómo se comprueba

**No se cree: se recalcula en cada corrida.** `web/src/contrast.ts` tiene la
fórmula, `web/test/unit/contrast.spec.ts` lee los valores de `theme.ts`, los
compara con los números de esta tabla y falla si difieren en la segunda decimal.
Las tres prohibiciones están también como aserciones, porque una prohibición que
nadie comprueba es una sugerencia.

La paleta se lee de `theme.ts` **como texto**: vive en `app/`, que el `tsconfig`
de la raíz excluye, y copiar sus valores aquí sería la segunda fuente que todo
esto existe para evitar.

## Pantallas

Cuatro pasos, un CTA por pantalla, un `h1` visible por pantalla. La estructura
viene de Creva ZK: el recorrido se cuenta en el orden en que le pasa a la
persona, y cada pantalla responde **una** pregunta.

| Paso | Pregunta que responde |
| --- | --- |
| 1 · Quién eres | ¿Qué se consulta, y quién lo consulta? |
| 2 · Tu respaldo | ¿Qué entra, y cómo se supo? |
| 3 · Qué compartiste | ¿Qué cruza, y qué no? |
| 4 · Tu resultado | ¿Quién quedó convencido, y con qué? |

Los pasos son `:target`. Sin JavaScript: el fichero servido ya es la pantalla 1
completa, y avanzar es una ancla. No hay estado atenuado esperando a un script.

## Medido, no supuesto

`responsive.md` pide las cifras, no la creencia. Las de esta página están en
[`docs/verificacion.md`](../docs/verificacion.md) con su fecha: 8 anchos × 4
pasos, cero desbordamiento, cero controles por debajo de 44 px, un `h1` visible.

Una salvedad dicha en voz alta: el documento contiene **cuatro** `h1`, uno por
paso, y solo uno se muestra. El fragmento de consola de `responsive.md` cuenta
los cuatro; la medición de aquí cuenta los visibles. La regla es «un `h1` por
pantalla» y se cumple; el número crudo no lo refleja y por eso se publican los
dos.
