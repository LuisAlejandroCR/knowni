<!-- docs/handoff.md
     Estado del proyecto al 2026-09-25 (noche) y la cola de PRs para que otro agente tome uno:
     alcance, archivos, criterios de aceptación y cómo verificar cada uno.
     Se distingue de plan.md, que fija el alcance del producto, y de memoria.md, que guarda el porqué. -->

# Traspaso — 2026-09-25

Leer en este orden: `AGENTS.md`, `CLAUDE.md`, este archivo, `docs/memoria.md` (D-01 a D-86),
`docs/verificacion.md` (qué está comprobado y qué no), `docs/plan.md` (criterios y auditoría).

## Dónde está el proyecto

| | Estado |
|---|---|
| Pruebas | repositorio verde en `main`; **108 de la app** en la rama `fix/app-document-kind` |
| Rama abierta | `fix/app-document-kind`: 9 commits **locales, sin push** (ver PR-0) |
| iPhone | build de desarrollo EAS `12aeaef3…` instalado; el JS llega por Metro, sin build nuevo |
| Emisor | corre en el portátil; el teléfono lo alcanza en `https://issuer.voltarut.com` (túnel Cloudflare `knowni-issuer`), llave fija `ccd01955…` |
| Primera corrida real | Registraduría vía Croma → firma del emisor → verificador del teléfono: **"Respuestas verificadas"** (D-86, `verificacion.md`) |
| Builds iOS | EAS gratis: **1 build** disponible hasta el reset de octubre |
| CI | GitHub Actions a $0 hasta **2026-10-01**: no hacer push sin decisión humana |

## Reglas para quien tome un PR

1. Una rama y un PR por fila de la cola. Commit de una línea, Conventional Commits, en inglés, **sin trailers**.
2. SDD: si la fila dice *spec primero*, el primer commit es la sección en `docs/plan.md`.
3. Verify antes de decir hecho: `cd app && npm run typecheck && npm test && npm run bundle`, y `npm run verify` en la raíz si tocas paquetes compartidos. Lo que toca pantalla se mira en el iPhone.
4. Decisiones nuevas: **D-87 en adelante** en `docs/memoria.md`. Hay otros agentes en worktrees hermanos: revisa el último número antes de escribir uno.
5. Secretos solo en `.env.local` y `app/.env.local` (gitignored). Documenta el nombre de la variable en `.env.example`, nunca el valor.

## Cómo levantar el entorno del teléfono

```bash
# raíz del repositorio, tres procesos
node --env-file=.env.local --experimental-strip-types issuer/src/main.ts
cloudflared tunnel --no-autoupdate run --url http://localhost:8787 knowni-issuer
cd app && npx expo start --dev-client --lan
```

El iPhone debe estar en la misma Wi-Fi que el portátil (Metro); el emisor funciona desde cualquier
red. Detener los tres al terminar. `app/.env.local` necesita `EXPO_PUBLIC_ISSUER_URL`,
`EXPO_PUBLIC_ISSUER_ACCESS_KEY` y `EXPO_PUBLIC_ISSUER_PUBLIC_KEY`; si cambia `KNOWNI_ISSUER_SEED`,
hay que volver a anclar la pública.

## Cola de PRs, en orden

| # | PR | Tamaño | Depende de | Quién |
|---|---|---|---|---|
| 0 | Push de `fix/app-document-kind` | — | decisión de CI | humano |
| 1 | Limpieza de restos de Codemagic y archivos sueltos | S | — | agente |
| 2 | Cavos en el dev build (`/firma`) | S–M | build solo si falla el redirect | agente + teléfono |
| 3 | Pago USDC en testnet dentro del recorrido (A10) | M | 2 | agente + teléfono |
| 4 | Contraparte real: spec | S | — | agente |
| 5 | Contraparte real: solicitud firmada desde `web/` con QR | M | 4 | agente |
| 6 | Contraparte real: escanear en la app | M | 5, **1 build** (cámara nativa) | agente + teléfono |
| 7 | Contraparte real: entrega y acuse | M | 6 | agente |
| 8 | Agentes en la app: spec y pantalla de delegación | M | 4 | agente |
| 9 | Publicar el documento de registro por HTTPS (A3) | S | dominio | agente + humano |
| 10 | Fuentes restantes con consentimiento (A9) | S por fuente | titular | humano + agente |
| 11 | Prover Groth16 en iOS y ceremonia | L | decisión humana | humano + agente |
| — | Modo avión en el iPhone (A12) | prueba, no PR | teléfono | humano |

### PR-0 — Push de la rama del teléfono

Nueve commits de la sesión: tipo de documento, tecla Listo, dev client, emisor real de confianza,
verificación al compartir, finalidad según consentimiento, barra de navegación, fechas
`dd/mm/yyyy hh:mm`, confeti. Hacer push dispara CI, que está congelado hasta 2026-10-01. **Lo decide
el humano**: esperar al 1 de octubre o abrir el PR ahora y gastar minutos.

### PR-1 — Limpieza

- Borrar `codemagic.yaml` y documentar que el grupo `knowni-signing` de Codemagic sobra (lo borra el humano en la UI).
- Sin rastrear en la raíz: `app.json` y `.easignore` (salieron de un `eas` corrido desde la raíz), `web/animated-12.mp4`, `web/animated-38.mp4`. Preguntar al humano antes de borrar los `.mp4`.
- **Aceptación:** `git status` limpio salvo lo que el humano quiera conservar; ningún documento menciona Codemagic como camino vigente.

### PR-2 — Cavos en el dev build

La pestaña **Wallet** abre `/firma`: correo → código → cuenta Stellar → 1 XLM a sí misma en testnet.
Nunca ha corrido en un teléfono (D-85), y el #116 quitó el config plugin de Cavos, así que el
redirect `knowni://cavos-auth` puede fallar.
- **Aceptación:** el hash de la transacción en pantalla abre en el explorador de testnet y queda en `verificacion.md`.
- Si el redirect falla y exige un cambio nativo, eso gasta el último build del mes: avisar antes.

### PR-3 — Pago USDC dentro del recorrido (A10)

El emisor corre con `payments off` porque falta `KNOWNI_TREASURY_ACCOUNT` y `KNOWNI_PAYMENT_ASSET_ISSUER`.
El orden `quote → pago → issue` ya está probado en `app/test/unit/issuer-client.spec.ts`; falta
ejercerlo con la wallet de Cavos desde la pantalla de consulta.
- **Archivos:** `issuer/src/main.ts` (solo config), `app/src/domain/flow.ts`, `app/app/emision.tsx`.
- **Aceptación:** una emisión real paga el quote en USDC testnet desde el teléfono y el hash queda en `verificacion.md`; un pago rechazado muestra una de las cinco razones de P6, nunca un "error".

### PR-4 — Contraparte real: spec primero

Hoy la solicitud la crea la app (`demoRequest`) y el verificador corre en el mismo teléfono. Escribir
en `plan.md` el bloque: quién es la contraparte (página en `web/`), cómo firma su solicitud con su
propia llave, cómo viaja la respuesta de vuelta y qué es un acuse real. Criterios numerados.
- **Aceptación:** sección nueva en `plan.md` con criterios; ningún código.

### PR-5 a PR-7 — Contraparte real

5. `web/` genera una solicitud firmada con la llave de la contraparte y la muestra como QR y enlace.
6. La app la lee (cámara: `expo-camera` es nativo, gasta **un build**; el enlace `knowni://` no) y reemplaza `demoRequest`. El registro de contrapartes deja de ser el de demostración.
7. La respuesta viaja a la página de la contraparte, que corre `acceptAnswer` y devuelve un acuse firmado; `acuse.tsx` muestra ese acuse y no la hora local.
- **Aceptación global:** dos dispositivos, ninguna llave de demostración en el camino, `demo-issuer.ts` sin llamadores en producción.

### PR-8 — Agentes en la app

`attestation/src/delegation.ts` y `agent.ts` existen con pruebas (G1–G6, D-76/D-77) pero ninguna
pantalla los usa. Falta un adaptador real de revocación de delegaciones y exponerlo por HTTP.
- **Spec primero** en `plan.md`: qué ve la persona al delegar, cómo revoca, qué ve la contraparte (`presentedBy`).
- **Aceptación:** delegar, presentar como agente y revocar desde el teléfono; el replay sujeto/agente sigue rechazado.

### PR-9 — Documento de registro por HTTPS (A3)

`web/` ya es el sitio (Vercel, sin build command ni variables). El documento se firma en local con
`attestation/tools/publish-registry.ts`. Faltan `KNOWNI_APPLE_TEAM_ID` y
`KNOWNI_ANDROID_CERT_SHA256` para `apple-app-site-association` y `assetlinks.json`. `web/README.md`
tiene los pasos.

### PR-10 — Fuentes restantes (A9)

SICAAC, listas, RUNT y SIMIT con consentimiento del titular, evidencia sanitizada y fechada en
`verificacion.md`. Nunca el documento en el repositorio.

### PR-11 — Prover en iOS y ceremonia

El xcframework del prover no entra en el build de EAS (#112), así que `/prueba` dice no soportado.
Sustituir la llave de desarrollo exige ceremonia multiparte: **decisión del humano**.

## Deudas que no son PR todavía

- **Háptica:** `expo-haptics` ya está en `package.json` y `app/src/haptics.ts` calla si falta lo nativo. Sonará en el próximo build, sin cambio de código.
- **Emisor en el portátil:** si se apaga, el teléfono ve "Sin conectar". Desplegarlo pone la llave de Croma en un servidor: decisión del humano.
- **`outcome` y `session` en SHA-256:** deliberado hasta que el circuito los pida.
- **Contrato Soroban:** desplegado en testnet y verificó la prueba real (D-83); falta correrlo con una prueba generada en el teléfono.
