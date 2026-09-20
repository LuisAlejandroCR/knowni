<!-- qa.md
     Handoff de QA y evidencia requerida para cerrar día 8 y preparar día 9.
     Se distingue de README.md, que sirve para aprobar el diseño. -->
# QA — no confundir captura con producto

## Matriz de aceptación

| Escenario | Resultado observable |
|---|---|
| Solicitud desconocida, alterada o de otra audiencia | No consulta ni presenta; identifica el problema |
| Solicitud vence durante revisión | Bloquea envío y permite solicitar otra |
| Consentimiento omitido/cancelado | Cero llamadas para esa fuente |
| Fuente sin respuesta | Pantalla 08; nunca resultado negativo |
| Evidencia de resultado negativo | Estado diferente de error técnico; alcance y corrección |
| Emisor desconocido, firma inválida, reclamo alterado | No llega a “verificado” |
| Resultado del Disclosure alterado | Rechazo antes de consumo |
| Doble toque/replay/concurrencia | Máximo una aceptación, acuse idempotente |
| Sin acuse tras enviar | “No pudimos confirmar”, no “Enviada” |
| Revocación sin información reciente | Muestra incertidumbre y política aplicada |
| Caída de blockchain | No bloquea validación permitida por política |
| Inspección del payload recibido | No claims crudos, salt, identificadores persistentes |
| Texto al 200%, lector de pantalla, teclado | Sin CTA inaccesible ni contenido oculto |
| Reinicio o navegación hacia atrás | No duplica consulta ni presentación |

Las capturas de HTML verifican disposición visual de 390 × 844 CSS px, no una build móvil.
Probar después 360 px, tamaños grandes, safe areas y teclado nativos. Acciones ≥48 dp,
contraste AA, foco y anuncios de estado. No basar éxito solo en color o animación.

## Día 9

Dispositivo físico: emitir con autorización, almacenar de forma segura, modo avión, abrir app,
revisar solicitud previamente recibida, construir presentación si el protocolo lo permite,
transportarla por canal definido y verificar con política explícita de frescura. Sin transporte
disponible, “lista para compartir” no equivale a “recibida”. Documentar plataforma, build y logs
sanitizados. Probar también evidencia vencida, caché ausente y raíz revocada conocida.

## Verificación de esta entrega

Reejecutar `npm test`, `git diff --check`, enlaces Markdown locales y ocho capturas. Revisar
superposición de contenido/footer. El repositorio no declara scripts build/lint/typecheck:
reportarlos como no disponibles, no PASS. No se ha ejecutado app en dispositivo físico.
Engram no está disponible en herramientas de esta sesión; codegraph sí fue inicializado,
y sus datos generados están ignorados. No guardar secretos ni datos personales en memoria.
