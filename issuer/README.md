<!-- issuer/README.md
     El servicio de emisión: qué hace, cómo se corre y por qué existe como
     proceso aparte. Se distingue de sources/, que tiene los adaptadores, y de
     attestation/, que firma y verifica sin saber de HTTP. -->

# @knowni/issuer

El único proceso que tiene una llave de proveedor.

```bash
# con CROMA_API_KEY en el entorno
npm start --workspace @knowni/issuer
# → issuer listening on http://localhost:8787
```

| Endpoint | Qué hace |
|---|---|
| `GET /keys` | La llave pública del emisor. Sin ella, una firma es incomprobable |
| `POST /quote` | Cotiza antes del consentimiento; declara si cobra y devuelve referencia, destino, activo y monto exactos |
| `POST /issue` | Recibe una consulta autorizada y pagada, llama a las fuentes y devuelve respuestas firmadas |

## Por qué es un proceso aparte y no una pantalla

Una `CROMA_API_KEY` en el teléfono de una contraparte convierte el producto en un buscador de
personas con un paso extra. La llave vive aquí; el teléfono manda una consulta **autorizada por el
titular** y recibe respuestas firmadas que verifica por su cuenta.

## Reglas que el servicio hace cumplir

- **Una fuente sin consentimiento no se consulta.** No se filtra después: no se llama.
- **Una fuente que no responde produce `unavailable`, nunca `false`.** "No sabemos" y "no cumple"
  son respuestas distintas y todo el producto depende de no confundirlas.
- **Nada del proveedor cruza.** Ni el número consultado, ni el nombre que devuelve la Procuraduría,
  ni un código de verificación. Hay una prueba que lo afirma.
- **Cada respuesta dice qué no afirma**, y eso viaja firmado junto al valor.

## Cobro

Paga quien pregunta; el titular solo paga si quiere una credencial reutilizable (D-26).

- Precio **por predicado**: pedir cuatro cuesta más que pedir dos, y ese es el freno a pedir de más.
- `paymentRef` ata el pago a **esa** pregunta: audiencia, finalidad, reto, parámetros y la lista
  exacta de predicados. Añadir un predicado después de pagar cambia la referencia.
- **`unavailable` no se cobra.** Cobrar un "no sabemos" pagaría por dejar una fuente inestable como
  está. Un `false` **sí** se cobra: cobrar solo la respuesta que el que pregunta esperaba pagaría
  por sesgar el veredicto.

## Variables de entorno

Los nombres están en [`.env.example`](../.env.example); los valores nunca se escriben en el
repositorio. **Cada bloque ausente apaga su función**, y el servicio lo dice en su primera línea:

```
issuer listening on http://localhost:8787
payments: off (no treasury account)
notifications: none
```

| Función | Variables | Si falta |
|---|---|---|
| Fuentes | `CROMA_API_KEY` | el servicio **no arranca** |
| Identidad del emisor | `KNOWNI_ISSUER_SEED` | se genera una por arranque, y lo emitido antes deja de verificar |
| Cobro | `KNOWNI_TREASURY_ACCOUNT` + `KNOWNI_PAYMENT_ASSET` (`usdc` por defecto, o `native`) + `KNOWNI_PAYMENT_ASSET_ISSUER` si es USDC | se responde sin cobrar si no hay tesoro; con tesoro incompleto o un activo desconocido no arranca |
| Pagos ya canjeados | `KNOWNI_SPENT_PAYMENTS_FILE` | obligatoria **si se cobra**: un conjunto gastado que muere con el proceso deja que una transacción pague dos veces — D-37 |
| Caché | `KNOWNI_ISSUER_CACHE_MAX_ENTRIES` | usa 1000 entradas en memoria por defecto |
| Aviso | `KAPSO_*` o `META_*` | no se envía nada, y se reporta como `none` |

## Pago

El pago se comprueba **contra la cadena**, no contra un recibo que mande el cliente: `paymentTx` se
busca en Horizon y tiene que estar exitoso, llevar el `paymentRef` como `MEMO_HASH`, haber llegado a
la cuenta del tesoro en el activo configurado y cubrir el monto publicado por `/quote`. El activo es
USDC por defecto; con `KNOWNI_PAYMENT_ASSET=native` es XLM, y `/quote` cotiza en `XLM`. La moneda de
la cotización siempre es la del activo cobrado: otro activo con el mismo número no sirve. Una transacción paga **una** pregunta; un pago rechazado
sigue disponible, para que nadie quede cobrado por una consulta que no se hizo.

## Reintentos e idempotencia

Una respuesta exitosa reducida y firmada vive en memoria hasta su propia expiración. La clave es un
HMAC que liga contraparte, sujeto, activo, consentimientos, pregunta y transacción; no contiene PII
recuperable. Dos retries idénticos —también si llegan a la vez— comparten pago, consulta, firma y
aviso. Los errores nunca se guardan. Reiniciar el proceso vacía el caché: no sustituye persistencia.

## Aviso

El mensaje dice *"tu respuesta está lista, ábrela en la app"* y **nada más**: ni el veredicto, ni
quién preguntó, ni para qué contrato. Un WhatsApp se lee en una pantalla bloqueada, se reenvía y
termina en el backup de otro teléfono.
