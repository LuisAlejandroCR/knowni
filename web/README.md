<!-- web/README.md
     El dominio HTTPS del proyecto: qué sirve, por qué se genera aquí y no en
     Vercel, y en qué orden se hacen las cosas. Se distingue de app/README.md,
     que es la app que consume este dominio. -->

# `web/`

Un sitio estático con tres ficheros. Dos existen para que una passkey funcione;
el tercero es el documento de registro que A3 necesita publicar.

| Ruta | Para qué |
|---|---|
| `/.well-known/apple-app-site-association` | iOS valida el dominio contra el team id y el bundle de la app antes de dejar usar una passkey |
| `/.well-known/assetlinks.json` | lo mismo en Android, contra el paquete y la huella del certificado de firma |
| `/registry.json` | el documento de registro firmado, la raíz de confianza *web* de `RegistryPort` |
| `/index.html` | hoy explica la infraestructura del dominio; el siguiente corte la convierte en pitch verificable sin mover las tres rutas de máquinas |

El mismo dominio cierra dos pendientes: es el `EXPO_PUBLIC_PRIVY_RP` de la app y
la URL del documento de registro. Uno, no dos.

## Estructura propuesta para el pitch

La referencia útil de CREVA no es su producto ni su copy: es el orden. Promesa primero, recorrido
después, recibos verificables y límites antes del cierre. Knowni debe adoptar esa disciplina con su
propia tesis y con el perfil que sí puede defender. La página actual desplegada narra arriendo;
D-13 fija la demo real como compraventa de vehículo ante notario, porque es la única que cierra
persona y activo con las fuentes disponibles.

### 1. Hero — la promesa, no el mecanismo

**Eyebrow:** `STELLAR ODYSSEY 2026 · PRIVACIDAD`

**Título:** `Demuestra que puedes firmar. Sin entregar quién eres.`

**Bajada:** `Knowni convierte registros consentidos en respuestas verificables. La contraparte
comprueba lo que pidió; nunca recibe tu cédula, tus ingresos ni el expediente de la fuente.`

**Acciones:** `Ver el recorrido` · `Abrir evidencia real`

No abrir con “tu cédula”. Eso explica el insumo antes de explicar por qué el producto importa y
encierra Knowni en identidad, cuando el dominio es calificación para cualquier contrato.

### 2. La promesa y su frontera

**Título:** `La contraparte recibe respuestas, no documentos.`

Dos columnas breves:

- **Sí demuestra:** que el emisor firmó las respuestas pedidas, que pertenecen a esa solicitud y
  que el registro aceptado estaba vigente.
- **No demuestra:** identidad universal, historial crediticio, probabilidad de pago ni que una
  transacción en cadena vuelva verdadero el dato de origen.

Esta sección debe aparecer antes de enseñar tecnología. Es la diferencia entre una tesis de
privacidad y una colección de integraciones.

### 3. El recorrido defendible — compraventa de vehículo

Cinco pasos, en este orden:

1. **La notaría solicita un perfil.** Identidad vigente, capacidad para contratar, ausencia de
   sanciones y estado del vehículo; finalidad, reto y vencimiento quedan ligados.
2. **El titular consiente las fuentes.** El emisor consulta una vez y reduce cada respuesta dentro
   del adaptador; la notaría nunca consulta Croma.
3. **El teléfono prepara la presentación.** Conserva reclamo y sal; comparte solo respuestas
   firmadas ligadas a esa notaría y esa solicitud.
4. **La contraparte verifica.** Comprueba firma, registro, vigencia, finalidad y replay; una fuente
   no disponible nunca se convierte en un “no cumple”.
5. **Queda un recibo auditable.** El digest puede verificarse por HTTPS y contra Stellar sin poner
   documento, placa, resultado ni identidad en cadena.

El arriendo puede aparecer en una línea posterior como otro perfil posible, nunca como el caso que
las fuentes reales ya cierran. `solvency` de persona natural sigue sin una fuente PILA confirmada.

### 4. Evidencia — qué prueba cada recibo

Cada tarjeta usa siempre dos frases: **Prueba** y **No prueba**.

| Recibo | Prueba | No prueba |
|---|---|---|
| Registro HTTPS firmado | que esa autoridad publicó esas llaves, schemas y revocaciones | que una fuente personal dijo la verdad |
| Ancla de registro en Stellar testnet | que el digest exacto existía en ese ledger | el contenido del documento ni la identidad del sujeto |
| Pago USDC en testnet | que el XDR portable fue aceptado y el emisor pudo comprobarlo | una compra real ni valor económico |
| Suite y CI | que invariantes, adapters, circuitos, contrato y bundles pasan lo automatizado | ejecución en un teléfono físico |
| Croma ejercido | que el contrato HTTP, catálogo y rutas respondieron como se documenta | cobertura ni exactitud sobre una persona real |

Los enlaces concretos salen de `docs/verificacion.md`; la página no duplica cifras o hashes sin
fecha. La evidencia no va en un carrusel: un jurado debe poder abrirla sin esperar animaciones.

### 5. No está listo — dicho antes del cierre

- Nunca se ejecutó en un teléfono físico ni se probó AsyncStorage real en modo avión.
- Ningún adapter se ejercitó sobre una persona con consentimiento.
- Privy y Freighter no han firmado el recorrido real de la app.
- No hay prueba Groth16 generada y verificada de punta a punta.
- El contrato Soroban compila y se prueba, pero no está desplegado.

La lista no debilita el pitch. Delimita qué evidencia compra cada enlace y evita que una pieza real
—por ejemplo, una transacción testnet— parezca validar el sistema entero.

### 6. Cierre — una frase y tres salidas

**Título:** `Una notaría obtiene cuatro respuestas verificables. La persona conserva su
expediente.`

**Acciones:** `Ver demo` · `Abrir recibos` · `Revisar código`

El registro firmado queda accesible en el pie como infraestructura (`/registry.json`), no como CTA
principal. Los ficheros de asociación no se muestran: existen para iOS y Android, no para el jurado.

### Qué se conserva del recorrido actual

Se conservan las tarjetas de respuestas, el contraste “lo que cruza / lo que no cruza” y el
lenguaje visual de la app. Se retiran como estructura principal la paginación por hashes y el
arranque en primera persona. El jurado debe poder recorrer la tesis completa con scroll y enlazar
cada sección; la interacción del producto vive en la app y en el video.

## Por qué el build corre aquí y no en Vercel

El documento de registro lo firma `KNOWNI_REGISTRY_SEED`. Firmarlo en el build de
Vercel pondría esa semilla en manos del proveedor de hosting, y una autoridad de
registro cuya llave vive en su CDN no es una autoridad. El documento firmado es
público por construcción, así que se firma donde vive la semilla y se publica el
resultado.

Consecuencia: **Vercel no construye nada.** Sirve `public/` tal cual, sin build
command y sin una sola variable de entorno.

## Cómo se publica

```bash
# 1. El documento de registro, firmado donde vive la semilla.
KNOWNI_REGISTRY_SEED=<64 hex> node --experimental-strip-types \
  attestation/tools/publish-registry.ts registry.json > /tmp/signed-registry.json
# El digest sale por stderr: es lo que se ancla en cadena.

# 2. Los ficheros de asociación, desde los identificadores que ya viven en
#    app/app.json. Los dos valores que faltan son los únicos que no están aquí.
KNOWNI_APPLE_TEAM_ID=ABCDE12345 \
KNOWNI_ANDROID_CERT_SHA256=AA:BB:…:99 \
  node --experimental-strip-types web/build.ts /tmp/signed-registry.json

# 3. Commitear web/public/ y desplegar.
```

En Vercel: **Root Directory** `web`, **Output Directory** `public`, sin build
command. El Root Directory importa por una razón que no es de gusto: Vercel lee
`vercel.json` desde ahí. Con la raíz del repositorio se ignora este fichero, se
pierden los `Content-Type` y iOS deja de aceptar el `apple-app-site-association`.

`public/index.html` está commiteado, así que el proyecto despliega verde antes de
que existan los otros tres ficheros. `build.ts` no lo toca. `vercel.json` fija los `Content-Type`, que es lo que importa: iOS pide
`apple-app-site-association` **sin extensión** y servido como `application/json`.

Después, `EXPO_PUBLIC_PRIVY_RP` es ese dominio, sin esquema ni barra.

## De dónde salen los dos valores que no están en el repositorio

- `KNOWNI_APPLE_TEAM_ID` — diez caracteres alfanuméricos, en la cuenta de
  desarrollador de Apple.
- `KNOWNI_ANDROID_CERT_SHA256` — la huella del certificado con el que se **firma
  el build que se instala**. `eas credentials` la imprime; si la app se
  distribuye por Play, la que vale es la de *App signing* de Play, no la de
  carga. Firmar con un certificado y publicar la huella de otro es el fallo que
  parece que todo funciona hasta que la passkey no aparece.

`build.ts` rehúsa con un nombre —`apple_team_id_missing`,
`android_fingerprint_malformed`— antes de escribir nada. Un fichero de
asociación con un campo vacío es peor que ninguno: el sistema operativo lo
acepta, lo cachea, y la passkey sigue sin funcionar sin decir por qué.

## Lo que esto no hace

- **No hay paso de CI que compruebe que `public/` no derivó**, porque
  regenerarlo exige los dos valores de arriba y CI no los tiene. El fichero
  generado se commitea y su generador vive al lado; es la única cosa de este
  repositorio que se cree sin que la máquina lo recompruebe.
- **No sirve `applinks`.** Nada de este proyecto abre enlaces profundos
  todavía, y un campo que nadie usa es uno que nadie revisa.
- **No prueba que la passkey funcione.** Eso necesita un dev build en un
  dispositivo: Expo Go no carga `@privy-io/expo/passkey`.
