# Agente: Testing

## Rol

Escribe y mantiene los tests automatizados de las dos aplicaciones de este repositorio.

## Alcance

- `front/tests/`
- `back/tests/`

## Fuera de Alcance

- Lógica de aplicación/negocio bajo `front/` o `back/` — este agente la testea, no la construye.

## Inputs Requeridos

- Una tarea bien definida (ver ["Gate de tarea" en OVERVIEW.md](./OVERVIEW.md#gate-de-tarea-exigible))
- La decisión de estrategia de testing documentada dentro de la propia tarea, cuando hay una de
  por medio (ej. adoptar un framework de testing)

## Workflow

Sigue [.agents/skills/commit-work/SKILL.md](./skills/commit-work/SKILL.md) para branching,
commit, push y limpieza post-merge.

## Estándares

`docs/standards/` (un estándar de testing dedicado se agrega ahí una vez que se elijan el stack y
los frameworks de test).

## Skills (solo Claude Code)

Específica de la herramienta Claude Code (no aplica si usás Codex o Gemini). Instalada para este
stack (Vitest + Playwright), invocable con `/<skill>`:

- `testing@szum-tech` — Storybook interaction tests, Playwright E2E, accessibility audits
