// cavos-token.spec.ts: el token de ingreso que el registro de wallets de Cavos
// exige. Sale de la respuesta del código por correo en cualquiera de sus formas,
// y algo que no es un JWT no se hace pasar por token.

import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenFromAuthData } from "../../src/domain/wallet-cavos.ts";

const JWT = "aaa.bbb.ccc";

test("a bare JWT is the token", () => {
  assert.equal(tokenFromAuthData(JWT), JWT);
});

test("JSON carries it as id_token, jwt or token", () => {
  assert.equal(tokenFromAuthData(JSON.stringify({ id_token: JWT })), JWT);
  assert.equal(tokenFromAuthData(JSON.stringify({ jwt: JWT })), JWT);
  assert.equal(tokenFromAuthData(JSON.stringify({ token: JWT })), JWT);
});

test("anything that is not a JWT is no token", () => {
  assert.equal(tokenFromAuthData(JSON.stringify({ ok: true })), undefined);
  assert.equal(tokenFromAuthData("not-a-token"), undefined);
});
