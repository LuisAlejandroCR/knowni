<!-- CLAUDE.md
     Lo único propio de Claude Code en este repositorio: arranque de sesión,
     ciclo SDD y estilo de salida. El contrato completo — misión, exclusiones,
     stack, idioma y reglas de commit — vive en AGENTS.md y manda sobre este archivo. -->

# CLAUDE.md — Knowni

> **Leer [`AGENTS.md`](AGENTS.md) primero.** Es la constitución y contiene todo el contrato:
> misión, contexto, exclusiones no negociables, variables de entorno, stack, idioma, reglas de
> commit y herencia. Este archivo no repite nada de eso; solo añade lo que es propio de Claude Code.

## Arranque de sesión (obligatorio)

```text
AGENTS.md
CLAUDE.md
docs/memoria.md
docs/verificacion.md
git status
```

Después de `/compact` o `/new`: re-leer este archivo, `AGENTS.md` y `docs/memoria.md`.
No asumir el estado de un archivo sin leerlo.

## Ciclo SDD

| Paso | Dónde vive |
|---|---|
| Specify (qué + criterios de aceptación) | `docs/plan.md` |
| Plan (cómo: enfoque técnico, archivos, datos) | `docs/memoria.md` |
| Tasks (pasos pequeños y verificables) | `docs/plan.md` → *Bloques* |
| Implement | código |
| Verify | tests + lint + typecheck + ejercicio real; bitácora en `docs/memoria.md` |

## Output style: ADHD mode (activo por defecto)

*(Fuente: [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd))*

Liderar con la respuesta o próxima acción · numerar el trabajo multi-paso · cerrar con una acción
de menos de dos minutos · máximo 5 ítems por lista · errores con ubicación, causa y arreglo, sin drama.
Excepciones: explicar a fondo cuando se pide una explicación; confirmar antes de acciones destructivas;
tras tres intentos fallidos, parar y nombrar el supuesto dudoso.

## Referencias

- Constitución → [`AGENTS.md`](AGENTS.md)
- Plan y criterios de aceptación → [`docs/plan.md`](docs/plan.md)
- Enfoque técnico y bitácora → [`docs/memoria.md`](docs/memoria.md)
- Datos verificados y pendientes → [`docs/verificacion.md`](docs/verificacion.md)
- Docs de librerías → <https://context7.com/>
- Docs de Croma → <https://docs.usecroma.com>
- Aprendizajes de este proyecto → [`LEARNINGS.md`](LEARNINGS.md)

