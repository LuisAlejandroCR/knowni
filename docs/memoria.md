<!-- docs/memoria.md
     Enfoque técnico y bitácora: las decisiones tomadas, su razón y su fecha.
     Se distingue de plan.md, que dice qué se construye y con qué criterios, y de
     BRAINSTORM.md, que razona el producto sin comprometerse a una implementación. -->

# Memoria

El razonamiento va aquí, no en el commit. Un commit de este repositorio es una línea.

## Arquitectura, en una frase por capa

```
core/        reclamos → predicados → sobre. Sin dependencias, sin SDK de cadena
sources/     una fuente oficial → un reclamo mínimo. Adaptador por (país, pregunta)
anchoring/   un compromiso cegado → una cadena. Puerto con registro
circuits/    el mismo predicado, como circuito. Groth16 sobre BLS12-381
contracts/   verificar, aplicar política, marcar gastado
app/         iOS y Android. El proving pasa aquí                        ⏳ pendiente
```

La dirección de dependencias es una sola: `app` y `sources` consumen `core`; `core` no consume a
nadie. Verificado en `core/test/no-vendor-imports.test.ts`.

## Decisiones clave

Numeradas `D-NN` para que un comentario de código pueda citarlas sin repetirlas —
la convención del proyecto GovTech anterior.


### D-01 — Raíz de Merkle publicada, no firma dentro del circuito · 2026-09-20

El proyecto ZK anterior verifica la firma del emisor dentro del circuito. Aquí el emisor publica una raíz sobre
los compromisos emitidos y firma **la raíz**, una vez, fuera.

*Razón:* la verificación de firma es la operación más cara de un circuito de predicado y amarra la
curva embebida del circuito a la llave del emisor. Un camino de Merkle cuesta un hash por nivel y
es indiferente a cómo firme el emisor.

*Efecto secundario que no se buscaba:* la revocación sale gratis — el emisor republica sin la hoja.

*Coste aceptado:* el emisor tiene que publicar algo, y el verificador tiene que saber qué raíz está
vigente. Eso es `register_issuer_root` en el contrato.

### D-02 — Groth16 sobre BLS12-381, nunca BN254 · 2026-09-20

*Razón:* es la única curva que Stellar verifica nativamente hoy (CAP-0059, Protocolo 22+). BN254
—el default de Circom, de Noir y de RISC Zero— está bloqueado hasta CAP-0074.

*Hallazgo:* la curva embebida de BLS12-381 es Jubjub, que es sobre la que ya está escrito el
Schnorr del proyecto ZK anterior. El trabajo de Midnight apunta al mismo campo que Stellar verifica. No fue
planeado.

*Modo de falla si se ignora:* todo parece funcionar hasta la llamada al contrato.

### D-03 — `ChainId` es cadena abierta validada, no unión cerrada · 2026-09-20

Corrección sobre el proyecto ZK anterior, que la tiene cerrada (`"cardano" | "evm"`).

*Razón:* una unión cerrada hace que añadir una cadena sea un cambio en la capa de dominio — justo
el acoplamiento que el puerto existe para evitar.

*Coste aceptado:* el id se valida al registrar en vez de al compilar.

*Detalle:* el id nombra una **red** (`stellar:testnet`), no un protocolo. Un recibo que no dice en
cuál no es auditable.

### D-04 — "croma" era Croma, no Chroma · 2026-09-20

La primera versión leyó "croma" como la base vectorial **Chroma** y construyó `retrieval/` sobre
esa lectura. Croma es una **API de datos de gobierno de Latinoamérica** que devuelve JSON tipado
indexado por documento.

*Efecto:* para `personhood` y `standing` no hay nada que desambiguar. La búsqueda difusa resolvía
un problema que la fuente ya resolvió.

*Qué sobrevive:* la política de resolución y la normalización de nombres, porque dos endpoints de
Croma consultan **por nombre** y devuelven varios candidatos.

*Qué se retira:* el adaptador de Chroma, `RecordIndexPort` y el índice en memoria — bloque B3.

*Lección:* un nombre de producto casi homógrafo costó un workspace entero. El origen debía haberse
confirmado antes de diseñar sobre él. Ver [`../LEARNINGS.md`](../LEARNINGS.md).

*Corrección posterior, mismo día:* la primera versión de esta entrada atribuyó el trabajo previo de
Croma al proyecto equivocado. La hackathon de Croma fue el proyecto GovTech (12–16 de agosto de
2026); el prototipo notarial quedó sin terminar. Importa porque cambia de dónde se toma el cliente
y, sobre todo, porque el proyecto GovTech trae decisiones de producto ya publicadas que este
proyecto tiene que respetar — D-09, D-10 y D-11.

### D-05 — Nativo, no PWA · 2026-09-20

*Razón:* la tesis del producto es que el dato no sale del teléfono, y eso exige proving en el
dispositivo. Un proof server remoto ve el testigo entero.

*Regla aplicada:* una nota propia de procedimientos — "se elige nativo cuando el
proving en el dispositivo es la tesis del proyecto".

*Elección:* React Native + Expo con núcleo Rust sobre UniFFI. El dominio ya es TypeScript sin
dependencias y corre en el teléfono sin puerto. Descartes y razones en `MOBILE.md`.

### D-06 — La mediana, no la media, para el ingreso · 2026-09-20

*Razón:* una prima o una liquidación arrastra la media y la contraparte termina suscribiendo un año
contra un evento único. El último mes se leería como cero cuando el aporte se radicó tarde.

*Estado:* la fuente que la alimenta (PILA) no está confirmada en Croma — bloque B4.

### D-07 — Tests planos en vez de `unit/ fuzz/ invariant/` · 2026-09-20 · **deuda**

La suite actual está en `*/test/*.test.ts`. La constitución pide
`test/unit/ · test/fuzz/ · test/invariant/` con sufijo `.spec.ts`.

*Razón de la desviación:* velocidad de arranque. *No es una decisión, es deuda*, y está anotada en
[`verificacion.md`](verificacion.md).

### D-08 — Cabeceras de código largas · 2026-09-20 · **deuda**

La constitución pide 2–3 líneas, `// <filename>: <what this file does>`, sin narrativa. Los archivos
actuales traen cabeceras de 10–30 líneas con justificaciones.

*Razón de la desviación:* se escribieron antes de leer la constitución. El razonamiento de esas
cabeceras pertenece a este archivo; las cabeceras hay que recortarlas. Deuda anotada.

### D-09 — No se consultan antecedentes penales · 2026-09-20

El proyecto GovTech anterior lo tiene publicado como decisión firme: *"No usamos antecedentes penales. Ni de ella,
ni de nadie. Es una decisión firme y no va a cambiar."* Este repositorio tenía
`/co/policia/criminal-records/v1` dentro de `standing`. Se retira.

*Razón:* un antecedente penal no dice si alguien puede pagar un arriendo ni si tiene capacidad
legal para contratar. Dice que cumplió una condena. Convertirlo en un filtro de vivienda le cierra
la puerta a quien ya pagó, y lo hace a escala y en silencio — que es exactamente el daño que este
producto existe para no causar.

*Qué sí se mantiene, y por qué no es lo mismo:* `standing` se parte en dos.

| Nuevo predicado | Fuentes | Qué pregunta |
|---|---|---|
| `sanctions` | OFAC, ONU, Procuraduría (inhabilidad disciplinaria), Contraloría (responsabilidad fiscal), Contaduría (moroso del Estado) | ¿Hay una **inhabilidad legal para contratar**? |
| ~~antecedentes penales~~ | — | Retirado |

La diferencia no es de grado. Una inhabilidad es una restricción vigente sobre la capacidad de
contratar, y una contraparte regulada tiene obligación de mirarla. Un antecedente penal es un
hecho del pasado de una persona, y mirarlo para arrendarle es un castigo adicional que nadie
impuso.

*Coste aceptado:* alguna contraparte lo pedirá. La respuesta es que este producto no lo responde, y
queda escrito en las exclusiones de [`../CLAUDE.md`](../CLAUDE.md).

### D-10 — Un resultado declara qué es y qué no estima · 2026-09-20

Este repositorio tenía *"nunca emitir un puntaje"* como exclusión no negociable. El proyecto GovTech anterior
**sí emite un puntaje**, y no se contradicen: lo que hace defendible al suyo es que el resultado
**se declara a sí mismo**.

Su `ScoreDisclosure` lleva `kind: 'descriptive'`, la ventana que describe, y una lista explícita
`does_not_estimate`: *la probabilidad de que dejes de pagar · tu historial crediticio, ni lo
sustituye · una decisión de una institución financiera*.

*Lo que se adopta:* `SolvencyTier` es exactamente eso —una banda descriptiva, no una
probabilidad— y hoy no lo dice en ninguna parte. Un `PredicateDisclosure` con la misma forma viaja
con el sobre: qué describe cada respuesta, y qué **no** estima.

*Lo que no cambia:* Knowni sigue sin emitir un número agregado. No por desacuerdo, sino porque son
productos distintos: el proyecto GovTech anterior le da a un banco algo que mirar donde no había nada, y un
puntaje es la forma correcta de eso; Knowni le quita a un arrendador un expediente que no debía
tener, y un puntaje volvería a darle una cifra opaca sobre la que decidir. La exclusión se reescribe
para decir eso en vez de sonar a principio universal.

*También se adopta:* el eje de procedencia `observed | documentary | self_declared`. Es más limpio
que el `IncomeBasis` actual y responde la pregunta que la contraparte de verdad tiene — *¿esto lo
comprobó alguien, o me lo está contando?*

### D-11 — La cobertura se mide antes de decidir si puntúa · 2026-09-20

El proyecto GovTech anterior mide la cobertura del directorio oficial **antes** de decidir si el sello aporta al
puntaje, y concluye que no debe: *"el directorio cubre muchísimo mejor a unos estados que a otros;
si diera puntos, premiaría el código postal"*.

*Aplicación directa aquí:* PILA cubre a quien cotiza. Si `formality` alimentara una decisión
agregada, premiaría la formalidad laboral y castigaría a la mitad informal del país por su forma de
trabajar, no por su capacidad de pagar. Por eso es un predicado separado que la contraparte tiene
que **pedir a la vista**.

*Regla generalizada, ahora en [`../AGENTS.md`](../AGENTS.md):* antes de que una fuente influya en
un resultado, se mide a quién cubre. Una fuente con cobertura desigual que puntúa es un sesgo con
respaldo oficial.

### D-12 — Sisbén nunca, y ADRES solo en la dirección positiva · 2026-09-20

El catálogo de Croma para Colombia incluye **DNP Social Classification (Sisbén IV y RUI)**. Es el
endpoint más peligroso de la lista para este producto, y no por poco.

*Qué es:* una clasificación socioeconómica del Estado que ordena a las personas en grupos de
pobreza para asignarles programas sociales.

*Qué pasaría si entrara:* un arrendador podría filtrar solicitantes por grupo de pobreza **con un
sello oficial encima**. No es un sesgo emergente que haya que medir; es un filtro de pobreza
entregado listo. Un producto que promete quitarle expedientes a la gente no puede ser el que
entrega ese.

*Decisión:* Sisbén y Sisbén Offices no se llaman. No hay bandera de configuración, no hay modo
avanzado, no hay cliente que lo pida. El endpoint no existe para este código.

**Y la misma trampa entra por la puerta de atrás.** `ADRES Health Affiliation Status` es el
sustituto de PILA para `formality`, y la afiliación a salud distingue **régimen contributivo** de
**régimen subsidiado** — que es, otra vez, un marcador de pobreza. Así que ADRES entra con una
regla asimétrica, no como una fuente más:

| Lo que devuelve ADRES | Lo que produce Knowni |
|---|---|
| Cotizante activo, régimen contributivo | `formality: true` |
| Régimen subsidiado, o beneficiario, o inactivo | **`unavailable`**, nunca `false` |

*Por qué asimétrica:* `false` le dice a un arrendador "esta persona no cotiza", y en Colombia eso
se lee como "es pobre". `unavailable` le dice la verdad — que este predicado no se pudo responder
por esta vía — y lo deja donde debe estar: sin información, en vez de con una inferencia sobre la
situación económica de alguien que nadie preguntó.

*Coste aceptado:* `formality` va a salir `unavailable` para mucha gente. Es correcto. La
alternativa es un filtro de pobreza con fuente oficial.

*También queda fuera:* la afiliación revela la EPS y el régimen. Del `SourceResult` de ADRES solo
sobrevive un booleano; la EPS, el régimen y la fecha se descartan dentro del adaptador.

### D-13 — El hackathon apunta a compraventa ante notario, no a arrendamiento · 2026-09-20

El catálogo decide el alcance, y lo decide contra lo que yo había asumido.

*Lo que hay, real y directo:* `personhood` (Registraduría), `sanctions` (Procuraduría, Contraloría,
Contaduría), `capacity` (SICAAC + Rama Judicial), `formality` (ADRES, con D-12), y
`assetStanding` **de vehículo** completo (RUNT por placa + historial + SIMIT).

*Lo que no hay:* PILA, así que `solvency` de persona natural no tiene fuente. Y SNR, así que
`propertyStanding` de inmueble tampoco.

*La consecuencia:* un **arrendamiento** se decide por *¿le alcanza?*, que es justo el predicado sin
fuente. Una **compraventa ante notario** se decide por identidad, capacidad e inhabilidades — los
tres que sí están, y que además son los que un notario tiene **obligación legal** de verificar.

*Decisión:* la demo del hackathon es una compraventa. El arrendamiento se mantiene como el caso de
uso de mayor volumen y queda a la espera de PILA, declarado como tal y no disimulado con una fuente
sintética presentada como real.

*Efecto secundario que conviene:* una compraventa **de vehículo** se cubre de punta a punta hoy —
sujeto y activo, los dos con fuentes reales. Es el único recorrido del catálogo que cierra sin un
solo dato sintético, y por eso es el que se demuestra.

*Lo que no cambia:* los predicados, el sobre, el anclaje y la frontera de privacidad son los
mismos. Cambia `sources/` y cambia qué se enseña.

### D-14 — El tipo de contrato es un perfil de la solicitud, no una rama del dominio · 2026-09-20

El producto es **"demuestra que calificas para firmar, sin decir quién eres"**, sin importar qué se
firma. El arrendamiento es una aplicación, no la definición — y hasta hoy tanto la misión como el
código decían lo contrario.

*Dónde estaba el error, en concreto:* `core/src/session.ts` tenía

```ts
export type Purpose = "lease" | "purchase" | "guarantor" | "employment" | "other";
```

Una unión cerrada de los tipos de contrato que existían el día que se escribió. Eso es la capa de
dominio sabiendo qué es un arriendo — exactamente el acoplamiento que D-03 le quitó a `ChainId`, y
por la misma razón: añadir un tipo de contrato no puede ser un cambio en el dominio.

*El arreglo:* `Purpose` es una cadena abierta validada (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤64). El
formato se restringe porque el propósito se hashea en el `sessionId` **y se le muestra al sujeto
antes de que responda**: un valor que no puede leer es una pregunta que no puede rechazar.
`sessionId` lanza ante un propósito malformado —es un helper puro en la frontera del hash, como
`fromHex`— y `verify` lo comprueba primero y **rechaza** con `invalid_purpose`, porque un campo que
escribe la contraparte no puede tumbar la verificación.

*Qué es entonces un tipo de contrato:* un **perfil** — qué predicados pide y con qué parámetros
públicos. Lo compone quien pregunta; `core/` nunca aprende qué significa ninguno.

| Perfil | Predicados que pide |
|---|---|
| Arrendamiento | `personhood` · `solvency` · `formality` · `sanctions` |
| Compraventa de vehículo | `personhood` · `capacity` · `sanctions` · `assetStanding` |
| Codeudor o garantía | `personhood` · `solvency` · `capacity` |
| Suministro con persona jurídica | `capacity` (RUES) · `solvency` (Supersociedades) · `sanctions` |
| Poder o representación | `personhood` · `capacity` |

*Lo que esto explica de golpe:* por qué los mismos cinco predicados sirven para todo. El contrato
cambia **cuáles** se piden y **con qué umbrales**, nunca qué significa un predicado. Y por qué el
alcance del hackathon (D-13) es una elección de perfil, no un recorte del producto.

*Verificado:* `core/test/session.test.ts` prueba siete tipos de contrato distintos, que dos de ellos
nunca comparten `sessionId`, y que un propósito ilegible se rechaza.

### D-15 — PILA, contra la fuente primaria · 2026-09-20

Hasta hoy todo lo que este repositorio decía de PILA era conocimiento general bien intencionado.
Ahora hay fuente: el **ABECÉ de PILA del Ministerio de Salud, junio de 2018**. Confirma tres cosas,
refina dos y rompe una suposición.

*Confirma:*

- **El IBC es un piso, no una medición** — y ahora por norma, no por intuición: un independiente
  reporta siempre 30 días salvo novedad de ingreso, y el IBC proporcional no puede bajar de la
  proporción de **1 SMLMV**. D-06 se sostiene con mejor respaldo.
- **Contar meses distintos y no filas** — existe la planilla `N — Correcciones`, que añade
  subsistemas o novedades después del pago inicial, así que un mes puede aparecer dos veces.
- **El acceso es un operador de información autorizado**, con listado publicado por MinSalud. No
  hay otra puerta.

*Refina:*

- **El IBC agrega todos los contratos.** Un independiente con varios contratos de prestación de
  servicios calcula el IBC sobre los honorarios de todos. Es mejor señal de ingreso total de lo que
  yo suponía.
- **El tipo de cotizante es información real sobre la forma de trabajo:** `3` por cuenta propia
  (salud y pensiones), `59` con contrato de prestación de servicios superior a 1 mes (añade
  riesgos), `57` voluntario a riesgos (aporta vencido). Distingue *"trabaja por su cuenta"* de
  *"tiene contrato vigente"* sin revelar con quién — es exactamente la forma de un predicado, y es
  mejor señal de `formality` que la afiliación a salud de D-12. Entra en el modelo con B4.

*Rompe:*

**El ABECÉ es sobre pagar, no sobre consultar.** Describe cómo un aportante liquida y paga por un
operador; **no establece ningún servicio por el que un tercero, ni el propio titular, consulte su
historial de aportes** — ni con qué consentimiento ni con qué retención. Yo venía escribiendo "PILA
vía operador" como si fuera una integración pendiente de acuerdo comercial. Puede que ni siquiera
sea eso: la vía de consulta **hay que confirmar que existe** antes de planear contra ella.

*Caveat de calidad del dato:* las fechas de las novedades laborales y las horas laboradas son
**campos opcionales** según la propia fuente. La señal de continuidad es más ruidosa de lo que
asumí, y `formality` tiene que tolerar meses sin fecha sin leerlos como ausencia.

*Vigencia:* la fuente es de junio de 2018. El umbral de $5.859.315 para pago electrónico
obligatorio es de ese año, y los decretos citados pueden haberse modificado. Nada de esto se da por
vigente sin re-confirmar.

### D-16 — La credencial funciona sin cadena; la cadena es un registro sustituible · 2026-09-20

`chain-agnostic` no significa recompilar el mismo circuito para cada red. Significa que emisión,
custodia, presentación y verificación no dependen de una blockchain. Una red publica raíces,
revocaciones o recibos mediante `RegistryPort`/`AnchorPort`; no define el formato de identidad.

*Razón:* Groth16 sobre BLS12-381 es una buena integración con Stellar, pero convertir esa curva en
el formato del producto haría costoso portar Knowni y dejaría la verificación atada a la
disponibilidad de una red. El dominio conserva predicados y perfiles; `ProofPort` permite una vía
atestada construible y una vía ZK. W3C VC 2.0 y OpenID4VCI/VP serán el sobre y los flujos objetivo;
AnonCreds se evalúa como prueba agnóstica con predicados y presentaciones no enlazables.

*Consecuencia:* Stellar sigue siendo la primera integración y la evidencia exigida por la
hackathon, pero verificar una credencial emitida debe seguir funcionando sin anclaje.

### D-19 — RUAF y ADRES no reemplazan PILA, pero RUAF mejora D-12 · 2026-09-20

La pregunta era si RUAF y ADRES bastan para no depender de PILA. La respuesta se parte en dos, y
una mitad corrige una decisión anterior.

*Lo que sí está verificado en fuente primaria* (el ABECÉ de MinSalud, jun 2018, respuesta 20): los
operadores de PILA **validan la EPS contra la BDUA** —administrada por ADRES— y **la
administradora de pensiones contra el RUAF**. Son registros de **afiliación**, y existen
precisamente para decir *a qué administradora pertenece* alguien.

*Lo que eso implica, y es categórico:* **ninguno de los dos lleva el IBC.** El IBC solo existe en
la planilla de PILA, porque es el valor sobre el que se liquidó un aporte. Un registro de afiliación
dice *dónde estás*, no *cuánto declaraste*. Para `solvency` no hay sustituto, y no es cuestión de
acceso: el dato no está ahí.

*Lo que sí mejora, y corrige D-12:* para `formality`, **la afiliación a ARL o a AFP es mejor señal
que el régimen de salud** — y por la razón exacta que hacía peligrosa a ADRES.

| Fuente | Señal | ¿Marcador de pobreza? |
|---|---|---|
| ADRES — régimen de salud | contributivo vs **subsidiado** | **Sí.** De ahí la regla asimétrica de D-12 |
| RUAF — afiliación a **ARL** | afiliado o no | **No.** No existe una ARL subsidiada |
| RUAF — afiliación a AFP / Colpensiones | afiliado o no | **No.** La afiliación a pensiones va atada a cotizar |

No hay versión subsidiada de riesgos laborales: se está afiliado a una ARL por una relación de
trabajo —dependiente, cotizante `59` con contrato de prestación de servicios, o `57` voluntario— o
no se está. **La puerta de atrás que obligó a la regla asimétrica no existe en esta señal.** Si se
consigue RUAF, `formality` sale de ADRES y deja de necesitar la asimetría por esta vía.

*Lo que se pierde de todas formas:* los dos son registros de **estado**, no libros de **historial**.
Dicen si alguien está afiliado y activo hoy; no dicen cuántos de los últimos doce meses cotizó. Así
que `monthsContributedLast12` **no es respondible** por esta vía, y `formality` se degrada de
*"cotiza, y con qué continuidad"* a *"está activo hoy"*. Es menos, y hay que decirlo en pantalla.

*Y el obstáculo práctico, que resultó no serlo:* el análisis dio RUAF por ausente del catálogo de
Croma. **Está**: `/co/ruaf/affiliations/v1`, comprobado en vivo el 2026-09-20 y guardado en el
inventario. La mejor de las dos señales también está disponible.

*Decisión:* D-12 se mantiene tal cual mientras la fuente sea ADRES. Como RUAF sí está, `formality`
se apoyará en la afiliación a ARL, la regla asimétrica deja de hacer falta **por esa vía**, y la
exclusión de Sisbén no cambia.

*Nivel de evidencia:* que BDUA y RUAF existen y para qué los usan los operadores está **verificado
en fuente primaria**. Qué campos expone cada uno —régimen, estado, tipo de afiliado, ARL— es
**supuesto propio** hasta ver una respuesta real.

### D-21 — Se presentan respuestas firmadas, no credenciales · 2026-09-20

El handoff de diseño del día 8 encontró el hueco: `AttestedCredential` lleva `claim` y `salt`
porque `verifyCredential` los necesita para abrir el compromiso. Entregarla a una contraparte le
entrega el ingreso, la referencia del sujeto y todo lo demás, por mucho que la pantalla no lo
muestre. Una pantalla no es un límite de privacidad.

*Las dos salidas, y cuál se toma:* una **prueba de predicado** oculta el testigo y es hacia donde
va el producto, pero exige la vía ZK medida en un teléfono real. Una **atestación de resultados**
—el emisor evalúa los predicados contra los umbrales que nombra la solicitud y firma las
respuestas— es construible hoy. Se toma la segunda, con sus costos escritos, no disimulados:

- el emisor ve la evidencia —siempre la vio— pero ahora además sabe **qué contraparte preguntó**,
  porque las respuestas van atadas a la sesión;
- el emisor tiene que estar disponible en el momento de la solicitud, así que un umbral nuevo no se
  responde offline desde una credencial vieja;
- la contraparte **confía** en la evaluación del emisor en vez de comprobarla, que es justo lo que
  la vía ZK elimina después.

*Lo que no se hace:* llamar ZK a esto, ni prometer no correlación por ocultar un nombre.

### D-22 — La revocación tiene tres estados, y quien acepta declara su política · 2026-09-20

`IssuerRegistry.isRevoked` devolvía un booleano opcional, y eso obliga a mentir en una de las dos
direcciones: un registro inalcanzable tiene que aparecer como *vigente* o como *revocado*, y
ninguna de las dos es cierta. Ahora hay `live`, `revoked` y `unknown`, y los dos primeros llevan la
**fecha del snapshot**: validar una firma sin conexión demuestra que el emisor firmó, no que hoy
siga vigente.

*Decisión:* qué hacer ante `unknown` o ante un snapshot viejo **no lo decide el producto**, lo
decide quien acepta, y lo declara en su política. Una notaría que registra una transferencia puede
rechazar; una comprobación de bajo riesgo puede aceptar dejando constancia. Una aceptación
cualificada devuelve esa nota, así que el titular puede saber que su respuesta se aceptó con
reservas.

*Y el orden importa:* el nullifier se reclama en el **último** paso y en uno solo. Cualquier
rechazo anterior —firma, atadura, evidencia, revocación— deja la credencial intacta, porque un
fallo que no es del titular no puede dejarlo sin poder responder. La misma presentación repetida es
**idempotente**; una distinta bajo el mismo nullifier es un replay.

*Lo que sigue faltando:* el registro en memoria no da persistencia ni atomicidad entre procesos. En
producción, `NullifierLedger` se implementa contra una transacción de base de datos.

### D-23 — El dominio no importa nada que un teléfono no tenga · 2026-09-20

El handoff del día 8 lo dijo sin rodeos: *"no es correcto asumir que TypeScript sin dependencias
funciona en React Native"*. `attestation/` importaba `node:crypto` y usaba `Buffer`, y ninguna de
las dos cosas existe en un teléfono.

*Decisión:* tres seams, no tres dependencias.

| Qué | Puerto | Node lo enlaza en | La app lo enlazará con |
|---|---|---|---|
| Hash | `FieldHash` + `createFieldHash` | `@knowni/core/node` | `@noble/hashes` |
| Aleatoriedad | `RandomSource`, con Web Crypto por defecto | automático | `expo-crypto` |
| Firma ed25519 | `SignaturePort` | `@knowni/attestation/node` | `@noble/curves` |

`Buffer` desaparece de `core/`, `attestation/` y `sources/` a favor de `Uint8Array` y de un módulo
`bytes.ts` con hex, UTF-8, enteros big-endian y prefijo de longitud. Los bytes firmados no cambian:
las mismas pruebas de firma y de compromiso siguen pasando sin tocar un vector.

*Y se vigila:* `core/test/portable.test.ts` falla si alguien vuelve a importar un builtin de Node o
a usar `Buffer` en el dominio. La regla deja de depender de que alguien se acuerde.

### D-25 — La llave del proveedor vive en un servicio, no en el teléfono · 2026-09-21

Pedir que "Croma funcione en la app" tiene una respuesta correcta y una cómoda. La cómoda es meter
`CROMA_API_KEY` en el bundle: funciona en el demo y convierte el producto en un buscador de personas
con un paso extra, porque cualquiera que instale la app puede consultar a cualquiera.

*Decisión:* un servicio de emisión (`issuer/`) es el único proceso que tiene la llave. El teléfono
manda una **consulta autorizada por el titular** —documento, placa y qué fuentes aceptó— y recibe
respuestas firmadas que verifica por su cuenta contra la llave pública del registro.

*Lo que eso hace cumplir, y que una app con la llave no podría:* una fuente sin consentimiento no se
llama; una fuente que no responde produce `unavailable` y nunca `false`; y nada del proveedor cruza
el límite, ni el número consultado ni el nombre que devuelve la Procuraduría.

*Lo que cuesta:* la app deja de funcionar sola. Sin el emisor corriendo dice que no lo encontró y no
consulta nada — que es la respuesta honesta, no un fallback inventado.

### D-26 — Paga quien pregunta; pagar no es autorizar · 2026-09-21

El modelo pasa a cobro por consulta con wallet. La pregunta que decide el producto no es cómo se
cobra, sino **a quién**, y hay dos respuestas posibles con consecuencias opuestas.

*Decisión: dos productos, dos pagadores.*

| Producto | Quién paga | Qué compra |
|---|---|---|
| **Verificación vinculada a una solicitud** | la contraparte que pregunta | una respuesta atada a `sessionId`, audiencia y finalidad, que sirve una vez |
| **Credencial reutilizable** | el titular, si quiere | un activo suyo que presenta en diez trámites sin volver a consultar |

*Los roles, por tipo de contrato:*

| Contrato | Paga | Prueba |
|---|---|---|
| Arrendamiento | arrendador o inmobiliaria | arrendatario y codeudor |
| Compraventa de vehículo | comprador | vendedor y el activo |
| Crédito | prestamista | solicitante |
| Proveedor B2B | empresa compradora | proveedor |
| Empleo o plataforma | empleador o marketplace | candidato o trabajador |

*Por qué no al revés.* Si paga quien prueba, la contraparte pide de más porque no le cuesta nada, y
el producto se vuelve *"paga para demostrar que mereces"* — el mismo peaje que hoy cobra el estudio
de arrendamiento, con una app encima. Con la contraparte pagando, el precio por predicado es lo que
desincentiva pedir más de lo necesario, que es exactamente el comportamiento que el producto existe
para cambiar.

*La regla que protege al titular:* **pagar no es autorizar**. Quien paga compra el derecho a
preguntar; solo el titular puede consentir que se consulte. Un pago sin consentimiento no emite
nada, y un consentimiento revocado detiene la consulta aunque esté pagada.

*Tres reglas del cobro:*

1. **Se cotiza antes de consentir.** El precio sale por predicado y el pagador ve el total antes de
   que se llame a una sola fuente.
2. **Una fuente que no responde no se cobra.** `unavailable` no es una respuesta vendible, y
   cobrarla crearía el incentivo de no arreglar la fiabilidad de las fuentes.
3. **El pago se ata a la pregunta.** La transacción lleva en el memo el hash del `sessionId`, así
   que un tercero puede comprobar que ese pago corresponde a esa consulta y a ninguna otra, sin
   aprender quién preguntó ni sobre quién.

*Supuesto de mercado sin verificar:* en Colombia el estudio de arrendamiento se le suele trasladar
al arrendatario vía aseguradora. Si eso se confirma, el argumento comercial es sustituir ese cobro,
no sumarse a él. Va a `verificacion.md` como pendiente.

## Bitácora

| Fecha | Qué pasó |
|---|---|
| 2026-09-20 | Arranque. `core`, `sources`, `retrieval`, `anchoring`, `journey`. 111 pruebas. Circuitos y contrato escritos sin compilar |
| 2026-09-20 | Corrección de Croma. Rutas reales tomadas del prototipo notarial. Documentada la deuda de `retrieval/` |
| 2026-09-20 | Decisión de móvil: nativo iOS + Android sobre React Native |
| 2026-09-20 | Adoptada la constitución de `procedures/templates/AGENTS.md`: commits de una línea sin trailers, cabeceras en `.md`, reparto por agente |
| 2026-09-20 | Corregida la atribución del trabajo previo de Croma. De ahí salen D-09, D-10 y D-11 |
| 2026-09-20 | Revisado el catálogo real de Croma para Colombia. PILA y SNR **no están**; aparecen ADRES y RUNT/SIMIT, y aparece Sisbén. De ahí salen D-12 y D-13 |
| 2026-09-20 | Reencuadre del producto: es contract-agnostic. `Purpose` deja de ser una unión cerrada — D-14. 116 pruebas |
| 2026-09-20 | PILA contra fuente primaria (ABECÉ MinSalud, jun 2018). Confirma el piso de 1 SMLMV y el conteo por meses; rompe el supuesto de que existe vía de consulta — D-15 |
| 2026-09-20 | Investigación de fuentes y continuidad: credencial, prueba, registro y anclaje quedan separados — D-16 y plan posthackathon |
| 2026-09-20 | F0 día 1 del plan: `LICENSE` Apache-2.0, workflow de CI en Node 22 y 24, y el README corregido a 116 pruebas. Suite verde desde un clon limpio |
| 2026-09-20 | Cliente HTTP de Croma contra el contrato documentado, probado sin red con `fetch` y `sleep` inyectados. El día 2 del plan (inventario de endpoints contratados) sigue bloqueado: no hay `CROMA_API_KEY`. 133 pruebas |
| 2026-09-20 | Día 2 cerrado con llave real: `/catalog` es público y da 87 endpoints de Colombia con esquema y límite. Corrige la ruta de ADRES y la del historial RUNT, y aparece RUAF, que el análisis daba por ausente. 137 pruebas |
| 2026-09-20 | Días 3–4: los cuatro adaptadores del perfil de compraventa, contra los esquemas que publica el propio OpenAPI de Croma. Obliga a dos predicados nuevos en `core` — `capacity` y `assetStanding` — D-17. 165 pruebas |
| 2026-09-20 | `sources/src` se reordena por jurisdicción: `country/colombia/` para los adaptadores y `providers/croma/` para el transporte. Añadir un país es una carpeta, no un cambio en el dominio |
| 2026-09-20 | Jev (`typesafe-ai/jev`, vía Vercel AI Gateway) entra solo como herramienta de desarrollo, con medidor de gasto versionado. Precio verificado: $0,042 por millón de tokens de entrada, salida $0. No responde en `/v1/chat/completions`: es modelo de evaluación |
| 2026-09-20 | Día 5: primer anclaje real en Stellar testnet, con XDR, StrKey y firma ed25519 escritos a mano para no romper la regla de cero dependencias. La firma va sobre el **hash** de la base, no sobre la base — firmarla al revés da `tx_bad_auth` con un sobre bien formado |
| 2026-09-20 | Día 6: workspace `attestation/`. El emisor firma la raíz una vez y la contraparte verifica firma, inclusión y apertura sin red ni cadena. Regla nueva: la ausencia de respuesta del registro **no** es una revocación — D-18 |
| 2026-09-20 | Día 7: la contraparte firma su solicitud y la respuesta queda atada a audiencia, finalidad, reto y parámetros. El nullifier se gasta **solo al aceptar**: una presentación rechazada no puede dejar al titular sin credencial — D-20 |
| 2026-09-20 | P0 del handoff del día 8: `AttestedCredential` entregaba `claim` y `salt` a la contraparte. Se separa lo que se guarda de lo que se presenta — el emisor firma las respuestas, atadas a la sesión — y la aceptación las verifica antes de gastar el nullifier. No es ZK y el código lo dice — D-21 |
| 2026-09-20 | Segundo P0: orquestación de aceptación en cinco pasos, con la revocación en tres estados y el consumo del nullifier al final y en un solo paso. Una presentación repetida es idempotente; otra distinta bajo el mismo nullifier es replay — D-22 |
| 2026-09-20 | Regla dura del usuario, aplicada a todo el repositorio: cabecera de nombre de archivo y 2–3 líneas en **cada** archivo, y comentarios solo donde el bloque no se explique solo. 65 archivos, 146 bloques narrativos fuera. Salda la deuda de cabeceras |
| 2026-09-20 | Día 9: recorrido con `fetch` reemplazado por algo que lanza —cualquier ruta que busque red falla la prueba— y con la cadena caída. Y una prueba de redacción contra fuentes que devuelven el documento en su propio error. 236 pruebas |
| 2026-09-20 | Día 10: auditoría de afirmaciones del README contra lo que corre —doce afirmaciones, dos con matiz y una corregida— y guion de los dos videos en `design/demo/guion.md`. Queda pendiente hacer público el repositorio, que las bases exigen |
| 2026-09-20 | App B1: el dominio deja de depender de `node:crypto` y de `Buffer`. Hash, aleatoriedad y firma ed25519 pasan a ser puertos; cada plataforma los enlaza en su propio `node.ts` o en la app. Una prueba lo vigila — D-23 |
| 2026-09-20 | Pruebas reorganizadas en `unit · fuzz · invariant` con sufijo `.spec.ts`, como pide la constitución. Los tres fuzz nuevos encontraron un fallo real: una firma ausente o malformada hacía **lanzar** a `verifyResults` en vez de devolver `bad_signature`. Corregido. 249 pruebas |
| 2026-09-20 | App B2: ocho pantallas en Expo con fixtures, tipos limpios y bundle de iOS generado. `app/` queda **fuera** de los workspaces de la raíz para que el dominio siga instalándose sin dependencias — D-24 |
| 2026-09-20 | App B3: el dominio entra en el teléfono. `@noble` produce **los mismos bytes** que `node:crypto` —hay prueba cruzada— y el bundle de Hermes contiene los dominios de firma del protocolo. Las pantallas 02 y 05 dejan de leer fixtures |
| 2026-09-20 | App B4: la pantalla del verificador ejecuta `acceptAnswer` de verdad, con el estado de revocación y la política como controles en pantalla. La 08 lee el `unavailable` que **firmó el emisor**, no un texto fijo |
| 2026-09-21 | App al SDK 57 de Expo (router 57, React Native 0.86.3, React 19.2.3). `expo-doctor` 21/21, tipos limpios, 9 pruebas y bundle de iOS con el dominio dentro. La corrida del usuario en su teléfono destapó el desajuste de versiones que el bundle verde no veía |
| 2026-09-21 | MVP real: workspace `issuer/` — el único proceso con llave de proveedor. La app manda una consulta autorizada y verifica en el teléfono lo que le devuelven. Se acaban las fixtures en el recorrido: documento y placa se escriben, el consentimiento decide qué se consulta — D-25 |
| 2026-09-21 | Modelo comercial: paga quien pregunta, y pagar no autoriza. El titular solo paga si quiere una credencial reutilizable — D-26 |
| 2026-09-20 | RUAF y ADRES no reemplazan PILA para `solvency`; RUAF mejora `formality` y quita la asimetría de D-12 por esa vía — D-16 |

## Límites de proceso — estado del ejercicio real

La constitución exige que todo lo que cruza un límite de proceso se ejercite contra la cosa real al
menos una vez.

| Límite | Estado |
|---|---|
| Croma REST | ✅ **ejercido el 2026-09-20**: `/catalog` (200), 16 rutas sondeadas con cuerpo vacío (400/404) y `/co/rues/entities-by-name/v1` (200) sobre una empresa pública. Ninguna llamada sobre una persona |
| Stellar Horizon / RPC | ✅ **ejercido el 2026-09-20**: cuenta creada con friendbot y transacción `0dc0fdf4…` aceptada en el ledger 4783364 |
| Contrato Soroban | ⏳ nunca compilado ni desplegado |
| Circom / snarkjs | ⏳ nunca compilado |
| Teléfono físico | ⏳ nunca ejecutado |

Ningún número medido aparece en este repositorio.
