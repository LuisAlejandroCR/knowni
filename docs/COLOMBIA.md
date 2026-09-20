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

1. **Bloques de Croma** — Registraduría, las tres de inhabilidades, SICAAC, ADRES, RUNT y SIMIT.
   Una llamada en vivo por endpoint, anotada con fecha en [`verificacion.md`](verificacion.md).
2. **Ruta y forma de ADRES** — está en el catálogo pero no en ningún repositorio previo, así que no
   se supone. De ella depende que `formality` distinga cotizante de beneficiario.
3. **SNR / certificado de tradición** — fuera de Croma. Pago por consulta, sin convenio. Habilita
   `propertyStanding` sobre inmueble, que es lo que abre la compraventa inmobiliaria.
4. **PILA vía operador** — fuera de Croma. Acuerdo comercial, no programación. Es el que desbloquea
   el arrendamiento, que es el caso de mayor volumen.
