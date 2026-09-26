<!-- elevenlabs-mcp.md
     Prompt para generar la pieza de video de Knowni con el MCP de ElevenLabs, que sirve a la vez
     para el Challenge 3 de ElevenLabs y dentro del pitch de Stellar Odyssey, al día 2026-09-25.
     Se distingue de guion.md, que es el guion del demo grabado en pantalla y del pitch en vivo. -->

# Prompt ganador para ElevenLabs MCP

## Qué está construido y qué no — 2026-09-26

Lo que se puede afirmar, con su evidencia en `docs/verificacion.md` (cada hash releído en Horizon
el 2026-09-26):

* **El recorrido corrió en un iPhone físico** (build de desarrollo): la persona eligió Registraduría,
  el emisor real consultó vía Croma su propio documento con consentimiento, firmó la respuesta, y el
  verificador en el mismo teléfono la aceptó: "Respuestas verificadas" (D-86).
* **La contraparte solo recibe la respuesta mínima**: "Documento vigente: Sí". Ni nombre, ni número,
  ni expediente.
* **El iPhone firma sus propias transacciones**: la wallet de Cavos se pagó 1 XLM en testnet
  (`d5041412…`), y la misma cuenta volvió a firmar tras cerrar la app (`1c07f12e…`) — filas 5 y 5b,
  D-87, D-88.
* **Un teléfono genera la prueba Groth16**: 9,7 s la primera vez, 1,3 s después, en un moto g54
  Android, con llave de desarrollo (fila 1).
* **Stellar testnet, con evidencia real**:
  * un pago USDC aceptado y verificado de vuelta por el emisor (`fb64700b…`);
  * compromisos anclados como `MEMO_HASH` y leídos de vuelta desde Horizon (`0dc0fdf4…`, `66bf1b7d…`);
  * un **contrato Soroban desplegado** (`CAGZRVSL…L3O6U`) que **verificó una prueba Groth16 real**
    en la red, y rechazó una señal alterada (`0db7a479…`, D-83).
* La lógica móvil, la privacidad, el recorrido sin red y la redacción están cubiertos por pruebas
  automatizadas.

Lo que todavía **no** se puede afirmar:

* La contraparte en otro dispositivo: hoy el verificador corre en el mismo teléfono, y la entrega y
  el acuse todavía no viajan entre dos personas.
* El pago dentro del recorrido: el iPhone firma en el banco `/firma`, no al pedir la emisión.
* La prueba generada en el iPhone, o la del teléfono verificada en cadena: la del teléfono es
  Android y local; la que verificó el contrato salió del portátil. Ninguna con llave de ceremonia.
* Modo avión en un dispositivo físico.
* SICAAC, listas, RUNT y SIMIT consultados con consentimiento real: solo Registraduría lo fue.

Por eso el pitch dice: **"el recorrido ya corrió en un teléfono con datos reales, el teléfono ya
firma en Stellar testnet, y un contrato ya verificó una prueba real"**, y no "todo ya funciona entre
dos personas".

**Nota sobre el prompt de abajo.** Se escribió el 2026-09-25 y trata como pendientes la
transacción firmada en el teléfono y la prueba generada en el teléfono. Subestimar no es mentir: si
la pieza ya se generó, sirve. Si se regenera, esas dos salen de la escena 6 y entran a la 5, y la
prueba se dice "en un teléfono", no "en el iPhone".

Las dos competencias, separadas:

* **Stellar Odyssey:** pitch máximo 3 minutos, demo real separada y evidencia on-chain.
* **ElevenLabs Challenge:** una pieza creativa terminada, y todo elemento generado con IA debe venir
  exclusivamente de ElevenLabs. No reutilices las imágenes generadas para el PR en esa entrada. Una
  grabación de pantalla real de la app no es contenido generado, pero para la entrada de ElevenLabs
  es más seguro dejarla fuera y usarla solo en el pitch de Stellar.

## El prompt

Pega esto completo en el MCP:

```
Create a finished cinematic video for Knowni using only ElevenLabs MCP tools.

This piece will be entered in "Challenge 3: MCP" and may also appear inside a Stellar hackathon pitch.

IMPORTANT COMPLIANCE RULE
Every AI-generated element must be created through ElevenLabs:
voice, music, sound design, images, motion, transitions and video.
Do not use assets generated with any other AI product.
Do not invent product evidence or imply that untested features already work.
What is true today: the journey ran on a physical iPhone with a real registry query,
and a Soroban contract on Stellar testnet verified a real zero-knowledge proof.
What is not yet true: a second person on a second phone, a transaction originated
from the phone, and a proof generated on the phone.

DELIVERABLES
1. Main cinematic film: 16:9, 4K if available, 75–85 seconds.
2. Social version: 9:16.
3. Spanish Latin American voiceover.
4. Burned-in English subtitles.
5. English SRT file.
6. Spanish transcript.
7. Separate WAV files for voice, music and sound effects.
8. A 30-second cut.
9. A clean version without burned-in subtitles.

CORE IDEA
Knowni turns sensitive documents into minimal, verifiable answers.

TAGLINE
Demuestra lo necesario. Nada más.
Prove what matters. Nothing more.

VOICE
Use a contemporary Colombian or neutral Latin American voice.
Warm, intimate and intelligent.
The performance begins quietly, develops urgency and ends with conviction.
It must sound human and visionary, never like a corporate advertisement.

VISUAL LANGUAGE
Cinematic privacy technology.
Deep forest green, soft lime, warm white and restrained amber.
Glass, physical paper, light particles and tactile mobile interfaces.
Use constant purposeful movement.
Images and transformations must communicate more than text.

Avoid:
- blue cybersecurity clichés
- hooded hackers
- generic padlocks
- binary code
- biometric face scanning
- readable personal documents
- real identity numbers
- real license plates
- fake product screens presented as working software

SUBTITLE STYLE
English subtitles must be permanently burned into the video.
Use no more than two lines at once.
Large warm-white sans-serif typography.
Highlight only one important word per sequence in soft lime.
Keep subtitles inside safe margins for both 16:9 and 9:16.
Time subtitles to ideas rather than translating word by word.

MUSIC
Compose an original electronic-organic score.
Begin with paper, breath and a restrained low pulse.
Introduce subtle Latin American percussion during the Colombia sequence.
Build toward a hopeful, expansive final movement.
No heroic trailer clichés.
Music must remain below the narration.

SCENE 1 — THE COST OF PROVING
TIME: 00:00–00:09

VISUAL:
A human figure stands in a dark green architectural space.
Forms, certificates and folders multiply around them.
The papers begin covering the person and blocking the path.
No personal information is legible.

SPANISH VOICEOVER:
"Para demostrar una sola cosa…
todavía entregamos nuestra vida entera."

ENGLISH SUBTITLE:
"To prove one thing,
we still surrender our entire lives."

SOUND:
Close paper movement, a breath and one deep pulse.

SCENE 2 — THE QUESTION CHANGES
TIME: 00:09–00:19

VISUAL:
A phone emerges from the darkness.
The documents move toward it, dissolve into particles and disappear inside.
Only four luminous answers emerge:
identity valid, can sign, vehicle matches, data protected.

SPANISH VOICEOVER:
"Knowni cambia la pregunta.
No pide ver todos tus documentos.
Pregunta únicamente qué necesita comprobar."

ENGLISH SUBTITLE:
"Knowni changes the question.
It asks only what must be proven."

ON-SCREEN TITLE:
PROVE WHAT MATTERS.
NOTHING MORE.

SCENE 3 — COLOMBIA, THE FIRST STORY
TIME: 00:19–00:36

VISUAL:
A contemporary Colombian city without tourist clichés.
A buyer and seller meet beside a vehicle.
The other party sends a verification request.
The request reaches a clean mobile interface.
The person chooses which sources to authorize and gives consent.
The purpose shown follows what was authorized: an identity check,
or a vehicle sale when the vehicle registry is included.
Present it as the product experience, not as footage of the real app.

SPANISH VOICEOVER:
"Empezamos en Colombia.
En la compraventa de un vehículo,
la contraparte pregunta solo lo indispensable.
La persona decide qué demostrar."

ENGLISH SUBTITLE:
"We begin in Colombia.
The person decides what to prove."

SCENE 4 — ANSWERS, NOT DOCUMENTS
TIME: 00:36–00:48

VISUAL:
A complete identity document attempts to cross from the phone to the other party.
A soft boundary stops it.
The document returns to the person.
Only minimal answer tokens cross the boundary.
One of them reads, in abstract form: document valid — yes.

SPANISH VOICEOVER:
"La contraparte recibe respuestas verificables.
No recibe tu cédula.
No recibe tu expediente.
No recibe todo lo demás."

ENGLISH SUBTITLE:
"The other party receives verifiable answers.
Not your documents. Not your life."

ON-SCREEN TITLE:
ANSWERS, NOT DOCUMENTS.

SCENE 5 — REAL EVIDENCE
TIME: 00:48–01:01

VISUAL:
The answer tokens become receipts.
Show abstract representations of consent, source, integrity and result.
A single phone in a person's hand receives a real signed answer and a quiet green check.
Then a Stellar testnet constellation or ledger visual:
a sealed proof travels into a contract and is accepted;
an altered version of the same proof is rejected.
Do not show a transaction originating from the phone.
Do not show a second phone receiving the answer.

SPANISH VOICEOVER:
"Y esto no es solo una idea.
Knowni ya corrió en un teléfono real,
con una consulta real a la Registraduría.
Y en Stellar testnet, un contrato ya verificó
una prueba de conocimiento cero real."

ENGLISH SUBTITLE:
"This is more than an idea.
It ran on a real phone, with a real registry query.
On Stellar testnet, a contract verified a real zero-knowledge proof."

SMALL ON-SCREEN DISCLOSURE:
"Physical iPhone, real registry query, verified on the same device.
Testnet transactions sent from the development machine."

SCENE 6 — HONEST ENGINEERING
TIME: 01:01–01:10

VISUAL:
The cinematic world briefly becomes a transparent construction space.
Three components remain visibly unfinished:
a second person on a second phone, a transaction signed from the phone,
and a proof generated on the phone itself.
They should look like the next stage of a living system, not a failure.

SPANISH VOICEOVER:
"Que la respuesta viaje a otra persona,
que el teléfono firme su propia transacción
y genere su propia prueba:
ese es nuestro siguiente paso.
No fingimos lo que aún no hemos probado."

ENGLISH SUBTITLE:
"Two phones, a phone-signed transaction, an on-device proof: that comes next.
We do not fake what we have not proven."

SCENE 7 — FROM COLOMBIA OUTWARD
TIME: 01:10–01:21

VISUAL:
A point of light begins in Colombia.
It expands through Latin America.
The map transforms into a global network of private verification paths.
Finish with a person holding their phone while only four minimal answers orbit it.

SPANISH VOICEOVER:
"Nacemos en Colombia.
Escalamos por Latinoamérica.
Porque la privacidad…
es global por diseño."

ENGLISH SUBTITLE:
"Born in Colombia.
Built for Latin America.
Global by design."

SCENE 8 — FINAL IMPACT
TIME: 01:21–01:25

VISUAL:
Dark forest-green background.
Knowni wordmark appears.
A sealed luminous answer travels across the screen.
Everything else remains protected behind the person.

SPANISH VOICEOVER:
"Knowni.
Demuestra lo necesario.
Nada más."

ENGLISH SUBTITLE:
"Knowni.
Prove what matters.
Nothing more."

FINAL FRAME:
KNOWNI

COLOMBIA → LATAM → GLOBAL

Privacy you can actually use.

FINAL QUALITY CHECK
Before exporting:
- confirm every generated element came from ElevenLabs MCP
- confirm English subtitles match the intended meaning
- confirm no claim says two people exchanged the answer on two phones
- confirm no claim says the phone signed a transaction or generated the proof
- confirm the Stellar statement refers to real testnet evidence and the deployed contract
- confirm no private or fabricated personal data appears
- confirm the result feels like one finished film, not a slideshow
```

## Cómo mostrar el teléfono sin mentir

Ahora se puede enseñar, **en el pitch de Stellar** (grabación real, no generada):

* El recorrido en el iPhone: solicitud, elección de fuentes, tipo de documento, consulta real.
* La revisión: la contraparte recibe solo "Documento vigente: Sí".
* El verificador en el mismo teléfono: "Respuestas verificadas".
* La finalidad que sigue al consentimiento y la hora real de compartir.
* El banco `/firma`: Cavos firma 1 XLM en el iPhone y el hash abre en el Explorer.
* Código y pruebas que sostienen el comportamiento.

El orden y el texto exacto están en [`guion.md`](guion.md), §1.

**Nunca muestres tu número de documento ni tu correo en pantalla**: tápalos al grabar.

Placa breve sobre esa grabación:
"Real query on a physical iPhone. The counterparty runs on the same device; two-device delivery pending."

Para la evidencia on-chain, muestra el Explorer real
(<https://stellar.expert/explorer/testnet/tx/0db7a4790d02c3277877ef4b9e79b3449004735928cb73b192bc7694003b0191>)
y di:
"A Soroban contract on Stellar testnet has already verified a real zero-knowledge proof, the
journey has already run on a physical phone with a real registry query, and the phone already signs
its own testnet payments. The remaining milestone is a second person receiving the answer."

Eso es más potente que exagerar: demuestra que sabes exactamente qué está construido, qué fue
probado y cuál es el siguiente salto.

## Para el agente que lo construya

1. Ejecuta el prompt en el MCP de ElevenLabs tal cual; si una escena no sale, ajusta la imagen, no las afirmaciones.
2. Revisa el *FINAL QUALITY CHECK* contra el bloque *Qué está construido* de arriba antes de exportar.
3. Guarda los entregables fuera del repositorio (los videos pesan) y enlázalos desde `design/demo/guion.md`.
4. Si algo de *Lo que todavía no* se cierra antes de grabar, actualiza primero `docs/verificacion.md` y luego este prompt.
