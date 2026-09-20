<!-- docs/COLOMBIA.md
     Panorama de fuentes colombianas, por qué PILA es la pieza, y el marco legal
     (Ley 1581, Ley 1266). Se distingue de CROMA.md, que documenta el proveedor y
     sus endpoints concretos; aquí el terreno, allá la puerta. -->

# Colombia

## Las fuentes, y qué puede salir de cada una

Contra el catálogo real de Croma, revisado el **2026-09-20**.

| Fuente | Responde | Acceso |
|---|---|---|
| **Registraduría** | Estado vital | ✅ por [Croma](CROMA.md) |
| **Procuraduría · Contraloría · Contaduría** | Inhabilidad disciplinaria, responsabilidad fiscal, morosidad con el Estado | ✅ por Croma |
| **SICAAC** | Procesos de insolvencia | ✅ por Croma |
| **Rama Judicial · SAMAI** | Procesos por parte o radicado | ✅ por Croma (consulta por nombre) |
| **ADRES** | Afiliación a salud → cotizante activo | ✅ por Croma, **con la regla asimétrica de D-12** |
| **RUES · Supersociedades** | Matrícula mercantil, representación, estados financieros | ✅ por Croma |
| **RUNT · SIMIT** | Vehículo por placa, historial, comparendos | ✅ por Croma |
| **DIAN** | Factura electrónica por CUFE | ✅ por Croma (el sujeto aporta el CUFE) |
| ~~**PILA**~~ | IBC mensual, continuidad de aportes | ❌ **No está en Croma.** Operador de información — acuerdo comercial |
| ~~**SNR**~~ | Matrícula inmobiliaria, gravámenes | ❌ **No está en Croma.** Certificado de tradición, pago por consulta |
| ~~**Policía · Fiscalía**~~ | Antecedentes penales | **Excluido por decisión de producto**, no por acceso — [`memoria.md`](memoria.md) D-09 |
| ~~**DNP Sisbén IV / RUI**~~ | Clasificación socioeconómica | **Excluido.** Es un filtro de pobreza con sello oficial — D-12 |

Las dos ausencias son justamente las que deciden dos casos de uso distintos: sin PILA no hay
*¿le alcanza?*, que es lo que decide un **arrendamiento**; sin SNR no hay predicado sobre el
**inmueble**. Lo que sí queda completo es una **compraventa de vehículo**: sujeto y activo, los dos
con fuentes reales. Ver D-13.

## Por qué PILA es la pieza

Un arrendamiento colombiano pide certificación laboral y certificación bancaria. Las dos son
preguntas que el registro de aportes ya responde:

- El **IBC** (ingreso base de cotización) es el ingreso declarado sobre el que se liquidó el aporte.
- La **continuidad** de los aportes dice si es estable.

Tres ventajas sobre un certificado bancario: es **mensual** en vez de una foto de un día, es **caro
de fabricar** porque alguien pagó plata real contra ese IBC, y **cubre independientes**, que es
justo a quien una carta de nómina no puede cubrir.

### Lo que la fuente primaria establece

Todo lo de esta sección sale del **ABECÉ de PILA del Ministerio de Salud y Protección Social,
fechado en junio de 2018** — no de conocimiento general. Es un documento sobre **cómo se liquida y
se paga**, y eso importa para lo que viene después.

**PILA cubre cuatro subsistemas, no uno.** Salud y pensiones son obligatorios; riesgos laborales
lo es para algunos y voluntario para otros; la caja de compensación es opcional para cualquier
independiente. Las administradoras son EPS, AFP y Colpensiones, ARL, y CCF.

**Hay tres tipos de cotizante independiente**, y la distinción es información real sobre la forma
de trabajo (Resolución 2388 de 2016 y sus modificaciones):

| Tipo | Quién es | A qué aporta |
|---|---|---|
| `3` | Independiente por cuenta propia | Salud y pensiones, anticipado |
| `59` | Independiente **con contrato de prestación de servicios superior a 1 mes** | Salud, pensiones y riesgos, anticipado |
| `57` | Independiente voluntario a riesgos laborales | Salud, pensiones y riesgos, **vencido** |

Hay además el `43`, que aporta a pensiones a través de un tercero y está obligado a pagar salud
sobre el mismo IBC.

**El IBC tiene piso legal.** Un independiente reporta siempre 30 días salvo novedad de ingreso, y
el IBC proporcional **no puede ser inferior a la proporción de 1 SMLMV**. Esto es lo que convierte
el IBC en un **piso del ingreso**, no en una medición — y ahora está sostenido por la norma, no por
una suposición nuestra.

**El IBC agrega todos los contratos.** Si un independiente tiene varios contratos de prestación de
servicios, debe calcular el IBC a partir de los honorarios de todos los que esté ejecutando. Eso lo
hace mejor señal de ingreso total de lo que yo suponía.

**El acceso es un operador de información.** El listado de operadores autorizados está publicado
por MinSalud (Protección Social → Aseguramiento → PILA → Contacto Operadores). No hay otra puerta.

### Dos caveats que la fuente obliga a escribir

**Las fechas de las novedades son opcionales.** El ABECÉ dice literalmente que *"por ahora los
datos de las fechas de las diferentes novedades laborales no son obligatorios"*, y lo mismo con las
horas laboradas. Es decir: la señal de continuidad es **más ruidosa** de lo que yo asumí, y
`formality` tiene que tolerar meses sin fecha sin leerlos como ausencia.

**Existe la mora, y la corrección posterior.** La planilla `N — Correcciones` permite añadir
subsistemas o novedades omitidas después del pago inicial, y las fechas límite dependen de los dos
últimos dígitos del documento (del 2.º al 16.º día hábil). Un mes puede aparecer tarde, o aparecer
dos veces. Eso justifica dos decisiones que ya estaban en el código: contar **meses distintos** y
no filas, y usar la **mediana** en vez del último mes.

### El hallazgo incómodo

**Este documento es sobre pagar, no sobre consultar.** Describe cómo un aportante liquida y paga a
través de un operador; **no establece en ninguna parte un servicio por el que un tercero —ni
siquiera el propio sujeto— consulte su historial de aportes**, ni con qué consentimiento, ni con
qué retención.

Eso afina el bloqueo de `solvency` y `formality`: el problema no es "conseguir acceso a PILA", es
que **la vía de consulta hay que confirmarla que existe** antes de planear contra ella. El operador
tiene el dato porque lo procesó; que lo exponga a consulta del titular es otra cosa, y no está en
esta fuente.

**Y la fuente tiene siete años.** Junio de 2018. El umbral de $5.859.315 para pago electrónico
obligatorio es de ese año y hoy es otro; los decretos citados pueden haberse modificado. Nada de
esta sección debe darse por vigente sin re-confirmar.

## ¿RUAF y ADRES reemplazan a PILA?

Media respuesta sí, media no, y la que sí corrige una decisión anterior.

**Qué son, verificado en fuente primaria.** El ABECÉ de MinSalud (respuesta 20) dice que los
operadores de PILA **validan la EPS contra la BDUA** —que administra ADRES— y **la administradora
de pensiones contra el RUAF**. Son registros de **afiliación**: existen para decir a qué
administradora pertenece alguien.

**Para `solvency`, no. Y no es cuestión de acceso.** Ninguno lleva el IBC. El IBC solo existe en la
planilla de PILA porque es el valor sobre el que se liquidó un aporte; un registro de afiliación
dice *dónde estás*, no *cuánto declaraste*. El dato no está ahí.

**Para `formality`, sí — y mejor que ADRES.**

| Fuente | Señal | ¿Marcador de pobreza? |
|---|---|---|
| ADRES — régimen de salud | contributivo vs **subsidiado** | **Sí.** De ahí la regla asimétrica de [`memoria.md`](memoria.md) D-12 |
| RUAF — afiliación a **ARL** | afiliado o no | **No.** No existe una ARL subsidiada |
| RUAF — afiliación a AFP / Colpensiones | afiliado o no | **No.** Va atada a cotizar |

No hay versión subsidiada de riesgos laborales: se está afiliado a una ARL por una relación de
trabajo —dependiente, cotizante `59` con contrato de prestación de servicios, o `57` voluntario— o
no se está. **La puerta de atrás que obligó a la regla asimétrica no existe en esta señal.**

**Lo que se pierde igual.** Los dos son registros de **estado**, no libros de **historial**. Dicen
si alguien está afiliado y activo hoy; no dicen cuántos de los últimos doce meses cotizó. Así que
`monthsContributedLast12` **no es respondible** por esta vía, y `formality` baja de *"cotiza, y con
qué continuidad"* a *"está activo hoy"*. Es menos, y la pantalla tiene que decirlo.

**El obstáculo práctico.** **RUAF no está en el catálogo de Croma**; ADRES sí. La mejor de las dos
señales es también la que exige una integración aparte.

**Nivel de evidencia.** Que BDUA y RUAF existen y para qué los usan los operadores: **verificado en
fuente primaria**. Qué campos expone cada uno —régimen, estado, tipo de afiliado, ARL—: **supuesto
propio** hasta ver una respuesta real.

## Marco legal

**Ley 1581 de 2012 (Protección de Datos Personales)** y **Ley 1266 de 2008
(Habeas Data financiero)**.

Lo que cambia con este diseño:

- **Minimización** — el arrendador deja de ser responsable del tratamiento de
  la cédula y la nómina, porque nunca las recibe. Cuatro booleanos no son
  datos sensibles.
- **Autorización** — la consulta a la fuente ocurre en emisión, con
  autorización del sujeto, y para una finalidad declarada. Es el punto donde
  el consentimiento es real: el sujeto ve qué se consulta antes de aceptar.
- **Finalidad** — el `purpose` viaja dentro del `sessionId`, así que una
  prueba obtenida para arrendar no sirve para otra cosa. La limitación de
  finalidad deja de ser una cláusula y pasa a ser una restricción
  criptográfica.
- **Circulación** — lo que se ancla es un compromiso cegado. No es un dato
  personal: sin el factor de cegado no abre a nada, y solo el sujeto lo
  tiene.

Esto **no** es asesoría legal. Antes de producción hace falta: concepto sobre
el rol de Knowni (¿responsable o encargado?), el aviso de privacidad, y —
si `solvency` se llegara a interpretar como dato crediticio — revisar si la
Ley 1266 aplica al emisor. Ese último punto es otra razón para no emitir
nunca un puntaje.

## Lo que sigue, en orden de dificultad

1. **Bloques de Croma** — Registraduría, las tres de inhabilidades, SICAAC, ADRES, RUNT y SIMIT.
   Una llamada en vivo por endpoint, anotada con fecha en [`verificacion.md`](verificacion.md).
2. **Ruta y forma de ADRES** — está en el catálogo pero no en ningún repositorio previo, así que no
   se supone. De ella depende que `formality` distinga cotizante de beneficiario.
3. **SNR / certificado de tradición** — fuera de Croma. Pago por consulta, sin convenio. Habilita
   `propertyStanding` sobre inmueble, que es lo que abre la compraventa inmobiliaria.
4. **PILA vía operador** — fuera de Croma. Acuerdo comercial, no programación. Es el que desbloquea
   el arrendamiento, que es el caso de mayor volumen.
