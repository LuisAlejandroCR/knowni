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
| `/index.html` | la raíz: el recorrido de Knowni en cuatro pantallas, para enseñarlo. Sin JavaScript y sin peticiones externas — ver [`DESIGN.md`](DESIGN.md) |

El mismo dominio cierra dos pendientes: es el `EXPO_PUBLIC_PRIVY_RP` de la app y
la URL del documento de registro. Uno, no dos.

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
