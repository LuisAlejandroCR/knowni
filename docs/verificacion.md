<!-- docs/verificacion.md
     Qué está comprobado, contra qué fuente y en qué fecha; qué sigue sin
     comprobar; y la deuda conocida. Se distingue de memoria.md, que guarda
     decisiones y su razón, y de plan.md, que guarda criterios de aceptación. -->

# Verificación

Tres cosas distintas y se marcan como tales: **verificado en fuente primaria** · **repetido por una
fuente secundaria** · **supuesto propio**. Sin verificar → `⏳ pendiente`.

## Verificado en este repositorio

| Qué | Cómo | Fecha |
|---|---|---|
| 116 pruebas pasan | `npm test` con Node 22.22.2 | 2026-09-20 |
| Nada en `core/` conoce un tipo de contrato; siete perfiles distintos responden con las mismas credenciales | `core/test/session.test.ts` · `core/test/disclosure.invariant.test.ts` | 2026-09-20 |
| El sobre no filtra ningún valor de los reclamos | `core/test/disclosure.invariant.test.ts` | 2026-09-20 |
| `core/` no importa ningún SDK ni declara dependencias | `core/test/no-vendor-imports.test.ts` | 2026-09-20 |
| La misma verificación ancla en dos cadenas sin cambiar nada por encima del registro | `anchoring/test/registry.test.ts` | 2026-09-20 |
| Node 22 ejecuta TypeScript sin paso de compilación; `enum` no, `const` sí | ejecutado | 2026-09-20 |

## Verificado en otra parte, no aquí

| Qué | Fuente | Fecha original | Estado aquí |
|---|---|---|---|
| Rutas `/co/*`, envoltorio `{data}`, jobs `202`, `502` de Rama Judicial, cabeceras de rate limit | [`Digentia`](https://github.com/LuisAlejandroCR/Digentia), comentarios de `src/infra/croma-client.ts` y `src/blocks/*` | 2026-08-11 | **Repetido, no re-verificado.** `docs.usecroma.com` está bloqueado por el proxy de esta sesión, y `Digentia` además está sin terminar |
| URL base `https://api.croma.run` y la convención `/{país}/{fuente}/{recurso}/v1` | [`creva_score`](https://github.com/LuisAlejandroCR/creva_score) (`src/config/env.ts`, `src/modules/*/providers/*.types.ts`) **y** `Digentia`, independientemente | 2026-08 | **Dos fuentes que coinciden**, con países distintos (`/mx/*` y `/co/*`). Es lo más cerca de verificado que se puede estar sin llamar |
| `creva_score` fue la hackathon de Croma (IA Hackathon GovTech, 12–16 ago 2026); `Digentia` es un producto sin terminar | El usuario, y el pie del `README.md` de `creva_score` | 2026-09-20 | **Verificado.** Corrige la atribución de la sesión anterior |
| Croma cubre Colombia, Perú y México; 119 endpoints sobre 43 fuentes oficiales; servidor MCP; Banco Finandina e Incomercio en producción | Búsqueda web sobre `usecroma.com` | 2026-09-20 | **Fuente secundaria.** Confirmar contra la documentación |
| Stellar verifica Groth16 sobre BLS12-381 nativamente (CAP-0059, Protocolo 22+); BN254 bloqueado en CAP-0074 | `Stellar-dev-skill/skill/zk-proofs.md` en [`Gabrululu/Stellar-Build-PE`](https://github.com/Gabrululu/Stellar-Build-PE) | 2026-09 | **Repetido.** Confirmar contra el CAP antes de comprometer la curva |
| ~23,7 s por prueba de *backing* sobre Midnight, en escritorio | `creva-zk`, `tools/PROOF-LATENCY.md` | 2026-08 | **Medido en otro proyecto.** No comparable con móvil; citado solo como referencia de que esto se mide |

| El catálogo de Colombia de Croma: qué fuentes existen y cuáles no | El propio catálogo de Croma, aportado por el usuario | 2026-09-20 | **Verificado.** PILA y SNR no están; ADRES, RUNT, SIMIT y Sisbén sí |

## Pendiente de verificar

1. **`CROMA_API_KEY`** — sin key no hay ninguna llamada en vivo. Bloquea B2 y el criterio A10.
2. **Ruta y forma de respuesta de ADRES Health Affiliation Status.** Está en el catálogo; su ruta
   no aparece en `Digentia` ni en `creva_score`, así que no se supone. De ella depende si
   `formality` distingue cotizante de beneficiario, que es lo que hace funcionar la regla de D-12.
3. **Rutas de RUNT y SIMIT.** Verificadas en `Digentia`; re-confirmar antes de depender.
4. **Cobertura de PILA por tipo de trabajador**, antes de dejar que `formality` influya en nada.
   Es el requisito de D-11 y no está medido.
5. **Parámetros de Poseidon para BLS12-381.** El único riesgo que puede cambiar la arquitectura.
6. **Tiempo de prueba en un teléfono real.** Ninguna cifra hasta que exista.
7. **Fecha y rúbrica del hackathon.**

## Deuda conocida

| Deuda | Dónde | Bloque |
|---|---|---|
| `retrieval/` está construido sobre la lectura de Chroma. El adaptador, el puerto y el índice sobran; la normalización y la política de resolución se quedan | `retrieval/` | B3 |
| Los tests están planos (`*/test/*.test.ts`); la constitución pide `test/unit · fuzz · invariant` con sufijo `.spec.ts` | todos los workspaces | ⏳ sin bloque |
| Las cabeceras de código tienen 10–30 líneas con narrativa; la constitución pide 2–3 líneas sin justificaciones. El razonamiento va a `memoria.md` | todos los `.ts` | ⏳ sin bloque |
| `sources/src/colombia/pila.ts` habla de un operador que todavía no existe como integración | `sources/` | B4 |
| El código sigue llamando `standing` a lo que la documentación ya llama `sanctions` (`StandingClaim`, `proveStanding`, el campo del sobre). El renombrado va con B2 | `core/`, `sources/`, `journey/` | B2 |
| `IncomeBasis` no tiene el eje de procedencia `observed \| documentary \| self_declared` de `creva_score` | `core/src/claims.ts` | B4b |
| Los dos commits iniciales llevan cuerpo y trailer `Co-Authored-By:`, contra la regla de una línea | historia de git | no se reescribe historia; la regla aplica desde el tercero |

## Afirmaciones que este repositorio **no** hace

- Ningún tiempo de prueba, conteo de restricciones ni fee medido.
- Ninguna prueba verificada on-chain.
- Ninguna integración real con Croma, Registraduría, PILA o DataCrédito.
- Ninguna ejecución en un dispositivo físico.
- Ninguna afirmación de cumplimiento normativo. `COLOMBIA.md` describe el marco; no es asesoría
  legal ni un concepto.
