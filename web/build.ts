// build.ts: escribe web/public/, que es lo que Vercel sirve.
//
// Se corre **aquí**, no en Vercel, y su salida se commitea. La razón es la
// semilla: firmar el documento de registro en el build de Vercel pondría
// `KNOWNI_REGISTRY_SEED` en manos del proveedor de hosting, y una autoridad de
// registro cuya llave vive en su CDN no es una autoridad. El documento firmado
// es público por construcción, así que se firma donde vive la semilla y se
// publica el resultado.
//
//   KNOWNI_APPLE_TEAM_ID=ABCDE12345 \
//   KNOWNI_ANDROID_CERT_SHA256=AA:BB:…:FF \
//     node --experimental-strip-types web/build.ts [documento-firmado.json]
//
// El documento de registro es opcional: sin él se escriben solo los ficheros de
// asociación, que es lo que hace falta para la passkey.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { androidAssetLinks, appleAssociation, mobileIdentity } from "./src/association.ts";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "public");
const wellKnown = join(publicDir, ".well-known");

function fail(reason: string): never {
  process.stderr.write(`refused: ${reason}\n`);
  process.exit(1);
}

const identity = mobileIdentity(readFileSync(join(here, "..", "app", "app.json"), "utf8"));
if (identity === undefined) fail("app/app.json no declara bundleIdentifier y package");

const apple = appleAssociation(process.env["KNOWNI_APPLE_TEAM_ID"], identity.bundleIdentifier);
if ("refused" in apple) fail(apple.refused);

const android = androidAssetLinks(identity.androidPackage, process.env["KNOWNI_ANDROID_CERT_SHA256"]);
if ("refused" in android) fail(android.refused);

mkdirSync(wellKnown, { recursive: true });

// Sin extensión y como JSON: es el nombre exacto que iOS pide.
writeFileSync(join(wellKnown, "apple-app-site-association"), `${JSON.stringify(apple.document, null, 2)}\n`);
writeFileSync(join(wellKnown, "assetlinks.json"), `${JSON.stringify(android.document, null, 2)}\n`);

const registryPath = process.argv[2];
if (registryPath !== undefined) {
  // Se copia tal cual: reserializar cambiaría los bytes y el digest anclado es
  // sobre estos bytes, no sobre este objeto.
  writeFileSync(join(publicDir, "registry.json"), readFileSync(registryPath));
  process.stderr.write("wrote public/registry.json\n");
} else {
  process.stderr.write("no registry document given: only the association files were written\n");
}

process.stderr.write(`wrote public/.well-known/ for ${identity.bundleIdentifier}\n`);
