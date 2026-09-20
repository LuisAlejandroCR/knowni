<!-- attestation/README.md
     Qué hace este workspace: firma la raíz publicada por un emisor y verifica
     una credencial sin red y sin cadena. Se distingue de anchoring/, que solo
     publica un recibo opcional de un resultado, y de core/, que no firma nada. -->

# @knowni/attestation

Un emisor firma **una raíz**, una vez. El titular guarda su reclamo, su sal y su ruta de Merkle.
La contraparte comprueba tres cosas, offline:

1. la firma de la raíz, contra la llave que publica el **registro** — nunca contra una llave que
   venga dentro de la credencial;
2. que la ruta lleve a **esa** raíz firmada, no a la que traiga la prueba;
3. que la hoja sea el compromiso de **ese** reclamo con **esa** sal.

Si falla, dice cuál de las tres y con un vocabulario fijo: `unknown_issuer`, `bad_signature`,
`not_included`, `commitment_mismatch`, `root_expired`, `revoked`.

Sin cadena en ninguna parte. `anchoring/` publica después un recibo opcional; si esa red se cae,
esta verificación sigue funcionando igual — que es justo el criterio A11 del plan.

Una revocación es una respuesta del registro. **La ausencia de respuesta no es una revocación**: un
registro inalcanzable no puede invalidar en silencio cada credencial emitida.
