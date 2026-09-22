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
| Salud del proyecto | `npx expo-doctor` — 21/21 en SDK 57 |
| Emisión | el cliente llama solo al emisor; las pantallas nunca llaman una fuente |
| Criptografía | `@noble` produce los mismos bytes que `node:crypto` — prueba cruzada |
| Aceptación | política, notas, idempotencia y replay, probados en `app/test` |
| Login | passkey con Privy; sesión de 15 min atada al dispositivo |
| Pago | coordina cotización → firma → Horizon → emisión; nunca consulta fuentes si el pago falla |

**No se ha ejecutado en un teléfono físico.** El criterio A12 del plan sigue abierto.
Tampoco se ha hecho una firma real con Privy o WalletConnect: faltan sus llaves. El motor sí está
probado contra ambos contratos con Horizon y wallets inyectados; no se presenta eso como corrida real.

## Las pantallas

| Ruta | Pantalla | Qué protege |
|---|---|---|
| `/` | 01 Inicio | Credenciales, no una identidad pública |
| `/solicitud` | 02 Solicitud | Quién pregunta, para qué y hasta cuándo |
| `/consentimiento` | 03 Consentimiento | Consultar no es compartir; nada preseleccionado |
| `/emision` | 04 Emisión | Progreso por fuente, sin porcentajes inventados |
| `/revision` | 05 Revisión | Lo que recibe la contraparte **y lo que no** |
| `/acuse` | 06 Acuse | Enviar no es firmar |
| `/verificador` | 07 Verificador | Integridad y frescura, sin expediente |
| `/degradado` | 08 Degradación | Falta una respuesta ≠ no cumple |

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
