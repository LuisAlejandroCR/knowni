<!-- docs/plan.md
     Plan ejecutable de Knowni: alcance, fuentes, arquitectura agnóstica a cadena,
     fases y criterios de aceptación. Se distingue de memoria.md, que conserva
     decisiones, y de ROADMAP.md, que resume el orden y los riesgos principales. -->

# Plan

## Norte del producto

> **Demuestra que calificas para firmar, sin decir quién eres.**

Knowni no es un buscador de personas ni una central de riesgo. Es una infraestructura de
credenciales de predicados:

1. la persona autoriza una consulta para una finalidad concreta;
2. un emisor transforma evidencia en el reclamo mínimo necesario;
3. la persona conserva la credencial;
4. presenta solo una respuesta verificable a la contraparte; y
5. ninguna contraparte obtiene acceso a la fuente ni al expediente original.

El producto debe servir para arriendos, compraventas, poderes, garantías y contratos B2B sin que
el dominio conozca esos nombres. Un **perfil de verificación** compone predicados y fija umbrales;
no introduce lógica nueva en `core/`.

## Decisión de arquitectura: chain-agnostic de verdad

La credencial y su verificación deben funcionar aunque no exista una blockchain disponible.
Una cadena puede publicar raíces de emisores, estados de revocación o recibos de auditoría, pero
no es la autoridad sobre el dato ni el lugar donde vive la identidad.

```text
fuente ─► adaptador ─► emisor ─► credencial mínima ─► wallet
                                                    │
verificador ◄─ presentación ◄─ prueba/presentación ◄┘
     │
     └─► RegistryPort / AnchorPort ─► web · Stellar · EVM · otra VDR
```

Puertos que deben quedar separados:

| Puerto | Responsabilidad | No debe saber |
|---|---|---|
| `EvidenceSourcePort` | Obtener evidencia autorizada y reducirla a un reclamo | Cadena, UI, política de la contraparte |
| `CredentialIssuerPort` | Firmar una credencial mínima, versionada y revocable | Proveedor de datos concreto |
| `PresentationPort` | Crear/verificar una presentación vinculada a reto, audiencia y finalidad | Cadena de anclaje |
| `ProofPort` | Probar predicados o verificar una atestación | Fuente y transporte HTTP |
| `RegistryPort` | Resolver claves, esquemas y estado de revocación | Datos personales |
| `AnchorPort` | Publicar una raíz o recibo opcional | Reclamos crudos y documento del sujeto |

Reglas:

- `core/` no importa SDK de cadena, proveedor, wallet ni formato de credencial.
- `ChainId` y `RegistryId` son identificadores abiertos de red, no uniones cerradas.
- una presentación siempre se vincula a `challenge`, `audience`, `purpose` y expiración;
- no se ancla PII, hashes simples de cédula, salarios, empleadores ni resultados individualizables;
- una caída de la cadena no impide verificar una credencial con material público cacheado;
- Stellar es el primer `AnchorPort`, no el formato de la credencial ni el sistema de identidad.

### Estándares objetivo

- **W3C Verifiable Credentials Data Model 2.0** para el sobre interoperable.
- **OpenID4VCI / OpenID4VP** para emisión y presentación entre wallet y contraparte.
- **AnonCreds** como candidato principal para predicados numéricos y presentaciones no enlazables;
  es agnóstico al registro verificable y soporta pruebas de predicado sin revelar el atributo.
- **SD-JWT** solo para divulgación selectiva donde revelar un atributo sea aceptable; por sí solo
  no prueba `ingreso >= umbral` sin revelar el ingreso.

La selección final se hace con un spike medido en Android e iOS. Hasta entonces `ProofPort`
mantiene dos implementaciones: `attested` para el recorrido construible y `zk` experimental.

## Catálogo de predicados

| Predicado | Respuesta mínima | Evidencia aceptable | Lo que no afirma |
|---|---|---|---|
| `personhood` | documento vigente y sujeto vivo/mayor de edad | registro civil o validación gubernamental | domicilio, historial o reputación |
| `authority` | puede representar a una organización o activo | registro mercantil, poder o certificado | solvencia |
| `capacity` | no existe una restricción jurídica relevante al acto | insolvencia, interdicción o estado societario aplicable | “buena persona” o riesgo crediticio |
| `sanctions` | no aparece en el conjunto de inhabilidades declarado | listas oficiales y snapshot identificable | antecedentes penales generales |
| `solvency` | banda o booleano respecto de una obligación pública | PILA, open finance, nómina o documento tributario consentido | probabilidad de impago |
| `continuity` | evidencia reciente y continua durante una ventana | aportes, nómina o flujos bancarios consentidos | confiabilidad personal |
| `assetStanding` | activo existente y sin alertas definidas | RUNT/SIMIT, SNR/VUR u otro registro del activo | identidad del propietario salvo necesidad legal |

Cada resultado incluye procedencia (`observed | documentary | self_declared`), fuente lógica,
fecha de corte, vigencia, jurisdicción y una declaración `does_not_estimate`.

## Fuentes investigadas

Fecha de revisión documental: **2026-09-20**. “Público” significa que existe una consulta o dataset
oficial accesible al ciudadano; **no** significa que esté permitido automatizarlo. No se usa
scraping, evasión de CAPTCHA ni un portal humano como API de producción.

### Acceso comercial

| Proveedor | Cobertura útil | Uso propuesto | Condición antes de depender |
|---|---|---|---|
| [Croma](https://docs.usecroma.com) | Registros gubernamentales de Colombia, Perú y México | Primera integración para identidad, capacidad, sanciones y activos | Exportar catálogo contratado, esquema y SLA; una llamada real por endpoint |
| [Truora](https://dev.truora.com/docs/) | Identidad y checks de personas, empresas y vehículos en LATAM | Respaldo de Croma y onboarding con consentimiento | Configurar checks sin antecedentes penales ni web/media; revisar fuentes por país |
| [Incode](https://developer.incode.com/general-reference/government-verification-sources/) | Documento, biometría y validación contra registros gubernamentales | Prueba de posesión del documento y liveness | Evaluación biométrica, residencia de datos, retención y costo |
| DataCrédito Experian / TransUnion | Información financiera y crediticia regulada | Solo cuando el perfil requiera información crediticia explícita | Consentimiento de Ley 1266, contrato y revisión legal; nunca convertir score en identidad |
| [Belvo](https://developers.belvo.com/) | Brasil, México y Chile — **Colombia no aparece** en su OpenAPI (2026-09-21) | Solo vuelve si ventas entrega lista contractual de bancos colombianos | Confirmar cobertura antes de citarlo como alternativa |
| Prometeo / Finerio Connect | Conectividad bancaria. Prometeo: documentación tras login y cobertura CO sin confirmar. Finerio: entidad contractual en Colombia | `cashflow`, que es una credencial distinta del IBC | Confirmar bancos, sandbox y método de autorización |
| Operadores PILA: SOI, Aportes en Línea, MiPlanilla, Simple, SuAporte | Liquidación y certificados del operador | Evidencia directa de aportes e IBC | Acuerdo B2B, autorización del titular y estrategia multioperador |
| [SuAporte](https://www.suaporte.com.co/aportantes/) | Swagger abierto: gestión de aportantes y generación de planilla | **Del lado de quien paga**, no del cotizante. No responde historial por titular | Solo si ofrecen autorización delegada del cotizante |

Ningún agregador se declara sustituto universal de otro. El adapter registra `provider`,
`authority`, `dataset`, `retrievedAt` y `coverage`; la credencial declara la autoridad que originó
la evidencia, no solamente el intermediario que la transportó.

### Acceso público u oficial

| Fuente | Aporta | Estrategia permitida |
|---|---|---|
| Registraduría | estado del documento/estado vital en los servicios habilitados | convenio, interoperabilidad o proveedor autorizado; consulta manual solo para prueba |
| ADRES/BDUA | afiliación actual a salud y régimen | `continuity` solo con semántica conservadora; nunca solvencia |
| RUAF/SISPRO | afiliaciones a subsistemas de protección social | afiliación, no historia de pagos ni IBC |
| UGPP Estado Único de Cuenta | últimos aportes e IBC mostrados al titular | investigar canal institucional; no automatizar el portal sin autorización |
| Procuraduría y Contraloría | inhabilidades disciplinarias/fiscales y certificados verificables | consulta oficial o proveedor; snapshot y código de verificación |
| Contaduría | boletín de deudores morosos del Estado | solo si la inhabilidad es pertinente al acto |
| RUES / cámaras de comercio | existencia, estado y representación de persona jurídica | API/convenio o certificado aportado por el titular |
| Supersociedades | estados financieros y procesos de insolvencia | datasets/servicios oficiales con fecha de corte |
| Rama Judicial / SAMAI | procesos por radicado o nombre | solo para una regla jurídica concreta; coincidencia por nombre exige revisión humana |
| RUNT y SIMIT | estado e historial vehicular, garantías y comparendos | servicios oficiales/comerciales; separar persona de activo |
| SNR / VUR | tradición, titularidad y gravámenes inmobiliarios | certificado pagado o convenio; no scraping |
| DIAN | RUT, estado tributario y factura electrónica consentida | validación o documento firmado; minimizar información económica |
| SECOP / Datos Abiertos | contratos y proveedores del Estado | datasets con API pública para hechos empresariales, nunca perfilado personal |
| OFAC y Naciones Unidas | sanciones internacionales | descarga oficial versionada, hash y fecha; resolución conservadora de identidad |

### Ruta al IBC, en orden (D-29)

| Prioridad | Fuente | Qué aporta | Estado |
|---|---|---|---|
| 1 | **Aportes en Línea** | histórico PILA; su política ya contempla entregarlo a terceros para validar experiencia laboral | conversación comercial pendiente |
| 2 | **Agildata** (manual 2019) | IBC por periodo, promedio de 3 meses, días cotizados, con autorización del titular | vigencia sin confirmar; no entra al roadmap |
| 3 | **UGPP / VUE — Estado Único de Cuenta** | cuatro meses de aportes, entregados al titular | adaptador escrito; fallback manual con `needs_human_review`, sin verificación pública ni emisión automática — D-32 |
| 4 | **Finerio Connect · Bancolombia Open Banking** | entradas bancarias consentidas | alimenta `cashflow`, no sustituye el IBC |

Lo que se pide a un proveedor de IBC es el **resultado reducido** —periodos cotizados, banda de IBC,
último periodo, cobertura de la fuente— y nunca el PDF, el empleador, la EPS ni el salario exacto.
Y una pregunta decide la cobertura: **cómo se distingue "sin registros en este operador" de "sin
aportes"**, porque una persona puede tener planillas en varios operadores.

### El fallback documental asistido

1. El titular pide su Estado Único de Cuenta y lo aporta. Knowni no entra a su cuenta ni reusa sus
   credenciales.
2. No existe comprobación pública automática. Una persona revisa procedencia y consistencia; el
   resultado conserva `needs_human_review`: un documento revisado manualmente no se vuelve una
   certificación ni una API.
3. Se extraen solo periodos e IBC, se calcula la mediana y se descarta el resto.
4. El reclamo sale con `basis: contribution_base` y `periodsWindow: 4`, así que **nadie puede leerlo
   como continuidad de doce meses**.
5. El documento original se elimina; lo que queda es una referencia del código de verificación que
   no lo contiene.

Este fallback solo se enciende si un piloto acepta su precio, SLA y responsabilidad humana. No
bloquea el MVP ni sustituye el acceso delegado con un operador. Si no existe ese acuerdo operativo,
`contribution_base` queda `unavailable`.

### Lo que queda fuera

- antecedentes penales generales, búsquedas web y redes sociales;
- Sisbén, clasificación de pobreza o régimen subsidiado como señal negativa;
- inferir ingreso desde afiliación ADRES/RUAF;
- puntaje agregado de “confianza” o “riesgo humano”;
- scraping de portales, CAPTCHA solving o reuso de credenciales del ciudadano;
- consultar desde la contraparte: toda fuente se usa durante emisión y con autorización;
- intermediarios que consultan por documento en la URL y devuelven el certificado completo, sin
  autorización delegada ni límite de finalidad — el expediente que el producto existe para no
  entregar;
- reusar las credenciales del ciudadano en el portal de un operador para consultar por él.

## Estrategia construible

### Producto mínimo posthackathon

El recorrido de hackathon es **compraventa de vehículo**: `personhood`, `capacity`, `sanctions` y
`assetStanding`, porque el catálogo comprobado contiene Registraduría, SICAAC, listas, RUNT y
SIMIT. El primer recorrido posthackathon conserva cuatro predicados para un solo perfil y añade
una segunda fuente comercial solo cuando su cobertura esté comprobada.

1. La contraparte crea una solicitud firmada con finalidad, predicados, umbrales, audiencia y TTL.
2. El wallet muestra exactamente qué se consultará y obtiene consentimiento granular y revocable.
3. El servicio emisor consulta Croma y una fuente de solvencia; reduce y descarta la respuesta.
4. Emite credenciales mínimas firmadas con expiración corta y estado de revocación.
5. El wallet crea una presentación ligada al reto. El verificador la valida sin llamar a la fuente.
6. `AnchorPort` publica solo una raíz/recibo; si la red falla, la validación criptográfica sigue.

### Modelo comercial

**Paga quien pregunta.** La contraparte compra una verificación atada a una solicitud; el titular no
paga por ejercer su derecho a demostrar un dato propio. Ver `memoria.md` D-26.

| Producto | Pagador | Qué compra |
|---|---|---|
| Verificación vinculada | la contraparte | una respuesta atada a `sessionId`, audiencia y finalidad |
| Credencial reutilizable | el titular, opcional | un activo suyo, presentable en varios trámites |

- Precio **por predicado**, cotizado antes de que el titular consienta: pedir cuatro cuesta más que
  pedir dos, y esa es la palanca que desincentiva pedir de más.
- Una fuente que no responde **no se cobra**. `unavailable` no es una respuesta vendible.
- El pago se ata a la pregunta: el memo de la transacción lleva el hash del `sessionId`, auditable
  sin revelar quién preguntó ni sobre quién.
- **Pagar no es autorizar.** Un pago sin consentimiento del titular no emite nada.
- El costo de fuente se registra por adaptador, para poder sustituir proveedores sin tocar el precio
  de cara al cliente.
- El contrato comercial prohíbe reconstruir identidad, reutilizar la presentación o pedir predicados
  que la finalidad no necesita.

### Requisitos operativos antes de producción

- concepto jurídico sobre roles de responsable/encargado, Ley 1581 y Ley 1266;
- autorización trazable por fuente, dato, finalidad, destinatario y vigencia;
- política de retención: respuesta cruda en memoria y eliminación inmediata después de emitir;
- llaves de emisor en KMS/HSM, rotación y plan de compromiso;
- métricas sin PII, auditoría de consentimiento y respuesta a incidentes;
- matriz de cobertura y falsos negativos por fuente antes de usarla en decisiones;
- SLA, timeout, reintentos, circuit breaker y proveedor alterno por predicado crítico.

## Criterios de aceptación

| # | Criterio | Verificación |
|---|---|---|
| A1 | Ningún valor crudo del reclamo aparece en la presentación | prueba de invariante sobre serialización |
| A2 | No existe ruta de verificación hacia una fuente | prueba de arquitectura/importaciones y recorrido E2E |
| A3 | La misma presentación se verifica con `RegistryPort` web y con un adapter de cadena | contract test compartido |
| A4 | Cambiar Stellar por memoria/EVM no cambia `core`, claims ni perfiles | diff de dependencias + suite de registro |
| A5 | Una presentación no sirve para otra audiencia, finalidad, reto o fecha | tests de replay y domain separation |
| A6 | Cada respuesta declara procedencia, vigencia y qué no estima | schema + snapshot de UX |
| A7 | `degraded`, `not_found` y `failed` son estados distintos | tests unitarios y recorrido UI |
| A8 | Cada respuesta externa se valida y se reduce dentro del adaptador | unit + fuzz por adapter |
| A9 | Existe una llamada real y fechada por fuente habilitada | bitácora sanitizada en `verificacion.md` |
| A10 | El recorrido principal funciona con una transacción Stellar testnet verificable | enlace Explorer y test E2E |
| A11 | El mismo recorrido funciona con el anclaje desactivado | E2E offline/cadena caída |
| A12 | Wallet emite una presentación sin red después de recibir credenciales | dispositivo físico en modo avión |
| A13 | Ningún log contiene documento, nombre, salario, cuenta o payload de proveedor | test de redacción + revisión de logs |
| A14 | La suite, lint, typecheck y build parten de cero en CI | workflow público en verde |

### Bloque activo — pago móvil Stellar de punta a punta

Este bloque parte de `main` después del PR #27 y no cambia el control de acceso de `/issue`.
Su alcance termina cuando el teléfono puede convertir una cotización vigente en una transacción
Stellar firmada y enviada; la validación y consumo del pago siguen siendo responsabilidad del
emisor. No añade custodia, contrato Soroban, activo distinto de XLM ni persistencia de pagos.

| # | Criterio | Verificación |
|---|---|---|
| P1 | La app construye una operación `PAYMENT` en testnet con el activo, monto y destino explícitos de la cotización | prueba XDR con términos conocidos |
| P2 | `paymentRef` ocupa exactamente los 32 bytes de `MEMO_HASH`; una referencia inválida se rechaza antes de firmar | tests de longitud, hexadecimal y memo decodificado |
| P3 | La secuencia procede de Horizon y la transacción no se fabrica si la cuenta fuente no existe | tests del cliente Horizon con respuestas controladas |
| P4 | Privy firma el hash de la base de firma y la app adjunta la firma decorada; Freighter recibe el sobre sin firmar y devuelve el firmado | contract tests de ambos caminos |
| P5 | La app envía a Horizon únicamente un sobre firmado y devuelve el hash de la red cuando fue aceptado | prueba del cuerpo `application/x-www-form-urlencoded` y respuesta exitosa |
| P6 | Rechazo de wallet, cotización vencida, saldo/cuenta ausente, rechazo de Horizon y caída de red son resultados distintos | matriz de pruebas de errores tipados |
| P7 | Ningún log ni error expone firma, XDR completo, llave de contraparte o respuesta cruda de Horizon | revisión de código y tests de serialización pública |
| P8 | El módulo es portable a Expo: no importa `node:crypto`, `Buffer` ni `@stellar/stellar-sdk` | typecheck de `app/` y prueba de imports |
| P9 | Un coordinador ejecuta `quote → pago → issue`; nunca llama `/issue` si falló firma o Horizon, y solo omite pago cuando `/quote` declara el cobro desactivado | prueba de secuencia HTTP completa y de downgrade |

La moneda comercial y el activo de red no se infieren entre sí. `/quote` debe publicar términos de
pago completos; si cobra USDC, incluye código e emisor del activo. El emisor rechaza otro activo,
aunque tenga el mismo número de unidades. XLM solo es válido cuando la cotización lo declara como
activo nativo: nunca se acepta como sustituto implícito de USDC.

Secuencia de implementación:

1. definir el contrato portable de cotización, firma y resultado de pago;
2. codificar/decodificar solo el subconjunto XDR necesario para `PAYMENT + MEMO_HASH`;
3. integrar carga de cuenta y envío con Horizon detrás de un puerto inyectable;
4. completar los caminos Privy y Freighter sin cambiar la semántica de sus adapters;
5. conectar el pago al flujo antes de `/issue`, mostrando fallos recuperables;
6. ejecutar pruebas de app y repositorio, typecheck y build antes de abrir el PR.

## Fases

### F0 — Cerrar la entrega de hackathon

- corregir suite y cifras documentadas;
- hacer público el repositorio y añadir `LICENSE`;
- integrar una llamada Croma real con respuesta sanitizada;
- cerrar el perfil `vehicle-sale` con Registraduría, capacidad, sanciones y RUNT/SIMIT;
- enviar una raíz/commitment real a Stellar testnet y documentar el hash;
- grabar un recorrido funcional; lo no real aparece explícitamente como demo.

**Salida:** A9, A10 y A14; cuatro entregables exigidos por las bases.

### F1 — Vertical construible

- renombrar `SourcePort` a `EvidenceSourcePort` sin cambiar su contrato observable;
- implementar consentimiento y `EvidenceReceipt` sin PII;
- emitir una credencial firmada `attested` verificable sin cadena;
- implementar Croma para `personhood`, `capacity`, `sanctions` y un activo;
- seleccionar por spike una fuente real de solvencia: Croma/PILA, SuAporte u open finance;
- eliminar respuestas crudas inmediatamente después de reducirlas.

**Salida:** una contraparte verifica cuatro respuestas sin acceso a Croma ni al documento.

### F2 — Interoperabilidad y privacidad

- spike comparativo AnonCreds vs circuito propio en Android/iOS: tamaño, tiempo, RAM, revocación,
  mantenimiento y auditoría;
- introducir `CredentialIssuerPort`, `PresentationPort`, `ProofPort` y `RegistryPort`;
- envolver credenciales/presentaciones en W3C VC 2.0 y flujos OpenID4VCI/OpenID4VP;
- reemplazar identificadores correlacionables por binding de holder y nonces por presentación;
- prueba de no correlación entre dos contrapartes.

**Salida:** A3–A6 y A12 en dos plataformas móviles.

### F3 — Registro y cadenas sustituibles

- hacer que `RegistryPort` resuelva claves, schemas y revocación desde HTTPS firmado;
- mantener Stellar como primer `AnchorPort` con raíz y recibo testnet;
- crear un segundo adapter mínimo —EVM o transparencia web— contra la misma suite contractual;
- simulación de caída/reorganización de cadena y operación sin anclaje.

**Salida:** A3, A4, A10 y A11 demostrados, no solo declarados.

### F4 — Piloto comercial

- un perfil, una jurisdicción, una contraparte piloto y un volumen acotado;
- DPIA/análisis de riesgos, concepto legal y contratos con proveedores;
- tablero de costo, latencia, cobertura, degradación y abandono por fuente;
- soporte de corrección y disputa para el titular;
- revisión humana solo cuando el resultado sea ambiguo, nunca como decisión secreta.

**Salida:** 100 verificaciones consentidas con métricas agregadas y cero expedientes entregados.

### F5 — Expansión

- segundo perfil solo después de que F4 cumpla SLA y privacidad;
- segundo proveedor por predicado crítico;
- segunda jurisdicción como adapters y perfiles, sin modificar `core/`;
- evaluación externa de seguridad y privacidad antes de producción abierta.

### Notas para `formality`, cuando le toque

0. **¿Hay RUAF? Sí.** Comprobado en vivo contra el catálogo el 2026-09-20:
   `/co/ruaf/affiliations/v1` (`document_number` + `issue_date`), en vivo. Así que `formality` se
   apoya en la afiliación a ARL —que no tiene versión subsidiada— y la regla asimétrica deja de
   hacer falta por esa vía. ADRES queda como respaldo, con su regla. En ninguno de los dos casos
   hay historial: los dos son registros de estado, así que `monthsContributedLast12` no es
   respondible sin PILA.
1. **`formality` por ADRES Health Affiliation Status**, con la regla asimétrica de D-12: cotizante
   activo en régimen contributivo → `true`; todo lo demás → `unavailable`, **nunca `false`**.
   Del `SourceResult` solo sobrevive el booleano: la EPS, el régimen y la fecha se descartan dentro
   del adaptador.
2. **El tipo de cotizante entra en `FormalityClaim`.** La fuente primaria (D-15) distingue `3`
   por cuenta propia, `59` con contrato de prestación de servicios superior a 1 mes, y `57`
   voluntario a riesgos. Separa *"trabaja por su cuenta"* de *"tiene contrato vigente"* sin revelar
   con quién — forma de predicado, no de dato. Solo aplica si se confirma la vía de consulta.
3. **Las fechas de novedades son opcionales en la fuente**, así que `monthsContributedLast12` debe
   tolerar meses sin fecha sin contarlos como ausencia.
4. **`solvency` de persona natural no tiene fuente.** No se simula y no se disimula. Dos caminos
   documentales, ambos aportados por el sujeto y ninguno obligatorio: DIAN Electronic Document (el
   sujeto da el CUFE) y SECOP Contracts by Provider si es contratista del Estado.

## Próximos 10 días

| Día | Entregable comprobable |
|---|---|
| 1 | suite verde desde clon limpio, licencia y estado real del README |
| 2 | inventario exportado de endpoints Croma contratados y schemas guardados como fixtures sanitizadas |
| 3 | cliente Croma robusto y primer adapter real |
| 4 | cuatro adapters del perfil de demo con degradación tipada |
| 5 | transacción Stellar testnet real y enlace en README |
| 6 | emisión y verificación `attested` sin depender de cadena |
| 7 | solicitud ligada a audiencia/finalidad/reto y prueba anti-replay |
| 8 | interfaz móvil mínima del recorrido principal |
| 9 | ensayo en modo avión, logs sanitizados y prueba desde cero |
| 10 | videos demo/pitch, auditoría de afirmaciones y entrega final |

### Día 8 — diseño móvil para aprobación

Entrega de diseño, no app terminada: `design/day-08/README.md` y capturas del prototipo.
Criterios: ocho pantallas a 390 × 844; solicitud, consentimiento, emisión, revisión,
entrega, resultado y degradación; destinatario y finalidad visibles antes de compartir;
sin foto de documento, score ni selector de blockchain; estados no resueltos nunca negativos.
Los MD separan responsabilidades mobile, core/attestation, sources y QA. La aprobación visual
no cierra A1, A9, A12 ni acredita ejecución nativa. Compartir en producción queda bloqueado
hasta autenticar los resultados mínimos sin entregar `claim`/`salt`, integrar verificación
criptográfica con aceptación y admitir el perfil vehicular en `Disclosure`.

## Puertas de decisión

1. **Croma/PILA:** no prometer solvencia por aportes hasta comprobar que el endpoint devuelve IBC,
   periodos y estado de pago, no solo afiliación.
2. **Prueba:** si ZK móvil no cumple presupuesto medido, se entrega `attested`; no se simula ZK.
3. **Cadena:** si Soroban no está desplegado, se usa `MEMO_HASH` como recibo y se declara que el
   control de replay es del verificador.
4. **Proveedor:** si la cobertura contractual no alcanza el perfil, se cambia el perfil o se añade
   un adapter; nunca se rellena con datos sintéticos en producción.
5. **Go-live:** sin concepto legal, eliminación de payloads, gestión de llaves y respuesta a
   incidentes, el sistema sigue siendo piloto cerrado.

## Referencias primarias

- [W3C Verifiable Credentials Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/)
- [Hyperledger AnonCreds specification](https://hyperledger.github.io/anoncreds-spec/)
- [RFC 9901 — Selective Disclosure for JWTs](https://www.rfc-editor.org/rfc/rfc9901)
- [RUAF — SISPRO](https://www.sispro.gov.co/central-prestadores-de-servicios/Pages/RUAF-Registro-Unico-de-Afiliados.aspx)
- [Estado Único de Cuenta — UGPP](https://www.ugpp.gov.co/estado-unico-de-cuentas/)
- [Operadores PILA autorizados — MinSalud](https://www2.minsalud.gov.co/proteccionsocial/Paginas/contacto-operadores-pila.aspx)
- [Finanzas Abiertas — Superfinanciera](https://www.superfinanciera.gov.co/publicaciones/10116081/finanzas-abiertas-obligatorias-impulsaran-el-desarrollo-del-sistema-y-la-inclusion-financiera-en-el-pais/)
- [Ley 1581 de 2012 — SIC](https://sedeelectronica.sic.gov.co/sites/default/files/normatividad/Ley_1581_2012.pdf)
