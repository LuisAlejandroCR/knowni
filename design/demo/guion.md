<!-- guion.md
     Guion de los dos videos de entrega: el demo del producto corriendo y el pitch de 3 minutos.
     Incluye qué se graba, qué se dice y qué está prohibido afirmar en cámara.
     Se distingue de design/day-08/README.md, que aprueba pantallas, no narración. -->

# Guion de entrega — demo y pitch

Fuente de las reglas: las bases oficiales del evento, consultadas el 2026-09-20. Cuatro entregables
obligatorios, y este archivo cubre dos.

| Entregable | Estado | Dónde |
|---|---|---|
| Repositorio público con README | ⏳ el repositorio sigue **privado** | decisión pendiente del titular |
| Video demo del producto corriendo | ⏳ por grabar | este guion, §1 |
| Video pitch, máximo 3 minutos | ⏳ por grabar | este guion, §2 |
| Evidencia on-chain en testnet | ✅ listo | [`0dc0fdf4…f8161`](https://stellar.expert/explorer/testnet/tx/0dc0fdf46ebffc72257b068fe0022a6b732c6f4b9dda5503aaa8b005f18f8161) |

Los criterios pesan así: funcionalidad y testnet 30 %, integración Stellar 25 %, originalidad 20 %,
viabilidad 15 %, claridad del README y el video 10 %. El guion está ordenado para atacarlos en ese
orden, no en el orden en que se construyó el proyecto.

## Regla que manda sobre todo lo demás

**No se afirma en cámara nada que no corra.** No hay app nativa, no hay prueba ZK verificada y
ninguna fuente se consultó sobre una persona real. Lo que se muestra: la suite corriendo, el
recorrido sin red, la transacción en el Explorer, el catálogo real de Croma y las pantallas como
**diseño**, rotuladas como tales. Un jurado que descubre una afirmación inflada deja de creer las
verdaderas.

## §1 — Video demo · el producto corriendo

Sin límite de duración según las bases, pero se apunta a **3 a 4 minutos**. Todo se graba en
pantalla, en vivo, con la terminal y el navegador reales.

| Tiempo | Qué se ve | Qué se dice |
|---|---|---|
| 0:00–0:20 | Portada del README, en español | "Firmar un contrato en Colombia cuesta un expediente. La contraparte no necesita el expediente: necesita respuestas." |
| 0:20–0:55 | `npm test` corriendo hasta el final | "236 pruebas, sin dependencias externas y sin paso de compilación. Cada afirmación de este repositorio está atada a una de ellas." |
| 0:55–1:40 | `journey/test/offline.test.ts` con el bloque `withoutNetwork` visible | "Aquí `fetch` se reemplaza por algo que lanza. Si alguna ruta buscara la red, la prueba fallaría. El recorrido se completa igual: el wallet verifica, la contraparte acepta." |
| 1:40–2:20 | `node anchoring/tools/anchor-testnet.ts`, luego el Explorer | "Un compromiso real, anclado en Stellar testnet. El memo son 32 bytes: el compromiso cegado, no el resultado. XDR, StrKey y la firma ed25519 escritos a mano — sin SDK." |
| 2:20–2:50 | `journey/test/redaction.test.ts`, la fuente que devuelve el documento en su error | "Los registros colombianos devuelven la cédula dentro de su propio mensaje de error. Esta prueba lo simula y verifica que no llega a ningún log ni resultado." |
| 2:50–3:30 | `screens.html`, pantallas 02, 05 y 08 | "El diseño del recorrido. **Es diseño, no una app nativa**: la pantalla 05 muestra lo que recibe la contraparte y lo que no; la 08 muestra que una fuente caída es *falta una respuesta*, nunca *no cumple*." |
| 3:30–3:50 | Tabla "Qué está construido y qué no" del README | "Y esto es lo que **no** está hecho: no hay app nativa, no hay prueba ZK verificada, ninguna consulta sobre una persona real." |

**Pantallas prohibidas en la grabación:** `.env.local`, cualquier `Authorization: Bearer`, la salida
completa de `/catalog` con la llave en la terminal, y el `git log` con rutas personales.

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
compromiso, todo offline. Stellar entra donde aporta: publica un recibo — 32 bytes, un compromiso
cegado — para que un tercero pueda auditar que algo se decidió sin aprender qué ni sobre quién.
Transacción real en testnet, memo idéntico al compromiso. Y si la red se cae, la verificación sigue
funcionando: eso está probado, no prometido.

**1:50–2:30 · Por qué es creíble.**
Cada cifra lleva fuente y fecha. El catálogo de Croma se consultó en vivo y corrigió tres
afirmaciones nuestras — incluida una fuente que dábamos por inexistente. Lo que el producto se niega
a hacer también está escrito: sin antecedentes penales, sin Sisbén, sin puntaje agregado de
confianza. Un dato que nunca se recoge es un dato que nunca se filtra.

**2:30–3:00 · Qué sigue.**
Cerrar la vía de prueba con presupuesto medido en un teléfono real, un piloto con una sola
contraparte y una sola jurisdicción, y cobro por verificación emitida — nunca por vender
expedientes.

## Lista previa a grabar

- [ ] `npm test` en verde desde un clon limpio, en la misma máquina donde se graba.
- [ ] `.env.local` fuera de pantalla y terminal sin variables de entorno visibles.
- [ ] El enlace del Explorer abre y muestra `successful` antes de empezar a grabar.
- [ ] Cada pantalla de diseño se rotula como diseño, en voz y en pantalla.
- [ ] Ninguna cifra sin fecha; ninguna afirmación sin una prueba que la respalde.
- [ ] Consola del navegador sin errores en `screens.html`.
- [ ] Decidido si el repositorio se hace público — las bases lo exigen, y hoy es privado.

## Lo que falta antes de enviar

1. **Hacer público el repositorio** (requisito de las bases) y revisar antes qué sale con él.
2. Grabar los dos videos con este guion.
3. Confirmar que el historial de git refleja a los contribuyentes declarados.
4. `LICENSE` ya está en la raíz; las bases exigen un archivo de licencia visible.
