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
| `POST /quote` | Cotiza por predicado **antes** de que el titular consienta, y devuelve la referencia de pago |
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
| Cobro | `KNOWNI_TREASURY_ACCOUNT` | se responde sin cobrar |
| Aviso | `KAPSO_*` o `META_*` | no se envía nada, y se reporta como `none` |

## Pago

El pago se comprueba **contra la cadena**, no contra un recibo que mande el cliente: `paymentTx` se
busca en Horizon y tiene que estar exitoso, llevar el `paymentRef` como `MEMO_HASH`, haber llegado a
la cuenta del tesoro y cubrir el mínimo. Una transacción paga **una** pregunta; un pago rechazado
sigue disponible, para que nadie quede cobrado por una consulta que no se hizo.

## Aviso

El mensaje dice *"tu respuesta está lista, ábrela en la app"* y **nada más**: ni el veredicto, ni
quién preguntó, ni para qué contrato. Un WhatsApp se lee en una pantalla bloqueada, se reenvía y
termina en el backup de otro teléfono.
