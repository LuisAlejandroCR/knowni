<!-- docs/COLOMBIA.md
     Panorama de fuentes colombianas, por qué PILA es la pieza, y el marco legal
     (Ley 1581, Ley 1266). Se distingue de CROMA.md, que documenta el proveedor y
     sus endpoints concretos; aquí el terreno, allá la puerta. -->

# Colombia

## Las fuentes, y qué puede salir de cada una

| Fuente | Autoridad | Responde | Acceso |
|---|---|---|---|
| **Registraduría** | Registraduría Nacional del Estado Civil | Estado vital | ✅ por [Croma](CROMA.md) |
| **Policía · Procuraduría · Contraloría · Contaduría** | Cada autoridad | Antecedentes penales, disciplinarios, fiscales, morosidad con el Estado | ✅ por Croma |
| **SICAAC** | Supersociedades | Procesos de insolvencia | ✅ por Croma |
| **Rama Judicial · SAMAI** | Rama Judicial | Procesos por parte o radicado | ✅ por Croma (consulta por nombre) |
| **RUES** | Confecámaras | Matrícula mercantil, representación legal | ✅ por Croma |
| **Supersociedades** | Supersociedades | Estados financieros de personas jurídicas | ✅ por Croma |
| **PILA** | Operadores de información (autorizados por MinSalud) | IBC mensual, continuidad de aportes | ⏳ **no confirmado en Croma.** Si no está: operador, con autorización del sujeto |
| **SNR** | Superintendencia de Notariado y Registro | Matrícula inmobiliaria, gravámenes | ⏳ **no confirmado en Croma.** Si no está: certificado de tradición, pago por consulta |
| **DataCrédito / TransUnion** | Central de información crediticia | Historial, ingreso modelado | Comercial; Ley 1266 aplica |

La única columna que importa para el cronograma es la última, y Croma la cambió
de sitio: seis de las nueve filas pasaron de "convenio" a "una key". Las dos que
siguen abiertas —PILA y SNR— son justo las que alimentan *¿le alcanza?* y el
predicado sobre el inmueble. Confirmarlas es la primera tarea de integración.

## Por qué PILA es la pieza

Un arrendamiento colombiano pide certificación laboral y certificación
bancaria. Las dos son preguntas que el registro de aportes ya responde:

- El **IBC** (ingreso base de cotización) es el ingreso declarado sobre el
  que se liquidó el aporte.
- La **continuidad** de los aportes dice si es estable.

Tres ventajas sobre un certificado bancario:

1. **Es mensual**, no una foto de un día.
2. **Es caro de fabricar**: alguien pagó plata real contra ese IBC.
3. **Cubre independientes**, que es justo a quien una carta de nómina no
   puede cubrir — y son la mayoría de quienes hoy quedan por fuera.

Dos límites, escritos también en el código:

- **Cobertura**: un informal no cotiza y se ve idéntico a alguien sin
  ingresos. Por eso `formality` es un predicado aparte, que el arrendador
  tiene que pedir explícitamente, y no un ingrediente escondido de un
  puntaje.
- **Piso, no medición**: muchos independientes cotizan sobre el mínimo legal
  sin importar lo que ganen. El reclamo dice `basis: "social_security"` para
  que el arrendador sepa qué aceptó.

El cálculo: **mediana** de los últimos 12 meses. No la media, porque una
prima o una liquidación la arrastra hacia arriba y el arrendador termina
suscribiendo un año contra un evento único. No el último mes, porque los
aportes se radican tarde y un mes faltante se leería como ingreso cero.

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

1. **Confirmar el catálogo de Croma** — ¿aportes a seguridad social? ¿certificado de tradición?
   Decide el alcance del hackathon, y es una pregunta, no una integración.
2. **Bloques de Croma** — identidad, antecedentes, insolvencia. Una llamada en vivo por endpoint,
   anotada con fecha en [`verificacion.md`](verificacion.md).
3. **SNR / certificado de tradición**, si no está en Croma. Pago por consulta, sin convenio.
   Habilita `propertyStanding`, que es el predicado que le da la vuelta al producto.
4. **PILA vía operador**, si no está en Croma. Acuerdo comercial. Es el que desbloquea el producto
   real, y el único que no se resuelve programando.
