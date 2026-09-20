<!-- README.md
     Índice de la propuesta visual del día 8 y decisiones por aprobar.
     Se distingue de los handoffs, que asignan implementación y pruebas. -->
# Día 8 — Respuestas, no expedientes

Revisión sobre `origin/main` en `3aaee68`, consultado el 2026-09-20.
Estado: **propuesta visual para decisión**, no app nativa ni evidencia de privacidad implementada.

## Ver y decidir

Abrir `screens.html` en navegador; `?screen=1` hasta `?screen=8` muestra cada marco.
Las capturas `screen-01.png` a `screen-08.png` corresponden a marcos CSS de 390 × 844.
No hay fuentes externas, telemetría, claves, consultas ni datos de personas reales.
Los enlaces son navegación de demostración; checks y detalles no son controles funcionales.

Recomendación: aprobar la dirección **clara / verde profundo / control del titular**.
Sin estética de exchange, balance, selector de red ni una calificación humana agregada.
La cadena es opcional en el detalle técnico. El perfil cambia preguntas, no navegación.

| Pantalla | Propósito | Captura |
|---|---|---|
| 01 Inicio | Credenciales y solicitudes, no identidad pública | [01](screen-01.png) |
| 02 Solicitud | Destinatario, finalidad, preguntas, vencimiento | [02](screen-02.png) |
| 03 Consentimiento | Consultar separado de compartir | [03](screen-03.png) |
| 04 Emisión | Progreso por fuente sin porcentajes inventados | [04](screen-04.png) |
| 05 Revisión | Vista previa de la respuesta mínima | [05](screen-05.png) |
| 06 Acuse | Envío confirmado, no firma de contrato | [06](screen-06.png) |
| 07 Verificador | Integridad, alcance y frescura sin expediente | [07](screen-07.png) |
| 08 Degradación | Falta evidencia, no juicio negativo | [08](screen-08.png) |

## Handoff por agente

1. [Mobile](mobile.md): flujo, componentes, accesibilidad y tokens.
2. [Core / attestation](protocol.md): bloqueos antes de compartir datos reales.
3. [Sources](sources.md): consentimiento e información necesaria por fuente.
4. [QA](qa.md): matriz de aceptación, seguridad y dispositivo físico.

Estos archivos están listos para entregar a los agentes; **no se han enviado a otras tareas**.
La carpeta `design/` evita que el handoff quede oculto por la regla `docs/*` del repositorio.

## Cambios recientes y límites observados

Días 5–7 añadieron anclaje testnet, atestación offline y solicitud firmada con replay guard.
`app/` y `docs/MOBILE.md` no existen en este checkout. No es correcto asumir que TypeScript
sin dependencias funciona en React Native: attestation importa `node:crypto` y utiliza Buffer.

`AttestedCredential` incluye `claim`, `salt` y prueba de inclusión; puede entregar valores
como `monthlyMinor` y una referencia del sujeto. El invariante de `Disclosure` no cubre ese
transporte. `acceptPresentation` verifica el vínculo de sesión y replay, no la evidencia de
los resultados. `Disclosure` aún no tiene `capacity` ni `assetStanding`.

No prometer “ningún dato sale del teléfono”: durante emisión el proveedor necesita datos de
consulta. Tampoco prometer no correlación por ocultar un nombre, ni estado de revocación actual
solo porque una firma valida sin conexión. No inferir capacidad jurídica universal de SICAAC.
Las pantallas reflejan objetivos y rotulan la simulación; envío real bloqueado.

## Decisión solicitada

Aprobar o ajustar **estilo visual**, **orden del recorrido** y **pantalla 05 de revisión**.
Después: implementar shell móvil con fixtures explícitas y cerrar el protocolo en paralelo,
sin confundir el shell con la integración real ni marcar el día 8 completo por estas capturas.
