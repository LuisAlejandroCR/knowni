<!-- design/demo/edicion.md
     Traspaso de la edición del video demo: mapa de la grabación del iPhone, reglas de privacidad,
     estado de build_demo.py y lo que falta. Se distingue de guion.md, que dice qué se afirma en
     cámara; este archivo dice cómo se corta y monta la grabación que ya existe. -->

# Edición del video demo

## Estado — 2026-09-26

- Grabación cruda: `knowni-media/demo/knowni-ios.MP4`, **fuera del repositorio** (121 s, 1290×2796,
  HEVC 60 fps, audio vacío). Muestra el número de documento y el correo del titular: **nunca se
  sube a git, a la nube ni a un PR**, ni tampoco hojas de contacto o cuadros sacados de ella.
- `build_demo.py` monta un 16:9 1080p: teléfono con marco a la izquierda, titular y subtítulo a la
  derecha, tarjeta de zoom en vivo que entra deslizándose, barra de progreso del recorrido y
  tarjetas de título y cierre. Borra con `delogo` el engranaje de Expo y el círculo de AssistiveTouch.
- **Aún no hay un render válido.** El primero salió con una configuración vieja que dejaba ver el
  teclado numérico resaltando los dígitos del documento; se borró. La configuración actual corta
  esa escritura. Hay que renderizar en local y revisar cuadro a cuadro antes de compartir.
- Transacción de esta toma: `53e6ea60810e6c585c48a45d4fa095aa73e6bdaffdb3be5f7cec71f3ddd52724`
  (ledger 4876770, 1.2 XLM de `GDCI23MF…VWWT` a la tesorería `GD4XN7C5…MP7VS3`), comprobada en
  Horizon con `successful: true` y anotada por el emisor como pago gastado.

## Mapa de la grabación (segundos de la fuente)

| Fuente | Qué se ve | Sensible | En la edición |
|---|---|---|---|
| 0.0–4.8 | Introducción: tres láminas | — | `intro` 0,2–4,8 |
| 5.0–8.0 | Nueva solicitud, vence en 10 min | — | `solicitud`, zoom a la tarjeta |
| 8.0–11.9 | Autorización: fuentes, tipo de documento, ejemplo `1020304050` | — | `autoriza` |
| **12.0–16.3** | **Teclado numérico: se escribe el documento, cada tecla se resalta** | **documento** | **cortado** |
| 16.3–17.9 | Documento completo, botón "Conectar wallet para pagar" | documento | `conectar` desde 16.7, pausa hasta 5 s, campo difuminado |
| 18.0–18.7 | Wallet: "Entra con tu correo", campo vacío | — | `correo`, pausa hasta 5 s |
| **18.7–36.0** | **Se escribe el correo; el teclado agranda cada letra** | **correo** | **cortado** |
| 36.2–48.4 | Enviando, "Lo enviamos a <correo>", código `751047` | correo, código | `codigo` ×2, línea y campo difuminados |
| 48.6–51.6 | Wallet con saldo, "Volver a tu autorización" | — (dirección pública) | `fondos`, zoom a la cuenta |
| 52.3–55.0 | Autorización: "Pagar 1.2 XLM y consultar" | documento | `pagar`, campo difuminado |
| 55.0–65.0 | Consultando: firmando → pago aceptado → Registraduría | — | `consulta`, zoom a las tarjetas |
| 65.0–70.9 | Salida a Edge, Face ID, pestaña vieja `3c1bdad5…` | — | cortado |
| 71.0–83.0 | Stellar Expert: `53e6ea60…`, Successful, sent 1.2 XLM | — | `stellar` 71–82,8, sin zoom (la página se desplaza) |
| 83.0–85.2 | Selector de apps | — | cortado |
| 85.3–87.9 | "Esto es lo que recibirán": solo documento vigente | — | `recibiran`, zoom |
| 88.0–93.0 | Confirmar compartir → "Respuesta enviada" | — | `enviada` |
| 94.0–100.5 | Verificador: verificada → "No se puede aceptar" (reuso) → "Ya recibida" | — | `verifica`, zoom |
| 101–107 | Vuelta a revisión y verificador | — | cortado |
| 108.0–111.0 | Mi espacio: historial | — | `espacio` |
| 111–121 | Más historial, Inicio | — | cortado |

Coordenadas en píxeles de la fuente (1290×2796), medidas sobre cuadros con cuadrícula:
campo del documento listo `y 2175–2310`, campo de correo/código `y 924–1071`, línea "Lo enviamos a"
`y 729–780`, engranaje `1085,440,160×155`, círculo `1075,770,190×190`.

## Reglas

1. Ningún cuadro con dígitos del documento, letras del correo o el código. Si una transición
   desliza el campo, la caja de desenfoque llega al borde derecho.
2. Cada frase en pantalla o en la voz corresponde a lo que se ve y a una fila de
   `docs/verificacion.md` (filas 5, 5b y 6) o a una decisión (D-86 a D-90). Nada que no corrió.
3. La voz es Nayla (ElevenLabs), la misma del pitch. Los audios viven en `knowni-media/`, no aquí.

## Voz y subtítulos

Cada segmento de `SEGMENTS` (y las dos tarjetas) lleva su línea en `voice`; el texto y su respaldo
están en `guion.md` §1. `build_demo.py`:

- quema la línea como subtítulo bajo la tarjeta de zoom, desde 0,2 s hasta 0,2 s antes del corte;
- mezcla `knowni-media/demo/voz/<segmento>.wav|mp3|m4a` si existe, con 0,2 s de entrada; si falta,
  el segmento queda en silencio y el subtítulo sigue;
- antes de renderizar comprueba que cada voz cabe (el audio real si existe, si no ~15 caracteres
  por segundo) y se detiene si una no cabe. `--plan` hace solo esa comprobación.

Ritmo para el jurado: todo va a velocidad real salvo `codigo` (×2, espera del código con el
campo difuminado), y cada segmento dura al menos `MIN_DUR` = 5 s; una toma más corta sostiene su
último cuadro con `tpad`, ya difuminado, porque el desenfoque se aplica antes. `stellar` usa
71,0–82,8 para dejar leer la página entera. Tarjetas: 4 s el título, 8 s el cierre. Total: 96,4 s
(1:36). El pipeline completo —blur, zoom, pausa, subtítulos, voz y concat— se ejecutó el 2026-09-26
contra una fuente sintética (`testsrc2` a 1290×2796, sin datos personales): 96,4 s, video y audio
estéreo a 48 kHz, y el cuadro sostenido de `conectar` conserva el desenfoque.

## Lo que falta

1. **Voz**: generar con Nayla las 16 líneas de `guion.md` §1, una por archivo
   (`knowni-media/demo/voz/<segmento>.mp3`) o todas en un audio, `voz/narracion.mp3`. El audio
   único se corta con `python design/demo/build_demo.py --split-voice`: toma las 15 pausas más
   largas como límites entre líneas, escribe `voz/<segmento>.wav` e imprime cada trozo con su
   frase para comprobar que coinciden. Probado con una narración sintética de 63 s y una pausa
   dentro de la línea de `consulta`: 16 trozos correctos. La voz dura menos que el video (1:03
   contra 1:36) y así debe ser: cada frase empieza con su pantalla y el resto es imagen.
2. **Render local y revisión** (solo en la máquina del titular):
   `python design/demo/build_demo.py`, luego extraer un cuadro cada 0,25 s de `codigo`, `conectar`,
   `correo` y `pagar` y confirmar que no se lee nada sensible, incluido el cuadro sostenido del final.
3. Registrar el resultado (duración, fecha) en la tabla de entregables de `guion.md`.
