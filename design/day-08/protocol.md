<!-- protocol.md
     Handoff de core y attestation para cerrar la promesa de privacidad.
     Se distingue de mobile.md: estos son bloqueos del protocolo, no de diseño. -->
# Core / attestation — bloqueos antes del envío real

Revisión estática sobre `3aaee68`; no auditoría exhaustiva. Coordinar propiedad de `attestation/`,
ausente del reparto actual en AGENTS.md, antes de editarlo. Mobile no cambia estos tipos.

## P0 — el transporte atestado entrega el reclamo

`attestation/src/types.ts: AttestedCredential` incluye `claim` y `salt`.
`verifyCredential` necesita ambos para abrir el compromiso. Una pantalla que oculta esos datos
no evita que la contraparte los reciba. Una credencial income lleva `monthlyMinor`; otras llevan
`subjectRef` y detalles adicionales. El test de no divulgación del sobre no prueba privacidad E2E.

Decidir explícitamente: atestación firmada de resultados mínimos vinculados a solicitud (con
emisor que ve la evidencia y límites de privacidad documentados), o prueba de predicado que
realmente oculte testigo. No presentar la primera como ZK ni prometer no correlación universal.
La primera puede necesitar emisión específica por solicitud y no satisface automáticamente
generación offline de nuevos umbrales. Documentar ese tradeoff, no resolverlo con una etiqueta.

## P0 — aceptación no valida evidencia

`attestation/src/presentation.ts: acceptPresentation` valida vínculo de sesión y nullifier,
pero no verifica una credencial o prueba ni autentica todos los resultados del Disclosure.
Crear orquestación que valide petición, emisor, firma/prueba, política, frescura, revocación,
binding de holder y resultados antes de aceptar y consumir. Cambiar un resultado sin cambiar
sessionId debe fallar. El set en memoria no da persistencia ni atomicidad entre procesos.
El consumo en producción necesita transacción atómica e idempotencia, posterior a validación.

## P1 — contrato del perfil y frescura

`core/src/disclosure.ts` aún entrega solvency/formality/standing, no capacity/assetStanding.
Versionar contrato de resultados basado en perfil, con alcance y límites, sin inventar en UI
campos que no están autenticados. La contraparte debe saber qué consulta describe cada respuesta.
Separar desconocido de false; no usar outcomeOf para pintar estados porque reduce unavailable.

`IssuerRegistry.isRevoked` devuelve boolean opcional: falta representar estado desconocido,
fecha de snapshot y política de frescura. Offline puede validar firma sin demostrar revocación
actual. No tratar ausencia de datos como certeza de “vigente”; tampoco como “revocado”.

## Aceptación

- Payload de red no contiene claim, salt, subjectRef estable ni valores económicos crudos.
- Tampering de resultados, audiencia, propósito, reto o parámetros no consume nullifier.
- Reuso concurrente y reinicio del verificador no permiten segunda aceptación.
- Revocación desconocida produce estado explícito según política, no éxito silencioso.
- Mismo flujo sin anclaje; Stellar es recibo opcional, no paso obligatorio de consentimiento.

Probar Node y runtime nativo tras abstraer `node:crypto`/Buffer; imports sin dependencias externas
no son portabilidad móvil. Documentar formatos y vectores interoperables antes de entregar a mobile.
