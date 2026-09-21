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
| `POST /issue` | Recibe una consulta autorizada, llama a las fuentes y devuelve respuestas firmadas y lo cobrable |

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
