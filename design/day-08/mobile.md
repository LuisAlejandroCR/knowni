<!-- mobile.md
     Handoff del agente mobile: interfaz, navegación y criterios de UI.
     Se distingue de protocol.md: no autoriza cambios al dominio. -->
# Agente mobile — día 8

## Alcance y orden

Dueño: `app/`. Consumir contratos publicados; pedir cambios de tipos al dueño de core.
Crear React Native + Expo development build tras confirmar documentación vigente y versiones.
No convertir `screens.html` en WebView: es referencia visual, no arquitectura ni PWA final.

Implementar 01 → 02 → 03 → 04 → 05 → 06; 08 es rama de emisión. 07 pertenece al rol verificador,
no habilitar un cambio de rol que conceda permisos. Entrada de solicitud por enlace/QR validado;
no incrustar documento, token persistente ni reclamos en URL. Reusar credenciales vigentes permite
02 → 05 sin nuevas consultas. Si no hay credenciales, obtener entradas mínimas en subformulario
de 03 antes de la emisión; mapa exacto definido por sources, nunca foto de cédula.

## Componentes y tokens

| Token | Valor objetivo |
|---|---|
| Fondo / texto | `#FAFBF7` / `#182C29` |
| Acción principal | `#193E36`, texto blanco |
| Acento | `#DCEDB0`; no usar texto claro encima |
| Advertencia | `#FFF4DD`, texto oscuro e icono |
| Radios | tarjeta 18, botón 14, badge 20 |
| Espaciado | 4, 8, 12, 16, 24, 32 |
| Tipografía | sistema iOS/Android; título 29–32, cuerpo 16, secundario 14 |

`RequestHeader`, `PredicateRow`, `SourceConsent`, `DisclosurePreview`, `StatusNotice`,
`PrimaryAction`, `CredentialCard`. Los tamaños compactos del mockup no sustituyen Dynamic Type.
Safe areas reales, ScrollView y footer sin superposición; targets ≥48 dp; texto ampliado a 200%;
VoiceOver/TalkBack, foco en errores, reducción de movimiento. Estado mediante texto e icono,
no solo color. Confirmar contraste WCAG AA. No usar glifos Unicode como iconos finales.

## Estado y acciones

`request_received → validated → needs_issuance | ready → consented → issuing → ready →
reviewing → sending → acknowledged`. Mantener `cancelled`, `expired`, `degraded`, `failed`,
`invalid_request`, `delivery_unknown` como ramas, no como resultados negativos.

Mostrar nombre del destinatario solo desde registro confiable, no desde texto arbitrario del QR.
Invalidar revisión si cambian audiencia, reto, finalidad, parámetros o expiración. Verificar de
nuevo antes de enviar. No gastar nullifier al previsualizar. Doble toque no duplica entrega.
No mostrar “Enviada” hasta acuse; timeout = “No pudimos confirmar la entrega”.

Consentimiento granular sin preselección, cancelación accesible, detalle de cada autoridad/lista
y retención. Omisión de evidencia requerida bloquea el envío completo sin coaccionar consentimiento.
Credenciales revocadas/vencidas: renovar con nueva autorización. Sin red: conservar navegación;
emisión nueva exige red; presentación offline depende de material válido y transporte disponible.

## Integración bloqueada

No importar módulos Node de attestation directamente en Expo. Solicitar puerto criptográfico
compatible y probar nativo. Ninguna llave privada de emisor ni CROMA_API_KEY en app. Secretos del
titular en almacén seguro, no AsyncStorage; política de backup/borrado explícita. No loguear entrada.
Datos demo en módulo aislado con badge persistente; nunca fallback silencioso a éxito simulado.
No habilitar envío real hasta pasar protocol.md. No crear “proof” criptográfico en UI.

## Entrega

Capturas Android/iOS de 01–08, tests de navegación/estados, build reproducible y lista de pendientes.
Registrar evidencia en docs/verificacion.md mediante coordinación con el dueño de documentación.
