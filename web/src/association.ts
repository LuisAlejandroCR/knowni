// association.ts: los dos documentos que un dominio tiene que servir para que
// una passkey funcione, construidos aquí y no escritos a mano.
//
// El puerto es el dominio: Privy valida la passkey contra el `relyingParty`, y
// el sistema operativo valida el dominio contra estos ficheros. Si uno de los
// dos no cuadra, `loginWithPasskey` falla sin decir por qué — así que lo que
// puede estar mal se rehúsa aquí, con nombre, antes de publicarse.

/// Por qué se rehusó, en lugar de un documento a medias. Un fichero de
/// asociación con un campo vacío es peor que ninguno: el sistema operativo lo
/// acepta, lo cachea y la passkey sigue sin funcionar.
export type AssociationRefusal =
  | "apple_team_id_missing"
  | "apple_team_id_malformed"
  | "bundle_identifier_malformed"
  | "android_package_malformed"
  | "android_fingerprint_missing"
  | "android_fingerprint_malformed";

export type Built<T> = { readonly document: T } | { readonly refused: AssociationRefusal };

export interface AppleAssociation {
  readonly webcredentials: { readonly apps: readonly string[] };
}

export interface AndroidAssetLink {
  readonly relation: readonly string[];
  readonly target: {
    readonly namespace: "android_app";
    readonly package_name: string;
    readonly sha256_cert_fingerprints: readonly string[];
  };
}

/// Un team id de Apple son diez caracteres alfanuméricos en mayúscula.
const TEAM_ID = /^[A-Z0-9]{10}$/;

/// Identificador inverso de dominio: al menos dos segmentos separados por punto.
const REVERSE_DNS = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

/// Una huella SHA-256 son 32 bytes en hexadecimal separados por dos puntos.
const FINGERPRINT = /^([0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$/;

/// El `apple-app-site-association`. Solo lleva `webcredentials`: es lo que una
/// passkey necesita. `applinks` no entra porque nada de este proyecto abre
/// enlaces profundos todavía, y un campo que nadie usa es uno que nadie revisa.
export function appleAssociation(
  teamId: string | undefined,
  bundleIdentifier: string,
): Built<AppleAssociation> {
  if (teamId === undefined || teamId === "") return { refused: "apple_team_id_missing" };
  if (!TEAM_ID.test(teamId)) return { refused: "apple_team_id_malformed" };
  if (!REVERSE_DNS.test(bundleIdentifier)) return { refused: "bundle_identifier_malformed" };
  return { document: { webcredentials: { apps: [`${teamId}.${bundleIdentifier}`] } } };
}

/// El `assetlinks.json`. La relación es `common.get_login_creds` y no
/// `common.handle_all_urls`: lo que se delega es el uso de credenciales, no la
/// apertura de enlaces. La huella se normaliza a mayúscula porque `keytool` y
/// la consola de Play la imprimen distinto y el mismo certificado no debería
/// producir dos ficheros.
export function androidAssetLinks(
  packageName: string,
  fingerprint: string | undefined,
): Built<readonly AndroidAssetLink[]> {
  if (!REVERSE_DNS.test(packageName)) return { refused: "android_package_malformed" };
  if (fingerprint === undefined || fingerprint === "") {
    return { refused: "android_fingerprint_missing" };
  }
  if (!FINGERPRINT.test(fingerprint)) return { refused: "android_fingerprint_malformed" };
  return {
    document: [
      {
        relation: ["delegate_permission/common.get_login_creds"],
        target: {
          namespace: "android_app",
          package_name: packageName,
          sha256_cert_fingerprints: [fingerprint.toUpperCase()],
        },
      },
    ],
  };
}

export interface MobileIdentity {
  readonly bundleIdentifier: string;
  readonly androidPackage: string;
}

/// Lee el identificador de las dos plataformas del `app.json` de la app, que es
/// donde ya viven. Copiarlos a este lado sería una segunda fuente que se
/// desalinea el día que la app cambie de identificador.
export function mobileIdentity(appJson: string): MobileIdentity | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(appJson);
  } catch {
    return undefined;
  }
  const expo = (parsed as { expo?: unknown }).expo;
  if (typeof expo !== "object" || expo === null) return undefined;
  const ios = (expo as { ios?: { bundleIdentifier?: unknown } }).ios;
  const android = (expo as { android?: { package?: unknown } }).android;
  const bundleIdentifier = ios?.bundleIdentifier;
  const androidPackage = android?.package;
  if (typeof bundleIdentifier !== "string" || typeof androidPackage !== "string") return undefined;
  return { bundleIdentifier, androidPackage };
}
