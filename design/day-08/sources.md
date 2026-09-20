<!-- sources.md
     Handoff de fuentes y consentimiento para la emisión móvil.
     Se distingue de protocol.md: cubre consultas autorizadas, no presentaciones. -->
# Agente sources — contrato de emisión

Dueño: `sources/`. Mantener proveedor en backend, nunca dentro de app. Ninguna consulta desde
sesión del verificador. Leer catálogo/fixtures vigentes; no deducir campos de la maqueta.

Entregar manifiesto por consulta: autoridad, proveedor, campos estrictamente necesarios,
finalidad, destinatarios del dato, retención, vigencia y explicación del resultado. Registrar
consentimiento antes de enviar; sin preselección. La política real de retención necesita
confirmación contractual, no una promesa “se borra al instante” inventada por UI.

Desagrupar las listas de la pantalla 03 en su detalle: una autorización no debe ocultar qué
autoridades serán consultadas. Subformulario accesible, datos sensibles en memoria durante
emisión, sin URL/log/analytics ni foto de cédula. No consultar automáticamente al abrir app.

Separar transport failure, degraded, not_found y resultado negativo. Solo la semántica
documentada del adapter permite interpretar ausencia de coincidencias; un 404 de transporte
no prueba ausencia de registro. Timeout nunca produce false. Reintentar solo pendiente,
con autorización vigente e idempotencia donde exista soporte; avisar si requiere nueva consulta.

SICAAC se rotula por el alcance del registro; no concluir capacidad jurídica universal.
El perfil vehicular no consulta solvencia, ADRES ni RUAF por defecto. Si otro perfil los añade,
afiliación no es ingreso ni historial de aportes. Se mantienen exclusiones de AGENTS.md.

Entregar fixtures sintéticas claras para cada estado y manifest de UI con campos mínimos.
Una fuente sobre persona no está verificada en vivo por tener catálogo u OpenAPI: requiere
titular autorizado y bitácora sanitizada. No hacer esas llamadas para probar estos diseños.
