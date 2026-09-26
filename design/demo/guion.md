<!-- guion.md
     Guion de los videos de entrega: el demo grabado en el iPhone y el pitch de 3 minutos.
     Incluye qué se graba, qué se dice, qué lo respalda y qué está prohibido afirmar en cámara.
     Se distingue de elevenlabs-mcp.md, que es la pieza generada, y de design/day-08/README.md. -->

# Guion de entrega — demo y pitch

Fuente de las reglas: las bases oficiales del evento, consultadas el 2026-09-20. Estado al
2026-09-26.

| Entregable | Estado | Dónde |
|---|---|---|
| Repositorio público con README | ✅ público en GitHub (comprobado 2026-09-26) | <https://github.com/LuisAlejandroCR/knowni> |
| Video demo del producto corriendo | 🎬 grabado 2026-09-26; edición y voz en `build_demo.py`, falta render local con la voz y revisión cuadro a cuadro | este guion, §1; [`edicion.md`](edicion.md) |
| Video pitch, máximo 3 minutos | ⏳ por grabar | este guion, §2 |
| Pieza ElevenLabs (Challenge 3) | ✅ renderizada 2026-09-26 (84,9 s, 16:9 con subtítulos, 9:16 y corte de 30 s), sin publicar | prompt en [`elevenlabs-mcp.md`](elevenlabs-mcp.md); archivos fuera del repositorio, en `knowni-media/elevenlabs/out/` |
| Evidencia on-chain en testnet | ✅ listo | tabla *Evidencia en testnet*, abajo |

Los criterios pesan así: funcionalidad y testnet 30 %, integración Stellar 25 %, originalidad 20 %,
viabilidad 15 %, claridad del README y el video 10 %.

## Regla que manda sobre todo lo demás

**No se afirma en cámara nada que no corra, y cada frase tiene su fila en
[`docs/verificacion.md`](../../docs/verificacion.md).** Hoy eso alcanza para mucho:

- **Corre en un iPhone físico:** solicitud → consentimiento → consulta real a Registraduría vía
  Croma → respuesta firmada por el emisor → "Respuestas verificadas" (D-86).
- **El iPhone firma pagos en testnet** con la wallet de Cavos: 1 XLM a sí misma, y la misma
  cuenta vuelve a firmar tras cerrar la app (filas 5 y 5b, D-87, D-88).
- **Groth16 se genera en un teléfono:** 9,7 s la primera vez, 1,3 s después, en un moto g54
  Android (fila 1).
- **Un contrato Soroban desplegado verificó una prueba Groth16 real** y la red rechazó una señal
  alterada (D-83).
- **El pago está dentro del recorrido:** la autorización cotiza, la wallet de Cavos paga 1.2 XLM
  al emisor y el emisor consulta solo después de verificar el pago (fila 6, D-90).

Y esto **no** se dice, porque no ha corrido:

- Que la respuesta viaja a otra persona: el verificador corre en el mismo teléfono (D-86).
- Que el iPhone genera la prueba ZK, o que la prueba del teléfono se verificó en cadena: la del
  teléfono es Android y local; la de cadena salió del portátil. Las dos usan llave de desarrollo.
- Modo avión en un dispositivo (A12), o SICAAC, listas, RUNT y SIMIT con consentimiento real.

Un jurado que descubre una afirmación inflada deja de creer las verdaderas.

## Evidencia en testnet

Cada hash, releído con `GET /transactions/{hash}` en `horizon-testnet.stellar.org` el 2026-09-26:
`successful: true` en los siete.

| Qué | Transacción | Origen | Respaldo |
|---|---|---|---|
| Pago de 1 XLM firmado en el iPhone con Cavos | [`d5041412…4232`](https://stellar.expert/explorer/testnet/tx/d5041412c2add8b23b36e86d251027e8c99e3e777c09df129ee2a142be2b4232) · ledger 4875303 | iPhone | fila 5 |
| Pago de 1.2 XLM al emisor dentro del recorrido, la toma del video demo | [`53e6ea60…2724`](https://stellar.expert/explorer/testnet/tx/53e6ea60810e6c585c48a45d4fa095aa73e6bdaffdb3be5f7cec71f3ddd52724) · ledger 4876770 | iPhone | fila 6 |
| Misma cuenta, tras cerrar la app | [`1c07f12e…7127`](https://stellar.expert/explorer/testnet/tx/1c07f12ec292d07fb809f768a0fb1653fe215bee3444a06b5de2ed1de6227127) · ledger 4875857 | iPhone | fila 5b, D-88 |
| El contrato verifica una prueba Groth16 real | [`0db7a479…0191`](https://stellar.expert/explorer/testnet/tx/0db7a4790d02c3277877ef4b9e79b3449004735928cb73b192bc7694003b0191) · ledger 4866679 | portátil | D-83 |
| Pago USDC verificado de vuelta por el emisor | [`fb64700b…36b9`](https://stellar.expert/explorer/testnet/tx/fb64700b55ab1094f00fc60c48990c035976c0938036a47f8084990800b836b9) · ledger 4820808 | portátil | A10 |
| Digest del registro de emisores anclado | [`66bf1b7d…fc49`](https://stellar.expert/explorer/testnet/tx/66bf1b7dffe75e06517389a851f9ecc526b3847e07a13f009c996d943cb4fc49) · ledger 4853052 | portátil | A3 |
| Compromiso cegado como `MEMO_HASH` | [`0dc0fdf4…8161`](https://stellar.expert/explorer/testnet/tx/0dc0fdf46ebffc72257b068fe0022a6b732c6f4b9dda5503aaa8b005f18f8161) · ledger 4783364 | portátil | auditoría 2026-09-20 |

Las filas 5 y 5b de la tabla de teléfono y D-88 entran con el PR #140.

## §1 — Video demo · el producto corriendo en el iPhone

**Grabación: 2:01 (121 s). Video editado: 1:36,4.** La grabación del iPhone del 2026-09-26 (build
EAS `development` + Metro) dura 2:01; la edición quita la escritura del documento y del correo,
la salida a Edge, el selector de apps y el historial repetido, y queda montada por [`build_demo.py`](build_demo.py); el mapa de la fuente, las coordenadas y las reglas de
privacidad están en [`edicion.md`](edicion.md). Sin maquetas: cada cuadro del teléfono es la app
corriendo y va a velocidad real, salvo la espera del código por correo (×2). Cada pantalla dura
al menos 5 s para que el jurado alcance a leerla: una toma más corta sostiene su último cuadro. Documento, correo y
código van cortados o difuminados.

La voz es Nayla (ElevenLabs), una línea por segmento, a ~15 caracteres por segundo, y la misma línea
va quemada como subtítulo. `python design/demo/build_demo.py --plan` imprime esta tabla con la
duración real y falla si una línea no cabe.

| Tiempo | Segmento | Qué se ve | Qué se dice | Respaldo |
|---|---|---|---|---|
| 0:00–0:04 | `titulo` | Tarjeta: *knowni · Stellar testnet · 26/09/2026* | "Una verificación real, en un iPhone." | fila 6 |
| 0:04–0:09 | `intro` | Las tres láminas de introducción | "Para firmar un contrato no hace falta entregar tu expediente." | — |
| 0:09–0:14 | `solicitud` | Nueva solicitud, vence en 10 min; zoom a la tarjeta | "Llega una solicitud firmada, y vence." | README, *Solicitud firmada y anti-replay* |
| 0:14–0:19 | `autoriza` | Fuentes, tipo de documento; campo difuminado | "Tú eliges qué fuentes se consultan." | D-86 |
| 0:19–0:24 | `conectar` | "Conectar wallet para pagar" | "Sin pago, no hay consulta." | D-90, fila 6 |
| 0:24–0:29 | `correo` | Wallet: "Entra con tu correo", campo vacío | "Entras con tu correo." | fila 5 |
| 0:29–0:35.1 | `codigo` | Enviando código, correo y código difuminados (×2) | "Un código por correo, y la llave queda sellada en este iPhone." | D-88, fila 5b |
| 0:35.1–0:40.1 | `fondos` | Wallet con saldo; zoom a la cuenta | "Cuenta de testnet, fondeada con Friendbot." | fila 5b |
| 0:40.1–0:45.1 | `pagar` | "Pagar 1.2 XLM y consultar" | "Una fuente cuesta 1,2 XLM." | D-89, D-90; `issuer/src/pricing.ts` |
| 0:45.1–0:55.1 | `consulta` | Firmando → pago aceptado → Registraduría (tiempo real) | "La wallet firma el pago. El emisor lo verifica en Stellar y solo entonces consulta la Registraduría." | D-90, fila 6 |
| 0:55.1–1:06.9 | `stellar` | Stellar Expert: `53e6ea60…2724`, Successful, 1.2 XLM (tiempo real) | "La transacción está en Stellar testnet: exitosa, 1,2 XLM al emisor." | fila 6; Horizon, abajo |
| 1:06.9–1:11.9 | `recibiran` | "Esto es lo que recibirán": solo documento vigente | "La otra parte recibe una sola respuesta." | D-86; fila *El sobre no filtra ningún valor de los reclamos* |
| 1:11.9–1:16.9 | `enviada` | Confirmar compartir → "Respuesta enviada" | "Confirmas antes de enviar. La respuesta va firmada por el emisor." | D-86 |
| 1:16.9–1:23.4 | `verifica` | Verificador: verificada → "No se puede aceptar" → "Ya recibida" | "En este mismo teléfono se comprueban firma y destinatario. Repetida, se rechaza." | D-86; `app/src/domain/verifier.ts` |
| 1:23.4–1:28.4 | `espacio` | Mi espacio: historial | "Y el historial queda en tu teléfono." | D-86 |
| 1:28.4–1:36.4 | `cierre` | Tarjeta: lo que acabas de ver y lo que falta | "Pago real en testnet, emisor real. Falta la contraparte en otro teléfono." | esta regla |

La frase de `verifica` dice *en este mismo teléfono* a propósito: el rótulo del segmento es *la
contraparte verifica*, y sin esa aclaración la imagen sugeriría la entrega a una segunda persona,
que no ha corrido (D-86).

**Toma opcional, 10 s, si se graba también el moto g54:** `/prueba` generando Groth16 (9,7 s con
descarga, 1,3 s después — fila 1). Se rotula *Android, llave de desarrollo, fuera del recorrido*.
Sin esa toma, la frase no se dice sobre el iPhone.

**Prohibido en pantalla:** número de documento, correo, `.env.local`, `KNOWNI_ISSUER_SEED`,
`CROMA_API_KEY`, cualquier `Authorization: Bearer`, la terminal del emisor, la salida de
`/catalog` y el `git log` con rutas personales.

## §2 — Video pitch · máximo 3 minutos

Un solo hablante. Sin leer. Los números se dicen con su fecha.

**0:00–0:35 · El problema, con nombre.**
Para arrendar en Colombia: cédula, certificación laboral, certificación bancaria, desprendibles.
Para comprar un carro ante notario: cédula, declaración de origen de fondos, certificado de
tradición, paz y salvo de comparendos. La contraparte recibe un dossier completo sobre tu vida, y no
tiene ni la obligación ni la capacidad de protegerlo.

**0:35–1:05 · La tesis, en una frase.**
Demuestra que calificas para firmar, sin decir quién eres. La contraparte no necesita tu nombre;
necesita cuatro respuestas: existe, puede contratar, no tiene una inhabilidad vigente, el activo
está limpio. El tipo de contrato es un **perfil** de la solicitud, no una rama del producto.

**1:05–1:50 · Stellar, y por qué así.**
La credencial se verifica **sin cadena**: firma del emisor, ruta de Merkle y apertura del
compromiso. Stellar entra donde aporta: publica un recibo de 32 bytes —un compromiso cegado— para
auditar que algo se decidió sin aprender qué ni sobre quién; una wallet que vive en el teléfono ya
firma pagos en testnet; y un contrato Soroban desplegado en testnet ya verificó una prueba Groth16 real
y rechazó una señal alterada. Todo eso son transacciones reales, en el Explorer.

**1:50–2:30 · Por qué es creíble.**
El 25 de septiembre el recorrido corrió en un iPhone con una consulta real a la Registraduría, y lo
que la contraparte recibe es una sola respuesta: documento vigente, sí. Un teléfono Android generó la prueba
en 9,7 segundos. Cada cifra lleva fuente y fecha, y lo que el producto se niega a hacer también
está escrito: sin antecedentes penales, sin Sisbén, sin puntaje agregado de confianza. Un dato que
nunca se recoge es un dato que nunca se filtra.

**2:30–3:00 · Qué sigue.**
Que la respuesta viaje a una segunda persona, que la prueba del teléfono se verifique en cadena
con una llave de ceremonia, un piloto con una sola contraparte y una sola jurisdicción, y cobro por
verificación emitida — nunca por vender expedientes.

## Lista previa a grabar

- [ ] **Emisor** en el portátil con `KNOWNI_ISSUER_SEED` fijado; su pública es la de
      `EXPO_PUBLIC_ISSUER_PUBLIC_KEY` en la app (D-86). Sin eso: "emisor desconocido".
- [ ] **Túnel** `knowni-issuer` arriba: `curl -s -o /dev/null -w "%{http_code}" -X POST https://issuer.voltarut.com/quote -d '{}'`
      da un `4xx` del servicio. `502` o `530` es el túnel caído.
- [ ] **Metro** sirviendo una rama que incluye el PR #140 (5b corrió en `feat/cavos-persistent-key`
      `2aa3bef`); el iPhone conectado al dev build y `EXPO_PUBLIC_CAVOS_APP_ID` presente.
- [ ] **Sin secretos:** `.env.local` cerrado, terminal del emisor fuera de cuadro, notificaciones
      del iPhone en *No molestar*, número de documento y correo tapados.
- [ ] **Explorer confirmado:** `0db7a479…` abre y dice `successful`; después de la toma, el hash
      nuevo también, releído con
      `curl -s https://horizon-testnet.stellar.org/transactions/<hash>` → `"successful": true`.
- [ ] **Después de grabar:** el hash nuevo va a `docs/verificacion.md`, tabla de teléfono.

## Lo que falta antes de enviar

1. Demo: generar las 16 líneas de voz de §1 con Nayla, renderizar en local y revisar cuadro a
   cuadro (`edicion.md`, *Lo que falta*). Pitch: grabarlo con §2. La pieza de ElevenLabs ya está renderizada.
2. Confirmar que el historial de git refleja a los contribuyentes declarados.
3. `LICENSE` ya está en la raíz; las bases exigen un archivo de licencia visible.
