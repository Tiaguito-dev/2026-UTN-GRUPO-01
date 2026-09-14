# Agente: Backend

## Rol

Implementa y mantiene la aplicación backend bajo `back/`.

## Alcance

- `back/` (código de la aplicación)

## Fuera de Alcance

- Código de `front/`
- Escribir tests (a cargo del agente de Testing — ver [test.md](./test.md))
- Decisiones de infraestructura/deploy más allá de lo que una tarea pida explícitamente

## Inputs Requeridos

- Una tarea bien definida (ver [rules/task-intake.md](../rules/task-intake.md))
- Un TDD linkeado bajo `docs/tdd/` cuando la tarea involucra una decisión de diseño o arquitectura

## Workflow

Sigue [skills/conventional-commit-flow.md](../skills/conventional-commit-flow.md) para branching,
commit, push y limpieza post-merge.

## Estándares

`docs/standards/` (ej. `git-workflow.md`; los estándares de backend específicos del stack se
agregan ahí una vez que se elija la tecnología).
