<!-- app/README.md
     Cómo correr el wallet de Knowni y qué hace hoy: ocho pantallas del diseño
     del día 8 y los límites reales de emisión y pago. Se distingue de design/day-08/README.md,
     que aprueba el diseño y no explica cómo ejecutarlo. -->

# @knowni/app

El wallet, en Expo. **Bloque 4 de 5:** las ocho pantallas, con el dominio corriendo dentro.
La solicitud se verifica en el dispositivo, las respuestas se comprueban antes de mostrarse y la
aceptación aplica la política de revocación que elija la contraparte.

```bash
cd app
npm install
npm start        # luego i para iOS, a para Android
npm run typecheck
```

`app/` es un proyecto npm **aparte**, no un workspace de la raíz. Así el dominio sigue instalándose
sin una sola dependencia y la CI del repositorio no arrastra 900 paquetes de Expo. El código del
dominio entra por `paths` de TypeScript, no por el registro.

## Lo que está comprobado

| Qué | Cómo |
|---|---|
| Tipos | `npx tsc --noEmit`, sin errores |
| Empaquetado | `npx expo export --platform ios` produce el bundle |
| Salud del proyecto | `npx expo-doctor` |
| Emisión | el cliente llama solo al emisor; las pantallas nunca llaman una fuente |
| Criptografía | `@noble` produce los mismos bytes que `node:crypto` — prueba cruzada |
| Aceptación | política, notas, idempotencia y replay, probados en `app/test` |
| Login | código por correo con Cavos; la llave Stellar vive en el dispositivo — D-85 |
| Pago | coordina cotización → firma → Horizon → emisión; nunca consulta fuentes si el pago falla |

**No se ha ejecutado en un teléfono físico.** El criterio A12 del plan sigue abierto; el guion está
abajo, en *Corrida en un teléfono físico*.
Tampoco se ha hecho una firma real con Cavos o WalletConnect en un teléfono. El motor sí está
probado contra ambos contratos con Horizon y wallets inyectados; no se presenta eso como corrida real.

## Las pantallas

| Ruta | Pantalla | Qué protege |
|---|---|---|
| `/` | 01 Inicio | Credenciales, no una identidad pública |
| `/solicitud` | 02 Solicitud | Quién pregunta, para qué y hasta cuándo |
| `/consentimiento` | 03 Consentimiento | Consultar no es compartir; nada preseleccionado; si el emisor cobra, se paga antes de consultar — D-90 |
| `/emision` | 04 Emisión | Progreso por fuente y etapa del pago, sin porcentajes inventados |
| `/revision` | 05 Revisión | Lo que recibe la contraparte **y lo que no** |
| `/acuse` | 06 Acuse | Enviar no es firmar |
| `/verificador` | 07 Verificador | Integridad y frescura, sin expediente |
| `/degradado` | 08 Degradación | Falta una respuesta ≠ no cumple |
| `/prueba` | Banco de prueba | Groth16 en el teléfono sobre datos de ejemplo, fuera del recorrido — D-82 |
| `/firma` | Wallet | Cavos por código de correo se paga 1 XLM en testnet; la firma se verifica antes de Horizon — D-85. La cuenta conectada es la que paga en el recorrido — D-90 |

## Corrida en un teléfono físico

Nada de esto se ha ejecutado aún. Es el guion para hacerlo una vez y dejar evidencia en
`docs/verificacion.md`, bajo *Corrida en teléfono físico*. Expo Go **no sirve**: el prover y Cavos
son código nativo, así que hace falta una build de desarrollo.

```bash
cd app
npx expo run:android      # teléfono por USB con depuración activada; en iOS: npx expo run:ios --device
```

1. **Prueba Groth16 (plan, pendiente 5).** Abrir `knowni://prueba` y pulsar *Generar prueba*. La primera
   vez descarga 21 MB. Anotar el segundo de la pantalla y el modelo del teléfono. Repetir: la segunda
   vez no descarga.
2. **Recorrido completo (pendiente 1).** Emisor en el portátil y `EXPO_PUBLIC_ISSUER_URL=http://<ip>:8787`.
   Ir de `/` a `/acuse` con una solicitud nueva. Captura de `/revision` y de `/acuse`.
3. **Sin red (A12).** Con las credenciales ya emitidas, modo avión, repetir la presentación. Debe
   emitir sin red; si algo pide red, anotarlo como fallo, no rodearlo.
4. **Persistencia.** Cerrar la app a la fuerza y reabrirla: la misma respuesta presentada otra vez
   tiene que rechazarse como repetida (el libro de nulificadores sobrevive).
5. **Transacción propia (pendiente 3).** Pagar con la llave del dispositivo en testnet y guardar el
   hash; el enlace del explorer es la evidencia.

Cada paso deja una fila, pase o falle. Un paso que falla es evidencia útil; uno sin fila no ocurrió.

## Correrlo contra fuentes reales

```bash
# terminal 1 — el emisor, con la llave
npm start --workspace @knowni/issuer

# terminal 2 — la app
cd app && npm start
```

Sin el emisor corriendo, la app **no inventa respuestas**: dice que no encontró al emisor y no
consulta nada. Con él, el recorrido es real de punta a punta — Registraduría, SICAAC, las tres
listas y RUNT/SIMIT — y las respuestas llegan firmadas y se verifican en el teléfono.

En un dispositivo físico, `localhost` es el teléfono: hay que apuntar
`EXPO_PUBLIC_ISSUER_URL=http://<ip-del-portátil>:8787` antes de `npm start`.
