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

### D-27 — Privy firma, Freighter firma, y ninguno envía · 2026-09-21

*Verificado en la documentación el 2026-09-21:* Privy clasifica Stellar en **nivel 2 — firmar**, no
enviar; enviar solo está en nivel 3 (Ethereum, Solana, Tempo, Tron). Freighter tiene apps de iOS y
Android e integra con una app móvil por **WalletConnect**, no por la API de la extensión.

*Decisión:* un `PayerWalletPort` con tres adaptadores —Privy, Freighter y la llave del dispositivo—
y el envío a Horizon en código propio, que ya existe desde el día 5. Ninguno de los dos wallets
envía, así que el camino común no es una concesión: es el único que hay.

*Y el saldo no es una función del wallet.* Un saldo en Stellar es público: se lee de Horizon por
`accountId`. Una sola ruta de código lo muestra para los tres, y una cuenta sin fondear se lee
vacía en vez de como error.

*La línea que no se cruza:* Privy solo para **quien paga**. Un proveedor de login sabe quién entró y
cuándo; ponerlo del lado del titular le entrega a un tercero el rastro de quién demostró qué, que es
justo lo que el producto existe para no dejar. El titular sigue con llaves en el dispositivo.

*Sobre el aviso:* Kapso revende la Cloud API de Meta, igual que Twilio o 360dialog, así que la
capacidad es la de Meta y lo que se elige es la demo. El mensaje avisa y **no informa** — ni
veredicto, ni contraparte, ni finalidad —, porque un WhatsApp se lee en una pantalla bloqueada y
termina en el backup de otro teléfono. El teléfono es PII nueva: va por petición, con
consentimiento aparte, y no se guarda junto a la consulta.

### D-28 — Tres evidencias, tres credenciales; `solvency` las estaba mezclando · 2026-09-21

Un IBC, una nómina y un movimiento bancario responden preguntas distintas y se equivocan en
direcciones distintas. Meterlos en un solo `income` con un `basis` decorativo era dejar que una
contraparte leyera "cotizó sobre X" como "tiene X disponible".

| Evidencia | Qué dice | Qué **no** dice |
|---|---|---|
| `contribution_base` | base declarada para aportes (PILA) | ingreso neto, liquidez, probabilidad de pago |
| `verified_income` | pago laboral o tributario observado | liquidez actual, continuidad |
| `cashflow` | entradas en una cuenta consentida | empleo, aportes |

*En código:* `IncomeBasis` pasa a ser esas tres, `BASIS_DOES_NOT_ESTIMATE` viaja con cada una, y el
reclamo gana `periodsObserved` y `periodsWindow` — un mes bueno deja de parecerse a un año de ellos.

*Y el predicado se vuelve estricto:* una lista `acceptedBases` vacía **no acepta nada**, porque una
contraparte que no nombró qué evidencia toma no hizo una pregunta. Cuántos periodos son suficientes
lo fija quien pregunta, en `minPeriodsObserved`, no la fuente.

### D-29 — Ruta de acceso al IBC: integración delegada primero, documento solo como excepción · 2026-09-21

*Verificado el 2026-09-21:* Belvo publica Brasil, México y Chile — **Colombia no aparece** en su
spec. Prometeo tiene la documentación tras login y su cobertura colombiana no está confirmada.
SuAporte sí publica Swagger, pero sus dos APIs —`Gestión de Aportantes` y `Generador de Planilla`—
son del lado de **quien paga** la planilla, no de quien quiere demostrar lo que cotizó.

*Orden de producto, con lo que cada cosa aporta:*

1. **Aportes en Línea** — tiene el histórico y su política ya contempla entregar historial PILA a
   terceros para validar experiencia laboral. Es la ruta principal, condicionada a contrato y
   autorización delegada. Se pide el resultado reducido: periodos cotizados, banda de IBC, último
   periodo y cobertura del operador. Nunca el PDF.
2. **Agildata** — un manual de 2019 describe exactamente el adaptador que falta: IBC por periodo,
   promedio de tres meses, días cotizados y acceso bajo autorización del titular. La evidencia es un
   manual alojado por un tercero, así que **no entra al roadmap** hasta identificar quién lo opera.
3. **UGPP / VUE, Estado Único de Cuenta** — no es API ni certificación verificable públicamente.
   Solo puede entrar como fallback asistido: el titular aporta el documento, una persona revisa su
   procedencia y el resultado conserva `needs_human_review`. Tiene costo operativo, cubre apenas
   cuatro meses y no habilita emisión automática ni es el piso del MVP.
4. **Finerio Connect o Bancolombia Open Banking** — alimentan `cashflow`, que es otra credencial, no
   un sustituto del IBC.

*Lo que no se integra:* CoreSoft —consulta por documento en la URL, devuelve el expediente completo
y no muestra autorización delegada—, SuAporte con credenciales reutilizadas del ciudadano, y
cualquier proveedor de open finance sin cobertura colombiana confirmada por contrato.

*Consecuencia operativa:* si Aportes en Línea u otro operador no ofrece autorización delegada, el
predicado `contribution_base` queda `unavailable`. Knowni no rellena ese hueco convirtiendo un PDF
sin verificación pública en evidencia automática. Un piloto puede habilitar la revisión manual de
UGPP con precio, SLA y responsabilidad humana explícitos; no puede presentarla como API.

### D-30 — Passkey es la puerta; el proveedor sostiene la cuenta, no la llave · 2026-09-21

*Comparado el 2026-09-21, contra la documentación de cada uno:* Clerk tiene SDK de Expo y passkeys,
pero de pago en producción y sus componentes nativos no corren en Expo Go. Auth0 cobra $35/mes por
500 MAU y su soporte de React Native no aparece en su guía de passkeys. Privy tiene `@privy-io/expo`,
passkeys en móvil y —lo que decide— **wallet embebida que firma Stellar**.

*Decisión:* Privy, porque login y wallet son el mismo problema para quien paga y partirlos en dos
proveedores duplica la cuenta y el rastro.

*Verificado en el SDK instalado, no en un blog:* `CurveSigningChainType` incluye `'stellar'`, y
`@privy-io/expo/extended-chains` expone `useCreateWallet({chainType:"stellar"})` y `useSignRawHash`.
Firma un **hash crudo**, que es exactamente lo que Stellar firma —el SHA-256 de la base—, así que el
envío sigue siendo nuestro submitter del día 5.

*La sesión, escrita como regla:* passkey como puerta, magic link **solo** para recuperar —un buzón
se toma más fácil que un dispositivo—, 15 minutos de vida y atada al dispositivo donde se abrió. En
la sesión no hay ni una contraseña de ninguna fuente, y hay una prueba que enumera sus campos.

*Lo que no cambia:* el proveedor sabe quién entró y cuándo. Por eso sostiene la **cuenta**, no la
llave del titular, y la identidad de quien paga no es un secreto del producto — es el punto.

### D-31 — `/issue` exige una llave de contraparte, independiente del pago · 2026-09-21

*El hueco:* `docs/handoff.md` lo marcaba como el más grande que quedaba. Sin `KNOWNI_TREASURY_ACCOUNT`
—una de las llaves pendientes— `POST /issue` no pedía nada: cualquiera con la URL gastaba la cuota
real de Croma, sin pagar y sin quedar identificado.

*Decisión:* una llave por contraparte (`KNOWNI_ISSUER_ACCESS_KEYS`, separadas por coma), comprobada
antes de leer el cuerpo de la petición —antes de consentimiento, antes de pago, antes de tocar
Croma—. Sin al menos una llave configurada el proceso no arranca, igual que sin `CROMA_API_KEY`: una
frontera de seguridad no es una función que se apaga sola, se cae cerrada.

*Por qué no basta con el pago:* D-26 ya separa pagar de autorizar. Aquí el mismo principio corre al
revés — identificar a quien pregunta tampoco depende de que haya pagado. Una llave sin pago sigue
sin poder consultar (la política de pago, si está activa, se comprueba después); un pago sin llave
ni siquiera llega a esa comprobación.

*Cuota, no solo identidad:* una llave filtrada o compartida no puede agotar sola el presupuesto de
Croma — `KNOWNI_ISSUER_RATE_LIMIT_PER_MINUTE` limita cada llave (20/min por defecto), con ventanas
en memoria por llave, nunca compartidas entre contrapartes.

*Lo que quedaba fuera de este cambio:* cachear una pregunta idéntica repetida. Quedó resuelto luego
como caché volátil y single-flight en D-35; la persistencia entre procesos sigue separada.

### D-32 — El EUC de UGPP no trae verificación pública; el camino documental espera a un humano · 2026-09-21

*Lo investigado:* si el Estado Único de Cuenta trae código de verificación, QR o firma electrónica
que `checkAuthenticity` (el puerto que ya exige `sources/src/country/colombia/ugpp.ts`) pudiera
comprobar sin depender de una persona. Revisadas las dos fuentes primarias de UGPP —la página del
EUC y la Ventanilla Única (`vue.gov.co`)— y el único manual público de UGPP con la palabra
"verificación" (`storm_web_manual.pdf`, que resultó ser de un sistema distinto, para operadores que
le reportan a UGPP, no para el ciudadano).

*Lo que no apareció:* ningún mecanismo público de verificación. El documento se describe solo como
"enviado al correo registrado" — sin código, sin QR, sin portal de terceros documentado.

*Lo que sí apareció, y pesa más:* la propia página de UGPP dice del EUC que "no es una certificación
válida para trámites de prestaciones económicas" y remite al Ministerio de Salud para eso. Un
documento que su propio emisor no reconoce como certificación no es candidato a verificación
automática — sería construir una comprobación técnica sobre una fuente que UGPP mismo no respalda
para este uso.

*Decisión:* el camino documental UGPP no cierra `checkAuthenticity` con una llamada automática. Con
la evidencia disponible hoy, `needs_human_review` —que el adaptador ya devuelve cuando la
comprobación falla— es el estado correcto, no un placeholder temporal. Reabrir esto solo si UGPP
publica un mecanismo propio o si una conversación comercial con UGPP (no encontrada en fuente
pública) entrega uno.

*Lo que no cambia:* el bloque 3 de `docs/handoff.md` sigue bloqueado, pero ahora con una razón
verificada en vez de una pregunta abierta.

### D-33 — La cotización nombra el activo; un número no nombra dinero · 2026-09-21

*El hueco encontrado al cerrar el pago móvil:* `pricing.ts` decía USDC, mientras el verificador de
Horizon sumaba cualquier operación enviada al tesoro y el cliente no recibía ni destino ni activo.
Una cantidad de XLM —o de un activo basura con el mismo decimal— podía parecer el precio en USDC.

*Decisión:* `/quote` publica términos completos: red, destino, activo (código e emisor), monto en la
unidad mínima y `paymentRef`. La app no infiere uno de otro: construye exactamente esos términos.
El emisor vuelve a derivar el precio desde la solicitud y exige el mismo activo antes de consultar
Croma. En este piloto el activo de cobro es USDC configurado; XLM no es sustituto implícito.

*Firma sin custodia:* Privy recibe el hash de la base de firma y la app adjunta su firma decorada;
Freighter recibe el sobre sin firmar. Antes de enviarlo, la app comprueba que Freighter devolvió el
mismo cuerpo de transacción con al menos una firma. Ninguna ruta conserva seed, firma o XDR.

*El orden es parte de la seguridad:* el cliente ejecuta `quote → firma → Horizon → issue`. Si la
wallet o la red rechazan, `/issue` no se llama y Croma no se consulta. Omitir el pago solo es válido
cuando `/quote` declara explícitamente `paymentRequired: false`; términos ausentes con cobro activo
son un error, no una ruta gratuita.

*Límite honesto:* los contratos están cubiertos sin red, pero faltan las llaves para una firma real
con Privy/WalletConnect y una transacción USDC testnet. Eso permanece en `verificacion.md`.

### D-34 — El conjunto gastado sobrevive al proceso, y el almacén es un puerto · 2026-09-22

*El hueco:* `createMemoryNullifierLedger` vive en el proceso. En el teléfono del verificador eso
significa que **al reiniciar la app el conjunto gastado queda vacío**, y una presentación ya gastada
vuelve a aceptarse. D-22 dice que el nullifier se gasta una sola vez; en memoria esa regla dura lo
que dure el proceso.

*Decisión:* `NullifierStore` entra como puerto —`load` y `append`, ambos asíncronos— y
`createPersistentNullifierLedger(store)` hidrata una vez al arrancar y luego decide en memoria.
`attestation/` sigue sin saber qué es un teléfono, un archivo ni una base: D-23 no se toca.

*Por qué `claim` sigue siendo síncrono:* `acceptAnswer` consume el nullifier en un solo paso — D-22.
Un `await` ahí abre exactamente la ventana que el ledger existe para cerrar, así que la decisión se
toma contra el mapa hidratado y **lo que va detrás es la escritura**, no la decisión.

*Lo que se reporta en vez de tragarse:* si `append` falla, el reclamo ya vale en este proceso pero se
perderá en el próximo arranque. Eso es una degradación y sale por `onWriteError`, no en silencio.
Una escritura fallida nunca convierte un `replayed` en un `claimed` dentro del proceso.

*Lo que falta, y de quién depende:* elegir el almacén del dispositivo. `expo-secure-store` ya es peer
dependency **no instalada** de `@privy-io/expo`, pero está pensado para secretos y tiene tope de
tamaño por valor: un conjunto que crece no cabe ahí. `@react-native-async-storage/async-storage` es
la forma correcta para una lista que crece. Es una dependencia nativa nueva y no se puede ejercer sin
el criterio A12, así que la elige el titular. Hasta entonces `app/src/domain/verifier.ts` sigue con
el ledger en memoria y lo dice en su comentario; el cambio es un argumento.

### D-35 — La idempotencia liga al sujeto sin convertirlo en identificador · 2026-09-22

*El error evitado:* `paymentRef` liga contraparte, finalidad, reto, parámetros y predicados, pero no
al sujeto. Es correcto para el pago y la privacidad; es insuficiente como clave de caché. Dos
personas respondiendo la misma solicitud podrían compartir referencia y recibir el sobre ajeno.

*Decisión:* la clave de emisión es un HMAC con la semilla secreta del emisor sobre contraparte,
documento, activo, consentimientos, `paymentRef` y `paymentTx`. Solo el digest vive en memoria. No se
guarda cédula, placa, teléfono, llave de acceso ni payload de Croma, y el mismo conjunto bajo otra
contraparte produce otra clave.

*Semántica:* entradas idénticas concurrentes comparten una promesa. Solo el productor comprueba el
pago, consulta Croma, firma y notifica; los retries esperan el mismo resultado. Un fallo no se
cachea. La entrada expira exactamente con el sobre firmado y el proceso limita cuántas conserva.
El caché sigue siendo volátil: persistencia y coordinación entre réplicas permanecen pendientes.

### D-36 — AsyncStorage guarda el conjunto gastado, y sin leerlo no se acepta nada · 2026-09-22

*La elección, que D-34 dejó abierta:* **`@react-native-async-storage/async-storage`**, no
`expo-secure-store`. SecureStore está pensado para secretos y tiene tope de tamaño por valor; el
conjunto gastado **crece** con cada aceptación y no cabe ahí. Además un nullifier no es un secreto:
es un identificador opaco de una respuesta ya usada, y quien tenga el teléfono ya vio la respuesta.
Lo que se necesita es durabilidad, no confidencialidad.

*Una llave por nullifier*, no una lista bajo una sola llave: así `append` es una escritura y nunca un
lee-modifica-escribe que dos aceptaciones concurrentes puedan pisarse. `load` barre el prefijo
`knowni/nullifier/v1/`.

*Lo que pasa antes de que el disco conteste:* hidratar es asíncrono y `verifyOnDevice` es síncrono.
Un ledger que todavía no leyó su historia **no puede distinguir un replay de una primera
presentación**, así que en esa ventana el verificador **rehúsa**, no acepta. Es la misma regla de
siempre: "no lo sabemos todavía" nunca se convierte en un "sí". `_layout.tsx` hidrata al arrancar,
junto a `installPlatformCrypto`.

*Dónde vive el módulo nativo:* solo en `app/src/domain/nullifier-store.ts`. `verifier.ts` recibe el
almacén como argumento, así que sigue corriendo bajo Node en las pruebas y `attestation/` sigue sin
saber qué es un teléfono — D-23 intacto.

*Lo que sigue sin ejercerse:* nadie ha escrito en el AsyncStorage real. Las pruebas cubren el
cableado con un almacén falso, incluida una entrada "de una corrida anterior" que se detecta como
replay. La escritura de verdad espera al criterio A12.

### D-37 — Cobrar y persistir el gasto se encienden juntos, o ninguno · 2026-09-22

*El hueco:* `createMemorySpentPayments` muere con el proceso. D-26 dice que una transacción paga una
sola pregunta; en memoria esa regla dura lo que dure el emisor. Al reiniciar, una transacción ya
canjeada **vuelve a comprar una emisión**, y cada emisión gratis gasta cuota real de Croma.

*Decisión:* `SpentPaymentStore` entra como puerto —`load` y `append`— con
`createPersistentSpentPayments`, calcado de `NullifierStore` de D-34: mismo agujero, misma forma. Y
`KNOWNI_SPENT_PAYMENTS_FILE` **es obligatorio cuando hay tesorería configurada**: el emisor se niega
a arrancar cobrando con un conjunto gastado volátil. Cobrar sin durabilidad no es una versión más
simple de cobrar, es un agujero, así que las dos cosas se encienden juntas o ninguna — como D-31.

*Sin cobro no hay nada que persistir:* sin tesorería el servicio responde gratis y el conjunto
gastado sigue en memoria, porque no hay pago que canjear dos veces.

*Por qué `claim` sigue siendo síncrono:* es el último paso de `verifyPayment` y se toca solo después
de que todo lo demás pasó. Un `await` ahí es exactamente la ventana que necesita un doble gasto. La
decisión sale del conjunto hidratado; **la escritura es lo que trailea**, y si falla se reporta en
vez de tragarse.

*Append-only, una línea por hash:* registrar un gasto es un `appendFile` y nunca un
lee-modifica-escribe que dos emisiones en vuelo puedan perderse. Un fichero que todavía no existe es
un conjunto vacío —el primer arranque—, pero **cualquier otro error de lectura corta el arranque**:
tratar un disco ilegible como "no hay gastos" reabriría todos a la vez.

*Ejercido contra la cosa real,* que es lo que la constitución pide de un límite de proceso: las
pruebas escriben y releen un fichero de verdad en un directorio temporal, y el arranque se ejecutó en
los tres casos —cobrando sin fichero (rechaza, `exit 2`), cobrando con fichero (arranca) y sin cobrar
(arranca en memoria y lo dice).

### D-38 — La escritura del gasto cierra antes de tocar Croma, y si falla suelta el reclamo · 2026-09-22

*El hueco que dejó D-37:* `claim` decide en memoria y lanza la escritura sin esperarla. Entre el
reclamo y el aterrizaje del `append` hay una ventana: si el proceso muere ahí y la escritura falló,
la transacción vuelve a ser canjeable. Estrecha —el append son milisegundos y después vienen hasta
83 s de Croma—, pero la feature entera de D-37 existe para que una transacción no pague dos veces.

*Decisión:* `SpentPayments` gana `settled?(): Promise<void>` —opcional, porque el almacén en memoria
no tiene nada que esperar— y `/issue` lo espera **después** de que `verifyPayment` devuelva `paid` y
**antes** de `issueAnswers`, que es lo que gasta cuota de Croma. Si rechaza, el emisor responde
`503 payment_not_durable` y no consulta ninguna fuente. `claim` sigue síncrono: el `await` está en el
handler, no en la decisión, así que la ventana del doble gasto no se reabre.

*La sub-decisión que D-37 dejó abierta — qué pasa con el pago cuando el disco falla:* **se suelta el
reclamo**. Quemarle la transacción a un comprador por un error de disco transitorio es peor que la
ventana que esto reabre, que exige peticiones concurrentes *y* disco fallando a la vez. El invariante
"una emisión por transacción" se mantiene porque **no hubo emisión**: la escritura es lo que hace
real al gasto, y sin gasto real no hay respuesta firmada. Esto cambia la prueba de D-37 que decía lo
contrario.

*Las escrituras no rechazan solas:* el fallo se guarda y solo sale por `settled()`. Un llamador que
nunca pregunta si aterrizó no puede tumbar el proceso con un `unhandledRejection`.

*Ejercido:* un almacén cuyo `append` falla produce `503` y **cero llamadas a Croma** —el contador de
llamadas al proveedor es la prueba—, y la transacción vuelve a ser reclamable después.

### D-39 — El caché sobrevive al reinicio, pero perderlo nunca impide arrancar · 2026-09-22

*El hueco:* el caché idempotente de D-35 es volátil y por proceso. Un reinicio —o una segunda
réplica— convierte un retry idéntico en una emisión nueva: Croma otra vez, hasta 83 s otra vez y la
cuota otra vez. La respuesta ya estaba firmada; solo se perdió el papel donde decía que existía.

*Decisión:* `IssuanceCacheStore` entra como puerto —`load`, `append`, `replace`— con
`createPersistentIssuanceCache`, calcado de `SpentPaymentStore` de D-37. Hidrata al arrancar y
responde desde memoria; el single-flight **se queda en el proceso** porque dos réplicas no pueden
esperar el trabajo en vuelo de la otra, y no hace falta que puedan: lo que se comparte es la
respuesta ya firmada.

*Opcional, y ahí está la diferencia con D-37:* cobrar sin conjunto gastado durable es un agujero
—una transacción paga dos veces— y por eso el emisor **no arranca**. Perder el caché cuesta **una
llamada repetida a Croma**: es dinero, no una respuesta incorrecta. Un costo no gatea el arranque,
así que `KNOWNI_ISSUER_CACHE_FILE` enciende la persistencia cuando está y no exige nada cuando no.

*La escritura trailea, como en D-37:* el comprador espera su respuesta, no nuestra contabilidad. Si
el `append` falla se reporta y la entrada se olvida —quedaría un caché que promete algo que el disco
no tiene—. El caché gana `settled?()` como los pagos en D-38, pero **nunca rechaza**: no hay decisión
que revertir, solo una llamada que se repetirá.

*Lo que no se guarda para siempre:* al hidratar se descarta lo ya expirado y se reescribe el fichero.
Una respuesta que nadie puede usar es retención sin propósito. El tope de entradas también se aplica
al cargar, y lo que se cae es lo que expira primero.

*Línea truncada = una respuesta, no el caché entero:* un JSONL cortado por una caída se salta. La
reescritura va por fichero temporal y `rename`, para que una caída a mitad no deje medio caché.

*Ejercido contra la cosa real:* el adaptador escribe y relee un fichero de verdad en un directorio
temporal, con reinicio real del caché, y el arranque se ejecutó en los dos casos —con fichero
(persiste, lo dice en el log) y sin él (memoria)—.

### D-40 — Una razón de rechazo que miente manda a arreglar lo que no era · 2026-09-22

*El hallazgo:* el ejercicio real del pago en testnet mostró que un pago que **sí** llegó a la
tesorería, pero en un activo distinto al cotizado, se rechazaba con `wrong_destination`. Rechazar
está bien —nunca fue un agujero, el activo se comprobaba—; lo que estaba mal es lo que el `402` le
dice al pagador: que el dinero fue a otra parte, cuando fue aquí.

*Decisión:* `wrong_asset` entra como razón propia. Si no hubo ningún pago a la tesorería sigue siendo
`wrong_destination`; si lo hubo y el activo no era el cotizado, es `wrong_asset`. Cambia el cuerpo
del `402` que ve la contraparte, por eso es decisión y no corrección silenciosa.

*Ejercido sobre la transacción real de la testnet,* la misma `fb64700b…`: preguntando por XLM
responde `wrong_asset`, preguntando por otra cuenta destino responde `wrong_destination`.

### D-41 — Las fuentes se preguntan a la vez, y la que no llega responde `unavailable` · 2026-09-22

*El hueco:* `issueAnswers` pedía las cuatro fuentes **en serie**, una esperando a la anterior, cuando
ninguna necesita la respuesta de otra. De ahí los 83 s medidos. Y el emisor esperaba a la más lenta
sin límite: una fuente colgada colgaba la emisión entera, el pago del comprador incluido.

*Decisión:* una tarea por fuente consentida y todas en vuelo a la vez. El orden de las respuestas lo
fija el orden de las tareas —`Promise.all` lo conserva—, no quién contesta primero, así que el sobre
firmado es el mismo venga como venga la red.

*El plazo, y qué pasa al vencerse:* `sourceDeadlineMs` —60 s por defecto,
`KNOWNI_SOURCE_DEADLINE_MS`— acota lo que una fuente puede hacer esperar. La que se pasa responde
**`unavailable`, nunca `false`**: "no pudimos preguntar" no es "la respuesta es no", y esa distinción
es el producto entero. Tampoco se cobra — `chargeableMinor` ya excluía `unavailable`, así que el
comprador paga por lo que recibió.

*Un plazo es una cota, no una medición:* 60 s no dice cuánto tarda una fuente, dice cuánto estamos
dispuestos a esperarla. El único número medido sigue siendo los 83 s de la emisión secuencial.

*Un adaptador que lanza también lee como `unavailable`:* la excepción se contiene en la tarea, y la
llamada que se pasó del plazo se deja terminar sola —nadie la espera y nadie se cae por ella—.

### D-42 — Ejecutar TypeScript no es comprobarlo, y el compilador encontró tres cosas · 2026-09-22

*El hueco:* la suite corre con `node --experimental-strip-types`, que **borra** los tipos sin
mirarlos. Solo `app/` pasaba por `tsc`; el resto del repositorio —`core`, `sources`, `issuer`,
`journey`— no había visto un compilador nunca. El criterio A14 pide typecheck en CI y no lo había
para el 90% del código.

*Decisión:* `tsconfig.json` en la raíz, `strict`, sobre los siete paquetes, y `npm run typecheck`
dentro de `npm run verify` y del job de CI que ya existía.

*Lo que apareció, que es el punto:* once errores, y tres no eran ruido de pruebas.

| Dónde | Qué |
|---|---|
| `sources/src/providers/croma/client.ts` | `import type ... from "../types.ts"` apuntaba a un fichero que no existe. Nunca falló porque un `import type` se borra al ejecutar: el compilador es lo único que podía verlo |
| `journey/.../redaction.invariant.spec.ts` | `createSanctionsSource(client)` con un argumento de menos. La prueba pasaba **por la razón equivocada**: sin la función de hash la fuente se degrada, y la prueba afirmaba `degraded` |
| `core/test/unit/predicates.spec.ts` | La prueba de "una base que la contraparte no aceptó" usaba `declared`, que no es una base que exista. Ahora usa `cashflow`, que existe y no está aceptada — que es lo que el nombre de la prueba dice |

*Lo demás eran pruebas mintiendo en pequeño:* un `toString("hex")` sobre un `Uint8Array` que lo
ignora, un campo duplicado por un spread, un `.reason` sobre una unión sin estrechar y un
`assert.equal(algo.anchor, undefined)` sobre un campo que no existe —ahora comprueba que la clave no
está, que es lo que quería decir—.

### D-43 — El repositorio ya se escribía como si el índice pudiera no existir · 2026-09-23

*El hueco:* `strict` no cubre el acceso por índice. `levels[i]` y `prev[i]` se tipan como el
elemento, nunca como `undefined`, aunque el arreglo esté vacío. El código de `core/src/merkle.ts`,
`core/src/bytes.ts` y los adaptadores ya venía escrito con `!` en cada acceso —la señal de que quien
lo escribió contaba con la comprobación—, pero nada la exigía. Un acceso nuevo sin `!` habría pasado
igual.

*Decisión:* `noUncheckedIndexedAccess` en `tsconfig.json`.

*Lo que costó:* cero errores. El repositorio entero ya cumplía la regla; lo que faltaba era que
alguien la hiciera obligatoria para lo que venga después. Los `!` existentes dejan de ser ruido que
un linter marca como innecesario y pasan a ser lo que siempre quisieron decir.

### D-44 — Un linter con tipos, y lo que encontró que el compilador no miraba · 2026-09-23

*El hueco:* A14 pide lint en CI y no había ninguno. `tsc` comprueba que los tipos cuadren; no
comprueba que un import siga usándose ni que una promesa acabe esperada por alguien.

*Decisión:* ESLint 9 con `typescript-eslint` en `recommendedTypeChecked` —reglas que leen el
grafo de tipos, no solo la sintaxis—, sobre los siete paquetes. `app/` conserva el suyo.
`npm run lint` entra en `npm run verify` y en el job de CI.

*Dos reglas apagadas, por razones del repositorio y no por conveniencia:*

| Regla | Por qué |
|---|---|
| `require-await` | Un adaptador implementa un puerto asíncrono. Que el de memoria no tenga a quién esperar no es un error: es lo que hace reemplazable al puerto |
| `no-floating-promises`, solo en `test/` | `test()` de `node:test` devuelve una promesa que el propio runner espera. Marcarla es ruido en 336 sitios |

*Lo que encontró, que es el punto:*

| Dónde | Qué |
|---|---|
| `issuer/src/service.ts` | El manejador de `createServer` era `async`, y Node espera un listener que devuelve `void`. Un rechazo fuera del `try` del camino de emisión no era un `500`: era un unhandled rejection que se lleva el proceso. Ahora se captura y responde `500` |
| `attestation/src/index.ts` | `concatBytes` importado y nunca usado |
| `issuer/test/unit/notify.spec.ts` | `String(init.body)` sobre un `BodyInit`: si algún día el cuerpo deja de ser una cadena, la prueba compara contra `[object Object]` y pasa |
| `sources/test/unit/croma-contract.spec.ts` | Un `JSON.parse` devuelto como `any` a través de la frontera del fixture |
| `.../redaction.invariant.spec.ts`, `issue-redaction.spec.ts` | Los métodos de `console` se guardaban desligados de `console` para restaurarlos |

### D-45 — El contrato dejó de ser código que nadie había compilado · 2026-09-23

*El bloqueo, y lo que resultó ser:* el contrato llevaba desde el día 1 escrito y sin compilar,
anotado como *bloqueado por el entorno*: WSL sin compilador de C. Nunca fue una decisión técnica,
era una máquina. En un contenedor Linux con `cargo` y `gcc` el bloqueo no existe.

*Lo primero que apareció al compilar:* `soroban-env-host` pide `ed25519-dalek >= 2.0.0`, **sin
techo**. Cargo resuelve 3.0.0, que cambió `CryptoRng`, y el host no compila contra ella. No es un
error del contrato y no se arregla leyéndolo: se arregla fijando la resolución. `Cargo.lock`
queda versionado —lo contrario de lo que se hizo el 2026-09-22, cuando se borró el que había
dejado un build fallido—. Un contrato es un artefacto reproducible, no una librería.

*Decisión:* `cargo test` y `cargo build --release --target wasm32-unknown-unknown` entran en CI,
como un job propio. El `wasm` se construye en cada PR; nadie lo despliega.

*Nueve pruebas, todas sobre la política, que es donde caen los ataques.* Ninguna necesita una
prueba válida, y eso es exactamente lo que afirman: el contrato rechaza **antes** del
emparejamiento.

| Qué se prueba | Por qué importa |
|---|---|
| Raíz que nadie registró → `UnknownIssuerRoot` | Una prueba válida sobre una raíz que el propio atacante publicó verifica perfectamente |
| Nulificador ya gastado → `NullifierAlreadySpent`, y nada queda anclado | Sin conjunto gastado, una prueba arrienda cincuenta apartamentos |
| `solvency_tier` por debajo del pedido, y cada booleano por separado | Un predicado que se comprueba en bloque esconde cuál faltaba |
| El vector plano que no concuerda con las señales nombradas → `InvalidProof` | Es el bug que la estructura nombrada existe para evitar, reintroducido por la fontanería |
| Una raíz registrada guarda el ledger en que llegó | La revocación es republicar sin la hoja, no borrar historia |

*Lo que sigue sin ser cierto:* el contrato nunca ha verificado una prueba Groth16 de verdad,
porque los circuitos siguen sin compilar. El orden de las señales en `signals_match` está fijado
por `test.rs`, pero solo el circuito puede decir que sea el correcto.

### D-46 — El emisor no tenía pruebas fuzz, y la primera encontró una cotización que no era un número · 2026-09-23

*El hueco:* la constitución pide cobertura **fuzz** para todo módulo que reciba algo de fuera del
proceso. `issuer/` no tenía ninguna, y es el workspace con la superficie externa más grande: escucha
en un socket, y `/quote` responde **sin llave de acceso**. Lo que llega ahí son bytes arbitrarios.

*Lo que encontró, y no es pequeño:* las tablas de predicados eran objetos literales indexados por una
cadena que manda quien llama.

```
POST /quote  {"predicates": ["constructor"], "request": {…}}
→ 200 {"status":"quoted", "totalMinor":"0function Object() { [native code] }", …}
```

`PRICE_MINOR["constructor"]` no es `undefined` —es la función `Object`—, así que la guarda *«un
predicado sin precio publicado no se cotiza a uno inventado»* lo dejó pasar. El total, declarado
`number`, salió como una cadena con el código fuente del runtime dentro, y el `paymentRef` que lo
acompaña es real. El mismo agujero en `predicatesOf` metía una función en la lista de predicados que
firma la referencia de pago, y en `WHAT_IT_DOES_NOT_SAY`, que es texto que ve el usuario.

*Decisión:* las tres tablas pasan de objeto literal a `Map`. No es estilo: un `Map` no tiene
prototipo que responda por una llave que nadie escribió. El compilador no podía ver esto —los tipos
decían `Record<string, number>` y eran ciertos—, y las pruebas de ejemplo tampoco, porque nadie
escribe `"constructor"` a mano. Solo una entrada arbitraria lo encuentra.

*Lo que queda fijado:* dos ficheros fuzz en `issuer/test/fuzz/`. El del servicio lanza 120 cuerpos
generados —JSON roto, anidamiento profundo, llaves del prototipo, cadenas de 2 KB— contra `/quote` y
`/issue` con un proveedor que lanza si alguien lo alcanza: la propiedad es que ninguno llega a una
fuente y todos reciben un estado que este servicio eligió. El de precios afirma que un total cotizado
es un número y la suma de sus líneas.
### D-47 — Un byte corrupto en el caché no arrancaba el emisor, que es lo contrario de lo que D-39 prometía · 2026-09-23

*El hueco:* `cache-store.ts` ya se defendía de una línea **que no parsea** —la que deja un proceso
que muere a mitad de un append— y la saltaba. No se defendía de una que **sí parsea y no es una
entrada**. `JSON.parse(trimmed) as StoredCacheEntry<T>` es un `as`: el compilador acepta la promesa
y el disco no la cumple.

```
$ echo 'null' >> cache.jsonl && npm start
TypeError: Cannot read properties of null (reading 'key')
```

D-39 dice que perder el caché cuesta **una llamada repetida a Croma, no una emisión de más**. Una
línea corrupta que impide arrancar el proceso es exactamente lo contrario: convierte la pieza cuya
pérdida solo cuesta dinero en la que tumba el servicio.

*Decisión:* el adaptador valida y **reduce** —criterio A8, que ya se aplicaba a las respuestas de
Croma y no al disco—. `asEntry` comprueba `key` no vacía, `expiresAt` entero seguro y la presencia
de `value`, y construye una entrada nueva con esos tres campos. Lo que sobra en la línea no pasa: una
entrada con `__proto__` llega reducida a tres llaves.

*Fijado en `issuer/test/fuzz/cache-store.fuzz.spec.ts`:* dieciséis formas de estar mal que parsean
(`null`, `0`, `[]`, `expiresAt` como cadena, como `1.5`, como `1e999`), ocho que no parsean, y 300
ficheros mezclados al azar. La propiedad que importa: con el fichero roto como esté, la entrada viva
que hay dentro sobrevive y el emisor arranca. Sin el arreglo, las cinco pruebas fallan.

### D-48 — La comprobación de un pago lanzaba donde el protocolo ya tenía una palabra · 2026-09-23

*El hueco:* `verifyPayment` envuelve en `try` **las llamadas** a Horizon, y nada más. Lo que Horizon
responde se lee después, fuera de la red y fuera del `try`:

| Lo que llega | Lo que pasaba |
|---|---|
| `amount: "abc"` | `SyntaxError: Cannot convert abc to a BigInt`, fuera de la función |
| `amount: "1.5e3"` | lo mismo, por la ruta de la parte decimal |
| `records: {a:1}` | `TypeError: payments.filter is not a function` |

El pagador que mandó dinero recibía una excepción donde el protocolo ya tiene una respuesta:
`underpaid`, `wrong_destination`, `unreachable`. Un `502` de un proxy delante de Horizon basta para
provocarlo; no hace falta un atacante.

*Decisión:* el adaptador lee lo que Horizon **escribe de verdad** y descarta el resto. Un monto es
`^\d+(\.\d{1,7})?$` —decimal no negativo, siete posiciones—, y el que no lo sea no se cuenta. Una
página de registros que no es una lista no es una página de registros. Falla cerrado: el total se
queda corto y el pagador recibe `underpaid`, que es cierto y accionable.

*Por qué el tipo no lo vio:* `HorizonPayment.amount` está declarado `string` y llega de un `as` sobre
`response.json()`. El compilador creyó la promesa; la red no la cumple. Es el mismo `as` de D-47, en
el otro extremo del servicio — el disco allá, la red aquí.

*Fijado en `issuer/test/fuzz/payments.fuzz.spec.ts`:* veintitrés montos que no son montos, cinco
formas de que `records` no sea una lista, y 300 respuestas generadas. La propiedad: toda respuesta
termina en `paid` o en una razón de la lista cerrada, nunca en una excepción. Y las dos pruebas que
cuidan el otro lado: 2.5000000 sigue leyéndose al stroop, y varios pagos legibles siguen sumando.
### D-49 — El anclaje fallaba hablando de JavaScript en vez de hablar de Horizon · 2026-09-23

*El hueco:* `stellar-horizon.ts` leía `account.sequence` y lo pasaba a `BigInt` con una sola
comprobación —que fuera una cadena—. `"abc"`, `"1.5"`, `"-1"` y `"1e9"` son cadenas.

| Lo que Horizon devuelve | El error que salía |
|---|---|
| `{"sequence":"abc"}` | `SyntaxError: Cannot convert abc to a BigInt` |
| `<html>502 Bad Gateway</html>` en el envío | `SyntaxError: Unexpected token '<'` |

Y el segundo es peor que el primero: el `json()` del envío se leía **antes** de mirar el estado, así
que un proxy delante de Horizon convertía un `502` legible en un error de parseo. Quien lee el log va
a buscar el bug al sitio equivocado.

*Decisión:* una secuencia es `^\d+$` y nada más; un cuerpo que no es JSON es un cuerpo vacío, no una
excepción. Los dos errores que salen ahora empiezan por `horizon `, que es de lo que hablan.

*Por qué importa aquí y no es teoría:* el anclaje es el paso del que el producto sobrevive sin —A11
pide que el recorrido funcione con la cadena caída—. Un fallo suyo tiene que ser legible, porque
alguien va a decidir si fue la red o fue el código.

*Fijado en `anchoring/test/fuzz/stellar-horizon.fuzz.spec.ts`:* catorce secuencias que no son
secuencias, siete cuerpos que no son JSON, y 200 combinaciones. Sin el arreglo fallan cuatro de las
cinco pruebas. La quinta cuida el otro lado: la respuesta que Horizon manda de verdad sigue anclando.

### D-50 — El fuzz de los adaptadores no encontró nada, y eso también es un resultado · 2026-09-23

*Por qué se escribió:* la constitución pide fuzz para todo lo que parsea algo de fuera del proceso, y
los cuatro adaptadores del perfil de compraventa son literalmente eso: el único sitio del
repositorio donde la respuesta de un proveedor tiene permiso de existir. Tenían pruebas unitarias
contra las formas del OpenAPI de Croma; no tenían ninguna contra las formas que Croma nunca manda.

*Qué se fija, que es más que «no lanza»:*

| Propiedad | Por qué esa y no otra |
|---|---|
| El resultado es una reclamación o una degradación de la lista cerrada | Es lo que el puerto declara, y nada más puede salir por ahí |
| Nada de la carga del proveedor aparece en el resultado | Cada carga generada lleva un marcador plantado; si sobrevive, se ve |
| `attestedAt` es la hora que eligió este proceso | Un sello que escribe el proveedor es un sello que el proveedor controla |
| Una carga ilegible **nunca** se vuelve un `false` | `degraded` y «no cumple» son respuestas distintas, y el producto entero depende de no confundirlas |
| Al menos una carga generada produce una reclamación | Sin esto la prueba pasaría degradando siempre, que no demuestra nada |

*El resultado, dicho tal cual:* **cero hallazgos**. 400 cargas generadas por adaptador, más las nueve
formas que no son un objeto, y los cuatro se comportan. Los adaptadores ya validaban y reducían de
verdad —comprueban el tipo de cada campo que leen y devuelven `invalid_response` cuando falta—, a
diferencia de lo que pasaba en el emisor (D-46, D-48) y en el anclaje (D-49), donde el `as` sobre un
`json()` hacía el trabajo de una validación que no existía.

*Lo que eso significa para leer las otras entradas:* la diferencia no era la disciplina de quien las
escribió, era **dónde estaba el límite**. Aquí el límite estaba dibujado —un adaptador por pregunta,
con su función `parse`— y la validación cayó dentro. En el emisor el límite era una línea en medio de
un manejador HTTP, y nadie la vio como un límite.

### D-51 — El contrato leía la lista de sanciones del índice equivocado, y solo el compilador podía decirlo · 2026-09-23

*Lo que estaba bloqueado, y por qué no lo estaba:* los circuitos llevaban desde el día 1 sin
compilar, con el bloqueo anotado como falta de toolchain. `circom` se construye desde fuente con el
mismo `cargo` que ya compilaba el contrato. Cincuenta y cuatro segundos.

*Lo que apareció al primer intento, que es la razón de todo esto:*

```
$ circom eligibility.circom --sym
$ head -13 build/eligibility.sym | cut -d, -f4
main.personhood  main.solvencyTier  main.formality  main.standing  main.nullifier
main.issuerRoot  main.sessionId  main.expectedSubjectRef  main.rentMinor
main.nowMonth  main.maxStaleMonths  main.minMonthsPaid  main.listSetRoot
```

`listSetRoot` está en el índice **12**. El contrato lo leía del **11**, que es `minMonthsPaid`. La
comprobación `claimListSetRoot === listSetRoot` —«limpio contra una lista que nadie publicó no es una
respuesta»— comparaba la instantánea de listas contra un umbral de meses cotizados. El propio
`lib.rs` avisaba de esto: *«no falla ruidosamente — autoriza la afirmación equivocada»*. Llevaba ahí
desde que se escribió, y ninguna prueba podía verlo porque todas las pruebas usaban el mismo orden
inventado que el contrato.

*Decisión:* el orden deja de ser una lectura. `circuits/eligibility.signals.txt` lo escribe la tabla
de símbolos del compilador, el contrato declara una constante por señal y `test.rs` afirma cada
constante contra ese fichero. CI recompila el circuito y rechaza un fichero que se haya desviado.
Poner el índice viejo de vuelta ahora rompe dos pruebas; comprobado.

*El otro hallazgo, que es una trampa y no una buena noticia:* el circuito compila **igual de bien**
con `-p bls12381` que con `bn128` —mismas 10 932 restricciones no lineales, mismo orden de señales—.
Eso no significa que sea correcto sobre BLS12-381: las constantes de ronda de Poseidon en circomlib
son elementos derivados para el campo de BN254, y compiladas contra otro campo siguen siendo *unas*
constantes, así que el compilador no tiene nada que objetar. El resultado es una permutación que
nadie analizó. El bloqueo real de los circuitos nunca fue el toolchain: es este, y es silencioso.

*Lo que sigue sin ser cierto:* ninguna prueba Groth16 se ha generado ni verificado. Falta Poseidon
parametrizado para BLS12-381, y falta que `core/` hashee con él —hoy el puerto `FieldHash` está
implementado con SHA-256, que es exactamente el cambio que el puerto existe para permitir—.

### D-52 — Las constantes de Poseidon se generan aquí y se comprueban contra circomlib; la matriz no · 2026-09-24

*El problema, recordado en una línea:* compilar con `-p bls12381` no protesta, y las constantes de
ronda de circomlib son del campo de BN254. Generar las del campo correcto es el trabajo.

*Lo que se hizo, y por qué se puede creer:* `circuits/tools/poseidon-params.ts` es un port del
`generate_parameters_grain.sage` de referencia —el script que la propia cabecera de circomlib nombra
como origen de sus constantes—. No se cree porque parezca correcto: la prueba regenera con él las
constantes BN254 **publicadas** para anchos 2 y 3 y las compara. Coinciden.

*La parte del LFSR que no se puede adivinar:* un bit se emite solo cuando el anterior fue un `1`, y
el par se consume igual. Leer todos los bits da una secuencia igual de aleatoria a la vista y
distinta; la primera constante de circomlib es lo que distingue una regla de la otra, y es por lo que
la prueba vale.

*Dónde se paró, dicho exacto:* la matriz MDS **no** se reproduce. Una Cauchy sobre los mismos `x`/`y`
generados coincide con la matriz publicada de circomlib en su primera fila y en otra más, y discrepa
en el resto —una coincidencia parcial que no es casualidad y que todavía no se explica—. Sin esa
matriz no hay permutación que escribir, ni dentro ni fuera del circuito. Tres intentos sobre la
convención de filas y columnas, y la regla del proyecto dice parar y nombrar el supuesto dudoso.

*Lo que queda como base para el siguiente intento:* el valor de verdad lo produce el propio gadget,
no una tabla de internet — `circom --wasm` y un testigo para las entradas `1, 2` sobre BN254 dan
`Poseidon(1,2) = 0x115cc0f5…4417189a`. Una implementación que no reproduzca ese número está mal,
reproduzca lo que reproduzca.

### D-53 — La matriz de Poseidon: el guion de referencia no rechaza, reduce · 2026-09-24

*Corrige a D-52, que dejó la matriz MDS como pendiente y nombró el supuesto dudoso.* El supuesto era
el correcto y la respuesta estaba en el guion, no en las constantes publicadas: el
`generate_parameters_grain.sage` original está en `extgit.iaik.tugraz.at`, que el proxy de esta
sesión rechaza, pero hay copias públicas del repositorio en GitHub. Leerlo cerró en minutos lo que
tres intentos de deducción no cerraron.

*Las dos cosas que decía, y que no se pueden deducir mirando la salida:*

| | Constantes de ronda | Matriz MDS |
|---|---|---|
| Un valor ≥ p | **se descarta** y se toma el siguiente | **se reduce** mod p |

Rechazar en la matriz consume bits distintos y corre toda la secuencia a partir de ahí. Por eso la
primera entrada coincidía —salió menor que p por casualidad— y el resto no: la coincidencia parcial
que D-52 no supo explicar era exactamente esa.

*Y la tercera:* circomlib publica la **transpuesta** de la matriz del guion, porque su plantilla
`Mix` indexa `M[j][i]`. Con eso, `parameters()` reproduce `POSEIDON_M(3)` entrada por entrada.

*Lo que cierra el círculo:* `circuits/tools/poseidon.ts` implementa la permutación fuera del
circuito, y la prueba la compara contra el número que produce el propio gadget de circomlib —
`Poseidon(1,2) = 0x115cc0f5…4417189a`, sacado de un testigo, no de una tabla—. Coincide. El orden es
sumar constantes, s-box, mezclar, cada ronda; la variante de sumar una vez al principio no coincide.

*Lo que sigue sin ser cierto, y ahora es lo único:* la misma construcción responde sobre BLS12-381 y
**nadie ha comprobado nada sobre esa salida**: no hay segunda implementación contra la cual
compararla ni revisión de seguridad. Y `core/` sigue con SHA-256 — cambiarlo mueve todos los
compromisos, así que es un cambio propio.

### D-54 — Los dos lados no hashean igual, y el código afirmaba que sí · 2026-09-24

*Cómo apareció:* con Poseidon ya comprobado (D-53) se puede preguntarle al circuito qué hace, en vez
de leerlo. `MerkleLevel(7, 9, izquierda)` compilado y ejecutado da
`0x2f447495…4a27376a`, que es exactamente `poseidon(7n, 9n)`. Sin prefijo de dominio por ningún lado.

| | Cómo hashea un nodo |
|---|---|
| `circuits/merkle.circom` | `Poseidon(left, right)` — sin dominio |
| `core/src/merkle.ts` | `hash("knowni:merkle:node:v1", [left, right])` — con dominio |

Y los compromisos tampoco: el circuito hace `Poseidon(6)(subjectRef, documentValid, subjectAlive,
ofAge, listSetRoot, salt)`; `commitClaim` hace `hash(CLAIM_DOMAIN, [...encodeClaim(claim), salt])`
con codificación `u64be`. No son dos vistas de la misma construcción.

*Lo que se corrige hoy:* la cabecera de `merkle.ts` decía *«The same fold the circuit performs, so
both sides agree on what a root means»*. No es cierto y ya no lo dice. Cambiar `FieldHash` a Poseidon
**no** los reconcilia: el dominio de `core/` no tiene contraparte en el circuito.

*Las dos salidas, y lo que cuesta cada una:*

| | Qué implica |
|---|---|
| **El circuito adopta los dominios** | `MerkleLevel` pasa a `Poseidon(3)` con una constante. Mantiene la separación hoja/nodo y deja a `core/` como referencia, que es lo que `circuits/README.md` ya declara |
| **`core/` adopta el circuito** | Cero coste en restricciones y se pierde la separación hoja/nodo: una hoja que parezca un nodo deja de estar descartada por construcción |

*Medido, no estimado:* `Poseidon(2)` son 243 restricciones no lineales; `Poseidon(3)` con una
constante de dominio, 264. **+21 por hash.** Con dos caminos Merkle de profundidad 20 son +840 sobre
las 10 932 actuales — **un 7,7%**.

*Recomendación registrada:* la primera. Un 8% de circuito es más barato que publicar una regresión de
seguridad, y es la única salida que deja verdadera la frase que este commit tuvo que borrar. La
decisión es de producto y toca el circuito, el hashing de `core/` y todos los compromisos, así que
no se ejecuta desde aquí.
### D-55 — El circuito adopta los dominios, y le faltaba además un nivel entero · 2026-09-24

*Decisión (la recomendada en D-54, confirmada):* el circuito se acerca a `core/`, no al revés.
`core/` es la implementación de referencia —lo dice `circuits/README.md`— y quitar la separación
hoja/nodo para que dos implementaciones coincidan es debilitar una defensa por conveniencia.

*Lo que se hizo:* `MerkleLeaf` y `MerkleLevel` reciben un elemento de dominio como primera entrada, y
`MerklePath` toma el **compromiso** y lo hashea él mismo, para que nadie se olvide.

*Lo que apareció al implementarlo, que D-54 no había visto:* el circuito no solo no separaba
dominios — **se saltaba el hash de la hoja entero**. `core/` hace `hashLeaf(h, commitClaim(...))` y
el circuito metía `idCommit.out` directo en el camino. Eran dos divergencias, no una.

*El coste, medido antes y después:*

| | Restricciones no lineales |
|---|---|
| Antes | 10 932 |
| Después | 12 258 |

**+12,1%.** De esos, +840 son el dominio del nodo en 40 niveles y +486 los dos hashes de hoja que
faltaban. La estimación de D-54 decía +7,7% y se quedó corta por exactamente esa razón: contaba los
dominios y no el nivel ausente. El orden de las señales públicas no cambia, y la prueba que lo fija
lo confirma.

*Las constantes no se escriben a mano:* `tools/domains.ts` deriva un elemento de campo por cadena de
dominio y `domains.circom` es su salida. CI la regenera y rechaza un fichero que se haya desviado —
el mismo trato que el orden de señales.

*Lo que sigue faltando para que las raíces coincidan:* `core/` hashea con SHA-256. Ahora los dos
lados son la **misma construcción** y solo queda el hash.

### D-56 — Un reclamo como lista de elementos de campo, y lo que el circuito tendrá que adoptar · 2026-09-24

*Qué decide esta entrada:* la forma que tendrán todos los compromisos cuando el hash sea el del
circuito. `encodeClaim` serializa a bytes con `u64be` y UTF-8; un circuito no hashea bytes, suma y
multiplica elementos de un primo. `core/src/claim-fields.ts` es la traducción, y `core/src/field.ts`
es el único sitio que decide cómo se lee cada tipo de valor.

| Qué | Cómo entra | Por qué |
|---|---|---|
| El tipo de reclamo | Un número de una tabla cerrada, primero en la lista | Dos tipos no pueden encodear igual, y se ve antes de conocer el esquema |
| Jurisdicción, moneda, base, tipo de documento | `sha256(cadena) mod p` | Son cadenas abiertas; no hay forma inyectiva de meterlas, y es la misma derivación que usan las constantes de dominio del circuito |
| Enteros —fecha, montos, conteos— | Tal cual, exigiendo entero seguro no negativo | Caben de sobra y no necesitan nada más |
| Booleanos | 0 o 1 | |
| Referencias de 32 bytes —sujeto, raíz de listas, sal— | Se exige que sean **menores que p**, y si no, error | Es lo importante de todo esto |

*La trampa, que es la razón del último renglón:* un valor de 256 bits reducido a un campo de 254 no
es inyectivo. Reducir en silencio mezcla dos sujetos que nunca fueron el mismo, y ninguna cantidad de
hashing posterior lo repara. `fieldFromHex` lanza `NotInFieldError` en vez de reducir. Después del
cambio de hash esos valores **serán** salidas de Poseidon y estarán en el campo por construcción;
hasta entonces, la comprobación es la que avisa de que aún no lo están.

*El ancho es declarado, no contado:* una tabla dice cuántos elementos produce cada tipo, y el
codificador falla si no cuadra. Un esquema que gana un campo y no toca la tabla cambiaría todos los
compromisos de ese tipo sin que nada lo dijera. Rellenar una lista de largo variable hasta un ancho
fijo es justamente como dos reclamos distintos acaban con un compromiso.

*Lo que el circuito tendrá que adoptar, y hoy no hace:* `idCommit` es
`Poseidon(6)(subjectRef, documentValid, subjectAlive, ofAge, listSetRoot, salt)`. Comparado con esta
codificación le faltan el tipo, la jurisdicción, el tipo de documento y **`attestedAt`** —un
compromiso que no ata la fecha no permite exigir frescura— y en cambio mete `listSetRoot`, que
pertenece al reclamo de listas y no al de identidad.

*Lo que no cambia todavía:* nada. `commitClaim` sigue con la codificación de bytes y SHA-256. Esto es
el contrato con el que se hará el cambio, con su invariante de inyectividad sobre 4000 reclamos
generados.

### D-57 — Una sola lista de dominios, y una sal que cabe en el campo · 2026-09-24

*Dos preparativos para el cambio de hash. Ninguno mueve todavía un compromiso.*

**Los dominios dejan de estar en dos sitios.** `core/src/domains.ts` es ahora la definición —los
siete: reclamo, resultado, hoja, nodo, vacío, sesión, nulificador— y `merkle.ts`, `commitment.ts` y
`session.ts` los leen de ahí en vez de declarar los suyos. El circuito importa **esa misma lista**
por `@knowni/core` en lugar de la copia que tenía. Una lista copiada es una lista que se desvía, y un
dominio desviado es una raíz que dos implementaciones calculan distinto pareciendo ambas correctas
—que es exactamente D-54—. Los valores de hoja y nodo no cambian; los otros cinco aparecen en
`domains.circom` para cuando el circuito los use.

**La sal tenía que caber en el campo.** `randomSalt()` da 32 bytes crudos, que son 256 bits, y el
campo tiene 254: con la codificación de D-56 eso lanza `NotInFieldError` en cuanto la sal entre como
elemento. `randomFieldSalt(prime)` la dibuja dentro del campo.

*Y la parte que no es obvia, que es cómo se dibuja:*

| Cómo | Qué pasa |
|---|---|
| 32 bytes y reducir mod p | **Sesgado.** Los valores por debajo de 2^256 mod p salen el doble de veces |
| 32 bytes y rechazar | Correcto y caro: para BN254 se tiran **cuatro de cada cinco** |
| Enmascarar al ancho del primo y rechazar | Correcto, y se tira **una de cada cuatro** |

*Lo que costó una suposición equivocada:* la primera prueba que escribí afirmaba que enmascarar hace
que el primer intento siempre valga. Es falso —el primo de BN254 está a tres cuartos de 2^254, así
que un enmascarado todavía se rechaza una vez de cada cuatro— y la prueba se colgó en un bucle
infinito en vez de fallar. La que quedó afirma lo que sí es cierto: que un valor por encima del primo
se rechaza y se toma el siguiente.

### D-58 — Poseidon baja a `core/`, y hashear en elementos es su propio puerto · 2026-09-24

*Dónde vive:* Poseidon estaba en `circuits/tools/`, pero quien va a hashear con él es `core/`, y la
dirección de las dependencias es `circuits → core`, nunca al revés. Baja a `core/src/` —es aritmética
pura, sin dependencias, que es justo lo que `core/` admite— y `circuits/tools/` queda como
reexportación. La derivación de un dominio también: había dos implementaciones de «lo mismo», que es
como «lo mismo» deja de serlo.

*Por qué un puerto nuevo y no el que había:* `FieldHash` toma bytes y una cadena de dominio, que es
lo que SHA-256 quiere. El hash de un circuito toma elementos de campo. Meter uno dentro del otro es
exactamente como un dominio deja de significar algo, así que `FieldHasher` es su propio puerto:
`hashFields(dominio, elementos)`, con el dominio como primer elemento — la misma disposición que usa
`circuits/merkle.circom`.

*La prueba que importa:* `hashFields("merkleLeaf", [7n])` y `hashFields("merkleNode", [7n, 9n])`
devuelven los números que salieron de los testigos del gadget compilado. **Una raíz calculada aquí es
una raíz que el circuito puede probar.** Es la primera vez en el repositorio que los dos lados
producen el mismo número.

*Una corrección de rendimiento que no es cosmética:* `poseidon()` derivaba las constantes de ronda
**en cada llamada** —un LFSR de Grain sobre cientos de elementos—. Con pruebas pequeñas pasó
inadvertido; un árbol de Merkle pide miles de hashes y lo habría convertido en minutos. Las
constantes se derivan una vez por ancho y se guardan: 2000 hashes en poco más de un segundo.

*Lo que todavía no cambia:* `commitClaim`, `merkle.ts` y `session.ts` siguen con `FieldHash` y
SHA-256. El puerto existe y está comprobado contra el circuito; conectarlo mueve todos los
compromisos y va en su propio cambio.

### D-59 — El compromiso de un reclamo se hace con el hash del circuito, y lo que eso arrastró · 2026-09-24

*El cambio:* `commitClaim`, `hashLeaf` y el plegado de Merkle pasan de `FieldHash` (bytes, SHA-256) a
`FieldHasher` (elementos, Poseidon). **Todos los compromisos del repositorio cambian de valor.** El
compromiso de un resultado y la sesión siguen en bytes: no los pide el circuito todavía.

*Lo que el cambio destapó, que es más interesante que el cambio:* una vez que un valor tiene que ser
un elemento del campo, **tiene que nacer siéndolo**. Tres sitios en producción lo producían con
SHA-256 y quedaban fuera del campo de 254 bits:

| Dónde | Qué producía |
|---|---|
| `issuer/src/service.ts` | El `subjectRef` del sujeto, que acaba dentro de cada reclamo |
| `sources/.../sanctions.ts` | La raíz del conjunto de listas, que va en el reclamo de standing |
| `retrieval/.../memory.ts` | La raíz del snapshot, que alimenta a la anterior |

Ninguno se veía: `commitClaim` con SHA-256 aceptaba cualquier cosa de 32 bytes. El primero que falló
fue un fixture, y detrás venían los tres. La comprobación de D-56 —rechazar en vez de reducir— es lo
único que los hizo visibles, y es exactamente el trabajo que se le pedía.

*Una sola forma de hacer una sal:* `randomSalt()` daba 32 bytes crudos, que el compromiso ahora
rechaza. Deja de existir; la única que queda es la que dibuja dentro del campo, y toma el primo como
argumento.

*Código muerto que el lint encontró solo:* `encodeClaim` —la serialización de un reclamo a bytes con
`u64be` y UTF-8— ya no la usa nadie. Borrada. Su reemplazo es `encodeClaimFields`, y tener las dos
habría sido tener dos definiciones de qué es un reclamo.

*Lo que todavía no se toca:* el circuito. `idCommit` sigue siendo `Poseidon(6)` con las señales
viejas, así que un compromiso de `core/` y uno del circuito **aún no coinciden**. Lo que sí coincide
ya, y está comprobado contra los testigos del gadget, es el plegado de Merkle: hoja y nodo dan el
mismo número en los dos lados. Alinear `idCommit`/`incCommit` es el cambio que falta.

### D-60 — El circuito y `core/` calculan el mismo compromiso · 2026-09-24

*El final del hilo que empezó en D-54.* `claims.circom` calcula el compromiso de un reclamo elemento
por elemento en el orden de `core/src/claim-fields.ts`: dominio, etiqueta de tipo, la cabeza común,
los campos del tipo, la sal. `commitClaim` es esa misma llamada.

```
core  commitClaim(identity)      = 0x19426120…3c8f7f1a
circuito IdentityCommitment      = 0x19426120…3c8f7f1a

core  commitClaim(income)        = 0x21800de5…87207526
circuito IncomeCommitment        = 0x21800de5…87207526
```

Los dos del circuito salen de testigos del gadget compilado. **Una credencial emitida por este
repositorio es una credencial que el circuito puede abrir**, que es para lo que era todo esto.

*Lo que el viejo `idCommit` no ataba, y ahora sí:* era `Poseidon(6)` sobre subjectRef, tres
booleanos, `listSetRoot` y la sal. Le faltaban el tipo de reclamo, la jurisdicción, el tipo de
documento y **`attestedAt`**. Un compromiso que no ata la fecha es un compromiso bajo el cual la
fecha se puede cambiar después, y la prueba se sigue abriendo — o sea, no había forma de exigir
frescura. Y metía `listSetRoot`, que pertenece al reclamo de listas y no al de identidad.

*Las etiquetas de tipo se generan, no se escriben:* salen de `KIND_TAG` de `core/` por el mismo
generador que ya emitía los dominios, y CI rechaza un fichero desviado. Es la tercera vez que esa
disciplina evita el bug de D-51, y las tres veces ha sido el mismo bug con otra ropa.

*Coste:* 12 258 → 12 567 restricciones no lineales, **+2,5%**. El orden de las señales públicas no
cambia.

*Lo que sigue sin ser cierto:* nadie ha generado una prueba Groth16. Falta el setup, y falta
Poseidon parametrizado para BLS12-381 —hoy todo esto es BN254, que Stellar no verifica—. Lo que
existe es el acuerdo entre los dos lados sobre qué se compromete y cómo, que era el bloqueo real.

### D-61 — Poseidon sobre la curva que Stellar verifica, y lo que cuesta dejar circomlib · 2026-09-24

*El último bloqueo de D-51, cerrado.* circomlib deriva sus constantes para BN254 y su plantilla es la
forma optimizada construida alrededor de ellas; compilarla con `-p bls12381` las reinterpreta sin
protestar. Este repositorio ya sabía generar constantes para cualquier campo (D-53) pero no tenía
plantilla propia, así que seguía dependiendo de la de circomlib.

*Lo que se hizo:* `tools/write-poseidon.ts` emite la plantilla **y** las constantes, en la forma
llana del paper —sumar constantes, elevar a la quinta, mezclar— para las cuatro aridades que los
circuitos instancian. Dos ficheros, uno por curva, intercambiables: mismos nombres de plantilla,
así que cambiar de curva es un directorio en `-l`.

*La cadena de verificación, que es lo único que hace creíble lo demás:*

| Afirmación | Cómo se comprueba |
|---|---|
| El generador de constantes es el de referencia | Reproduce las BN254 publicadas por circomlib (D-53) |
| La plantilla nueva es Poseidon | Sobre BN254 da `0x115cc0f5…4417189a`, el valor del gadget de circomlib, con las mismas 243 restricciones no lineales |
| Los dos lados coinciden sobre BLS12-381 | `poseidon([1,2])` de `core/` y un testigo del circuito compilado con `-p bls12381` dan ambos `0x28ce1942…7dd2a78a` |
| Los compromisos no se movieron | El vector de D-60 sale idéntico con la plantilla nueva |

*Lo que cuesta, medido:* las restricciones **no lineales no cambian** —12 567 en las dos formas—,
pero las lineales suben de 16 408 a 24 937. En total 28 975 → 37 504, **+29%**. Es lo que la
optimización de circomlib compraba, y recuperarla exige reproducir sus matrices dispersas `S` y `P`,
que es trabajo que aquí nunca se hizo (D-52 lo dejó nombrado). El cambio se toma igual: un 29% es
caro, y un circuito sobre una curva que la cadena no verifica no sirve de nada.

*Lo que sigue sin ser cierto:* no hay setup de confianza ni prueba Groth16 generada. Lo que hay es
que el circuito compila sobre BLS12-381 con constantes derivadas para ese campo, y que `core/` calcula
lo mismo que él.

### D-62 — Parte del 29% no era la optimización de circomlib, era contabilidad · 2026-09-24

*Corrige la lectura de D-61.* Allí el +29% de restricciones quedó atribuido entero a haber dejado la
forma optimizada de circomlib, con sus matrices dispersas `S` y `P`. Releer la plantilla generada
muestra que una parte no tenía nada que ver con eso: era la propia plantilla llana gastando señales
en cosas que no necesitan una.

*Lo que gastaba de más, por ronda y con ancho de estado `t`:*

1. `added[r][i] <== state[r][i] + C[...]` — una señal y una restricción lineal por celda, solo para
   sumar la constante de ronda. Sumar una constante es gratis dentro de la expresión que eleva la
   celda, así que la clave de ronda ya no tiene señal propia.
2. En una ronda parcial, las `t - 1` celdas que **no** pasan por la S-box igual recibían
   `squared <== 0`, `quartic <== 0` y `sboxed <== added`: tres restricciones lineales por celda para
   copiar un valor. Ahora esas celdas entran a la mezcla como la expresión lineal que ya son.

Las señales no lineales no se tocan: las mismas multiplicaciones, en las mismas rondas, sobre los
mismos valores. La permutación es la misma y por eso ningún compromiso se mueve — la comprobación de
que eso es cierto dejó de ser una nota y pasó a ser un paso de CI.

*Lo que no se hizo:* las matrices dispersas `S` y `P` siguen sin reproducirse. El resto del sobrecoste
frente a circomlib es suyo y D-52 lo sigue nombrando.

*Cómo se comprueba, y por qué el paso nuevo importa:* compilar no dice nada sobre la permutación —
unas constantes de otro campo siguen siendo *unas* constantes. CI ahora construye un testigo de
`PoseidonKnowni2` en las dos curvas y compara la salida con `poseidon([1,2])` de `core/`. Antes ese
acuerdo vivía en dos valores copiados a mano en una prueba; ahora lo recalcula la máquina en cada PR.
El acuerdo entre las dos implementaciones dejó de vivir en dos valores copiados a mano en una prueba:
ahora lo recalcula la máquina en cada PR.

*Lo que cuesta, medido por CI en el job `circuits` (commit `e980c8b`, idéntico en las dos curvas):*

| | Antes (D-61) | Ahora | |
|---|---|---|---|
| No lineales | 12 567 | 12 385 | −182 |
| Lineales | 24 937 | 12 664 | −12 273 |
| Total | 37 504 | **25 049** | **−33%** |

Queda por debajo de las 28 975 que costaba la forma optimizada de circomlib, así que el +29% de
D-61 deja de ser una deuda y pasa a ser un margen — todavía con las matrices dispersas sin
reproducir.

*Por qué bajaron también 182 no lineales, que no era obvio:* la ronda 0 de cada instancia tiene
celdas cuyo valor es **constante** — la celda extra vale cero por construcción, y `inputs[0]` es
siempre un dominio (`DOMAIN_CLAIM`, `DOMAIN_MERKLE_NODE`, …). Elevar una constante a la quinta es
una constante, así que esas multiplicaciones no tienen por qué ser restricciones. La plantilla vieja
lo impedía: al pasar por la señal intermedia `added`, el simplificador de circom no propagaba la
constante dentro de las cuadráticas. Escribir la suma dentro de la propia expresión que multiplica
se lo devuelve.

Medido con sondas compiladas a propósito (rama desechable, circom 2.2.3):

| Sonda | Celdas constantes en la ronda 0 | Vieja | Nueva | Δ |
|---|---|---|---|---|
| `PoseidonKnowni2`, dos entradas variables | 1 | 243 | 241 | −2 |
| `PoseidonKnowni2`, `inputs[0]` constante | 2 | 243 | 239 | −4 |
| `PoseidonKnowni3`, `inputs[0]` constante | 2 | 264 | 260 | −4 |
| `PoseidonKnowni3`, dos entradas constantes | 3 | 264 | 258 | −6 |

Dos por celda constante, y la forma vieja no plegaba ninguna —243 con y sin entrada constante—. En
`Eligibility(20)` hay 91 celdas así: 2 caminos Merkle × (1 hoja + 20 niveles) × 2, más 3 de identidad,
3 de ingreso y 1 del nulificador. 91 × 2 = **182**, al dígito.

Que el ahorro solo llegue hasta la ronda 0 es lo esperado: en cuanto la mezcla toca una celda
variable, todo el estado deja de ser constante. Y no es una optimización de este repositorio sino del
compilador; lo único que hizo el cambio fue dejar de estorbarla.

### D-63 — El sobre admite el perfil vehicular, y `meetsAll` se queda con forma de arriendo · 2026-09-24

*El bloqueo que `docs/plan.md` nombró el día 8:* `capacity` y `assetStanding` existían como reclamo
(`CapacityClaim`, `AssetStandingClaim`) y como predicado (`proveCapacity`, `proveAssetStanding`), pero
no como **respuesta entregable**. El sobre tenía cuatro respuestas, todas del perfil de arriendo, y el
perfil de la demo es una compraventa de vehículo. La app ya pedía `requiredPredicates:
["personhood", "capacity"]` a la capa atestiguada, así que la incoherencia ya estaba escrita.

*Lo que se hizo:* `Disclosure` gana `capacity` y `assetStanding` con el mismo tipo que las demás
—`boolean | "unavailable"`—, `verify` las responde con el mismo patrón, y `Outcome` las incluye en lo
que se compromete. Doce campos sin anclaje, trece con él.

*Las dos decisiones que no eran obvias:*

1. **El activo no se compara contra el sujeto.** `AssetStandingClaim.subjectRef` es la referencia
   salteada del **carro**, no de la persona. El lazo de `subject_mismatch` de `verify` recorre los
   reclamos del sujeto y habría rechazado toda venta honesta si se le añadía el del activo; la
   referencia del activo viaja en la solicitud de la contraparte (`expectedAssetRef`) y la comprueba
   `proveAssetStanding`. Hay una prueba que falla si alguien los junta.
2. **Un predicado que nadie pidió responde `unavailable`, nunca `false`.** Es la regla que ya regía
   para `solvency` y `formality`, y mantenerla evita que el sobre diga algo del sujeto por el hecho
   de que la contraparte no preguntó. Por eso el sobre es de ancho fijo y no un mapa: el conjunto de
   campos no revela qué perfil se usó.

*Lo que queda mal, dicho en voz alta:* `meetsAll(disclosure, minimumTier)` sigue comprobando las
cuatro respuestas del arriendo e ignora las dos nuevas en silencio. Es una función con forma de
contrato dentro de `core/`, que es justo lo que D-14 prohíbe. No se cambia en este lote porque
cambiar su firma toca la app y el recorrido; queda como criterio de aceptación en `docs/plan.md`
—que un perfil componga qué exige— y con un comentario en el propio archivo para que nadie la use
creyendo que cubre el perfil vehicular.

*Lo que esto no cierra:* ninguna de las dos respuestas se ha producido a partir de una fuente real.
RUNT y SIMIT siguen sin ejercitarse contra una respuesta viva — `docs/verificacion.md`, pendiente 6.

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
| 2026-09-21 | Pago comprobado contra Horizon antes de consultar, aviso por WhatsApp sin veredicto, y wallet del pagador detrás de un puerto con Privy y Freighter. Faltan cuatro llaves; cada una ausente apaga su función — D-27 |
| 2026-09-21 | `solvency` se parte en tres evidencias que no se sustituyen — D-28 — y la ruta al IBC se ordena: integración delegada primero, UGPP solo como excepción manual, open finance como credencial aparte — D-29 |
| 2026-09-21 | Camino documental UGPP escrito: el titular aporta el estado de cuenta, el emisor comprueba autenticidad antes de leerlo y solo sobreviven periodos e IBC. Sin comprobación no hay reclamo, y la ventana de cuatro meses viaja con la cifra |
| 2026-09-21 | Privy entra como login y wallet del pagador: passkey, sesión de 15 minutos atada al dispositivo y firma Stellar por hash crudo, comprobada en el SDK instalado — D-30. Cierre de sesión documentado en `docs/handoff.md` |
| 2026-09-21 | Cierra el hueco del traspaso: `POST /issue` exige una llave de contraparte y un límite por minuto antes de leer el cuerpo, de cobrar o de llamar a Croma. Sin llave configurada el emisor no arranca — D-31. 300 pruebas |
| 2026-09-21 | Investigado el bloqueo de autenticidad del EUC de UGPP: ningún mecanismo público de verificación en las fuentes primarias de UGPP, y el propio emisor declara que el documento no es una certificación válida para trámites de prestaciones económicas. `needs_human_review` queda como la respuesta correcta, no un pendiente — D-32 |
| 2026-09-21 | Pago móvil portable: la cotización publica activo, destino y monto; Privy firma el hash, Freighter el sobre, y Horizon recibe solo el XDR firmado. El emisor deja de aceptar un activo distinto por coincidencia numérica — D-33 |
| 2026-09-22 | `NullifierStore` entra como puerto y `createPersistentNullifierLedger` hidrata el conjunto gastado al arrancar, para que un reinicio de la app deje de devolver una presentación ya gastada. `claim` sigue síncrono a propósito; la escritura es lo que trailea. Falta elegir el almacén del dispositivo — D-34 |
| 2026-09-22 | Caché idempotente del emisor: HMAC por contraparte/sujeto/pregunta/pago, single-flight, expiración con la firma y tamaño acotado. Un retry no vuelve a gastar Horizon, Croma ni WhatsApp — D-35 |
| 2026-09-22 | El conjunto gastado aterriza en el dispositivo con AsyncStorage, una llave por nullifier. Mientras no se haya leído del disco, el verificador rehúsa en vez de aceptar lo que no puede comprobar — D-36 |
| 2026-09-22 | Los pagos canjeados sobreviven al reinicio del emisor en un fichero append-only, y cobrar sin ese fichero deja de ser posible: el proceso no arranca. Ejercido contra el disco real y contra el arranque real — D-37 |
| 2026-09-22 | Cerrada la ventana de durabilidad del pago: `/issue` espera la escritura del gasto antes de tocar Croma y responde `503` si no aterrizó. Una escritura fallida suelta el reclamo en vez de quemarle la transacción al comprador — D-38. 329 pruebas |
| 2026-09-22 | El caché de emisiones sobrevive al reinicio en un fichero JSONL append-only, con expiradas descartadas al hidratar. Opcional a propósito: perderlo cuesta una llamada repetida a Croma, no una emisión de más — D-39. 336 pruebas |
| 2026-09-22 | Ejercido el pago en USDC contra la testnet real: el XDR hecho a mano se acepta en Horizon y el emisor lo verifica de vuelta. Era la pieza sin red más riesgosa del repositorio y no necesitaba llaves de nadie — un activo de prueba propio basta. Detalle en `docs/verificacion.md` |
| 2026-09-22 | Un pago que llega a la tesorería en el activo equivocado deja de decir `wrong_destination` y dice `wrong_asset`. Salió del ejercicio real, y se comprobó contra la misma transacción — D-40 |
| 2026-09-22 | Las fuentes se piden en paralelo y con plazo: una lenta ya no cuelga a las otras tres ni al comprador, y la que se pasa responde `unavailable` sin cobrarse — D-41. 339 pruebas |
| 2026-09-22 | A13 deja de cubrir solo los adaptadores: el servicio HTTP también se comprueba —documento, nombre, placa, teléfono y la llave de la contraparte— con la consola interceptada. No apareció ninguna fuga; la prueba fija la propiedad. 343 pruebas |
| 2026-09-22 | El repositorio entero pasa por `tsc --strict`, no solo `app/`, y CI lo corre. Encontró un import roto en producción y dos pruebas que pasaban por la razón equivocada — D-42 |
| 2026-09-23 | `noUncheckedIndexedAccess` entra en el `tsconfig` de la raíz. Cero errores: el código ya se escribía con esa comprobación en la cabeza, pero nada la exigía — D-43 |
| 2026-09-23 | ESLint con tipos sobre los siete paquetes, dentro de `verify` y de CI: cierra el lint que pedía A14. Encontró un manejador `async` donde Node espera `void` —un rechazo se llevaba el proceso en vez de la petición—, un import muerto y dos pruebas que podían pasar por la razón equivocada — D-44 |
| 2026-09-23 | El contrato Soroban compila, y nueve pruebas fijan su política —todas rechazadas antes del emparejamiento—. El bloqueo era la máquina, no el código. `Cargo.lock` versionado: `soroban-env-host` pide `ed25519-dalek` sin techo y la 3.0.0 no compila contra él — D-45 |
| 2026-09-23 | Primeras pruebas fuzz del emisor, y encontraron una cotización cuyo total era la cadena `"0function Object() { [native code] }"`: las tablas de predicados eran objetos literales indexados por lo que manda quien llama. Ahora son `Map` — D-46. 350 pruebas |
| 2026-09-23 | Una línea corrupta en el caché de emisiones impedía arrancar el emisor, justo lo que D-39 decía que no podía pasar. El adaptador ahora valida y reduce lo que lee del disco, como ya hacía con lo que lee de Croma — D-47 |
| 2026-09-23 | La comprobación de un pago lanzaba una excepción cuando Horizon respondía un monto ilegible o una página que no era una lista. Ahora refusa con la razón que ya existía — D-48 |
| 2026-09-23 | El adaptador de Horizon fallaba con mensajes de JavaScript —`Cannot convert abc to a BigInt`— donde debía nombrar a Horizon, y un `502` de HTML salía como error de parseo. Primeras pruebas fuzz de `anchoring/` — D-49. 365 pruebas |
| 2026-09-23 | Fuzz sobre los cuatro adaptadores de Croma: cero hallazgos. Ya validaban y reducían de verdad, a diferencia del emisor y el anclaje. La diferencia no era la disciplina sino dónde estaba dibujado el límite — D-50. 368 pruebas |
| 2026-09-23 | Los circuitos compilan por primera vez, y la tabla de símbolos delató que el contrato leía `listSetRoot` del índice 11, que es `minMonthsPaid`. El orden de señales deja de ser una lectura: lo escribe el compilador y CI lo comprueba — D-51 |
| 2026-09-24 | Las constantes de ronda de Poseidon se generan en el repositorio y la prueba las compara con las BN254 publicadas por circomlib: coinciden. La matriz MDS no se reproduce y el trabajo se para ahí, nombrado — D-52. 371 pruebas |
| 2026-09-24 | Leer el guion de referencia cerró lo que D-52 dejó abierto: la matriz MDS **reduce** donde las constantes **rechazan**, y circomlib publica la transpuesta. La permutación fuera del circuito ya reproduce el valor del propio gadget — D-53. 376 pruebas |
| 2026-09-24 | El circuito y `core/` no hashean igual —uno separa hoja de nodo con un dominio y el otro no— y la cabecera de `merkle.ts` afirmaba lo contrario. Corregida; la salida queda decidida con el coste medido delante — D-54 |
| 2026-09-24 | El circuito adopta los dominios de `core/`, y al implementarlo apareció que además se saltaba el hash de la hoja entero. +12,1% de restricciones, medido. Solo queda el hash para que las raíces coincidan — D-55. 380 pruebas |
| 2026-09-24 | Definida la codificación de un reclamo como lista de elementos de campo: tipo como etiqueta, cadenas hasheadas, anchos declarados y referencias de 32 bytes **rechazadas** si no están en el campo en vez de reducidas. Es el contrato que el circuito tendrá que adoptar — D-56. 389 pruebas |
| 2026-09-24 | Los siete dominios pasan a una sola lista en `core/` que el circuito importa, y la sal se dibuja dentro del campo con enmascarado y rechazo en vez de 32 bytes crudos — D-57. 393 pruebas |
| 2026-09-24 | Poseidon baja a `core/` y hashear en elementos pasa a ser su propio puerto, `FieldHasher`. Reproduce los valores de hoja y nodo del gadget compilado: por primera vez los dos lados dan el mismo número. Y las constantes dejan de derivarse en cada llamada — D-58. 399 pruebas |
| 2026-09-24 | `commitClaim` y el plegado de Merkle pasan a Poseidon: todos los compromisos cambian de valor. El cambio destapó tres sitios en producción que producían referencias y raíces con SHA-256, fuera del campo — D-59 |
| 2026-09-24 | El circuito y `core/` calculan **el mismo compromiso**, comprobado contra testigos del gadget. El viejo `idCommit` no ataba `attestedAt`, la jurisdicción ni el tipo de documento — D-60. 403 pruebas |
| 2026-09-24 | Plantilla y constantes propias de Poseidon, una por curva: el circuito compila sobre BLS12-381 con constantes derivadas para ese campo y `core/` calcula lo mismo. Cuesta +29% de restricciones por dejar la forma optimizada de circomlib — D-61. 407 pruebas |
| 2026-09-24 | La plantilla llana deja de gastar una señal por suma de constante y tres por celda copiada en las rondas parciales; la permutación no cambia y el testigo que CI construye en cada PR lo comprueba. 37 504 → 25 049 restricciones, por debajo de la forma optimizada de circomlib — D-62. 407 pruebas |
| 2026-09-24 | El sobre admite el perfil vehicular: `capacity` y `assetStanding` pasan de reclamo y predicado a respuesta entregable, y entran en el compromiso del resultado. El activo se compara contra la referencia que pide la contraparte, nunca contra el sujeto — D-63. 415 pruebas |
| 2026-09-24 | Auditoría del plan contra código, suites, CI y ejercicios reales: caché C1–C8 cerrado; pago móvil completo en contrato pero no en wallets reales; A3, A7, A9, A10 y A14 parciales; A12 bloqueado por hardware. El estado vive junto al criterio para que “implementado” no se confunda con “ejercido de punta a punta” |
| 2026-09-24 | Cerrada la evidencia automatizable del pago móvil: P6, P7 y P8 pasan de contrato a prueba. Escribirlas destapó que un firmador que lanza se reportaba como `invalid_terms` —los términos estaban bien; quien falló fue la wallet—, así que construir el XDR y firmarlo dejan de compartir el mismo `catch` — D-64. Y el bundle de Metro entra en CI: typecheck y `node --test` corren sobre Node, donde `Buffer` existe, así que hasta ahora nadie preguntaba si la app empaqueta. 47 pruebas en `app/` |
| 2026-09-24 | El registro de emisores deja de ser solo memoria: un documento firmado, y dos raíces de confianza sobre él —la firma de la autoridad por HTTPS, y el digest anclado en una cadena—. La cadena publica el digest, nunca el documento: un registro que vive en una cadena deja de existir cuando la cadena deja de responder. Los dos adaptadores reducen al mismo `IssuerRegistry` y `RevocationOracle` que `acceptAnswer` ya tomaba, así que la presentación se verifica con código idéntico, y una sola suite corre contra ambos — A3, D-65. Cuando la fuente calla se sirve lo último verificado, marcado `fromCache`: la política de la contraparte decide si eso es suficientemente fresco. 430 pruebas |
| 2026-09-24 | Qué exige un contrato deja de estar escrito en `core/`: `meetsAll` con forma de arriendo desaparece y entra `meetsProfile`, que recorre una lista de requisitos compuesta por quien pregunta. Un incumplimiento dice por qué, y `unavailable` —nadie preguntó— no se confunde con `not_proven` —se preguntó y no se probó—. Un perfil vacío no se cumple: quien no nombró un requisito no dijo qué acepta. Arriendo y compraventa viven en la prueba, no en el dominio — A16, D-66. 437 pruebas |
| 2026-09-24 | El ancla del registro tiene forma: la autoridad se paga un stroop a sí misma con el digest como `MEMO_HASH`, y `createStellarRegistryReader` lee el más reciente de su cuenta. Vive en `attestation/` y no en `anchoring/` porque quien resuelve un registro puede ser el teléfono: no toca `node:crypto`, `Buffer` ni un SDK. `publish-registry.ts` imprime el documento firmado y su digest de los mismos bytes —el camino web y el de cadena no pueden ser dos documentos—. Sin ejercicio real: la política de red de este entorno deniega `horizon-testnet.stellar.org` — D-67. 448 pruebas |
| 2026-09-24 | Por qué falta una respuesta llega hasta quien puede hacer algo con ella, y solo hasta ahí: `sourceStates` viaja al lado del sobre firmado, nunca dentro. La contraparte sigue leyendo `unavailable` sin razón —decirle «el registro no tiene ese dato» sería contarle del sujeto algo que no pidió—, y el titular distingue «no respondió a tiempo» de «no tiene el dato» de «respondió algo que no pudimos usar». La pantalla solo ofrece reintentar lo que un reintento puede cambiar — A7, D-68. 456 pruebas y 54 en `app/` |
| 2026-09-24 | El plazo de D-41 cortaba la espera, no el trabajo: la emisión respondía `unavailable` y el cliente seguía reintentando y sondeando contra una API que se cobra. Ahora el cliente acepta un presupuesto —un `AbortSignal`— y la emisión le da uno por fuente: al vencer el plazo se cancela la llamada en vuelo y no se programa ni un reintento ni un sondeo más. Sin presupuesto el comportamiento es exactamente el de antes, y una prueba lo fija — D-69. 462 pruebas |
| 2026-09-20 | RUAF y ADRES no reemplazan PILA para `solvency`; RUAF mejora `formality` y quita la asimetría de D-12 por esa vía — D-16 |

## Límites de proceso — estado del ejercicio real

La constitución exige que todo lo que cruza un límite de proceso se ejercite contra la cosa real al
menos una vez.

| Límite | Estado |
|---|---|
| Croma REST | ✅ **ejercido el 2026-09-20**: `/catalog` (200), 16 rutas sondeadas con cuerpo vacío (400/404) y `/co/rues/entities-by-name/v1` (200) sobre una empresa pública. Ninguna llamada sobre una persona |
| Stellar Horizon / RPC | ✅ **ejercido el 2026-09-20**: cuenta creada con friendbot y transacción `0dc0fdf4…` aceptada en el ledger 4783364 |
| Pago en USDC de punta a punta | ✅ **ejercido el 2026-09-22**: el XDR construido a mano por `stellar-payment.ts` —activo de crédito, `MEMO_HASH`, firma por hash crudo— aceptado por Horizon en `fb64700b…`, y `verifyPayment` lo acepta de vuelta. Con un activo `USDC` emitido para la prueba, porque el USDC de Circle no se puede acuñar. Falta la firma real de Privy, que necesita un app id |
| Contrato Soroban | ⚠️ **compila desde el 2026-09-23** y sus nueve pruebas corren en CI, con el `wasm` de release construido. Nunca desplegado, y nunca ha verificado una prueba Groth16 real |
| Circom / snarkjs | ⚠️ **circom ejercido el 2026-09-23**: `eligibility.circom` compila (10 932 restricciones no lineales) y su tabla de símbolos corrigió el contrato. snarkjs nunca corrido: no hay prueba generada ni verificada, y falta Poseidon para BLS12-381 |
| Teléfono físico | ⏳ nunca ejecutado |

Ningún número medido aparece en este repositorio.
