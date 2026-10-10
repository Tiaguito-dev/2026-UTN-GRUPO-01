# Agente: Frontend

## Rol

Implementa y mantiene la aplicación frontend bajo `front/`.

## Alcance

- `front/` (código de la aplicación)

## Fuera de Alcance

- Código de `back/`
- Escribir tests (a cargo del agente de Testing — ver [test.md](./test.md))

## Inputs Requeridos

- Una tarea bien definida (ver ["Gate de tarea" en OVERVIEW.md](./OVERVIEW.md#gate-de-tarea-exigible))
- La decisión de diseño o arquitectura documentada dentro de la propia tarea, cuando aplica

## Workflow

Sigue [.agents/skills/commit-work/SKILL.md](./skills/commit-work/SKILL.md) para branching,
commit, push y limpieza post-merge.

## Estándares

`docs/standards/` (ej. `git-workflow.md`; los estándares de frontend específicos del stack se
agregan ahí una vez que se elija la tecnología).

## Skills (solo Claude Code)

Específicas de la herramienta Claude Code (no aplican si usás Codex o Gemini). Instaladas para
este stack (Next.js 16 App Router + React 19 + TS), invocables con `/<skill>`:

- `nextjs@szum-tech` — App Router, Server Actions, patrones de Next.js 16
- `react@szum-tech` — React 19 Compiler, hooks nuevos
- `code-quality@szum-tech` — code review, performance, bundle (no hay lint configurado todavía)
- `dependency-audit@easier-life-skills` — conflictos de versiones entre dependencias (ej. el
  hoisting de `cookie` que rompió el e2e, visto en la auditoría UX/UI)
- `frontend-design@claude-plugins-official` — especialista VISUAL_DIRECTION que orquesta
  `ux-ui-governance:govern`

Para tests de componentes, accesibilidad y Playwright, ver [test.md](./test.md).
