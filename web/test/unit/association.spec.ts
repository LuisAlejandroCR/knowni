// association.spec.ts: lo que se publica en un dominio no se puede reintentar
// en silencio —el sistema operativo cachea el fichero—, así que lo que puede
// estar mal se rehúsa con nombre y eso es lo que se fija aquí.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  androidAssetLinks,
  appleAssociation,
  mobileIdentity,
} from "../../src/association.ts";

const TEAM = "ABCDE12345";
const BUNDLE = "co.knowni.wallet";
const PRINT = "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99";

test("el fichero de Apple ata el team id al identificador del bundle", () => {
  const built = appleAssociation(TEAM, BUNDLE);
  assert.ok("document" in built);
  assert.deepEqual(built.document, { webcredentials: { apps: [`${TEAM}.${BUNDLE}`] } });
});

test("solo lleva webcredentials: nada de este proyecto abre enlaces profundos", () => {
  const built = appleAssociation(TEAM, BUNDLE);
  assert.ok("document" in built);
  assert.deepEqual(Object.keys(built.document), ["webcredentials"]);
});

test("un team id ausente y uno mal formado no son la misma refusal", () => {
  assert.deepEqual(appleAssociation(undefined, BUNDLE), { refused: "apple_team_id_missing" });
  assert.deepEqual(appleAssociation("", BUNDLE), { refused: "apple_team_id_missing" });
  assert.deepEqual(appleAssociation("abcde12345", BUNDLE), { refused: "apple_team_id_malformed" });
  assert.deepEqual(appleAssociation("ABCDE123", BUNDLE), { refused: "apple_team_id_malformed" });
});

test("un identificador que no es inverso de dominio se rehúsa", () => {
  assert.deepEqual(appleAssociation(TEAM, "wallet"), { refused: "bundle_identifier_malformed" });
  assert.deepEqual(appleAssociation(TEAM, ""), { refused: "bundle_identifier_malformed" });
});

test("el assetlinks delega credenciales, no la apertura de enlaces", () => {
  const built = androidAssetLinks(BUNDLE, PRINT);
  assert.ok("document" in built);
  assert.deepEqual(built.document[0]?.relation, ["delegate_permission/common.get_login_creds"]);
  assert.equal(built.document[0]?.target.package_name, BUNDLE);
});

test("la huella se normaliza a mayúscula: keytool y Play la imprimen distinto", () => {
  const upper = androidAssetLinks(BUNDLE, PRINT);
  const lower = androidAssetLinks(BUNDLE, PRINT.toLowerCase());
  assert.ok("document" in upper);
  assert.ok("document" in lower);
  assert.deepEqual(lower.document, upper.document);
});

test("una huella ausente, una corta y una con separador equivocado se rehúsan", () => {
  assert.deepEqual(androidAssetLinks(BUNDLE, undefined), { refused: "android_fingerprint_missing" });
  assert.deepEqual(androidAssetLinks(BUNDLE, ""), { refused: "android_fingerprint_missing" });
  assert.deepEqual(androidAssetLinks(BUNDLE, PRINT.slice(0, -3)), {
    refused: "android_fingerprint_malformed",
  });
  assert.deepEqual(androidAssetLinks(BUNDLE, PRINT.replace(/:/g, "")), {
    refused: "android_fingerprint_malformed",
  });
});

test("el identificador sale del app.json de la app, no de una copia", () => {
  const identity = mobileIdentity(readFileSync(new URL("../../../app/app.json", import.meta.url), "utf8"));
  assert.deepEqual(identity, { bundleIdentifier: BUNDLE, androidPackage: BUNDLE });
});

test("un app.json ilegible o sin identificadores no produce un fichero a medias", () => {
  assert.equal(mobileIdentity("no json"), undefined);
  assert.equal(mobileIdentity("{}"), undefined);
  assert.equal(mobileIdentity('{"expo":{"ios":{"bundleIdentifier":"co.knowni.wallet"}}}'), undefined);
});
