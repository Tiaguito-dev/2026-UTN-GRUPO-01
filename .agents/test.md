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

`docs/standards/`. Para el front:
[frontend-tests.md](../docs/standards/frontend-tests.md).

## Estrategia de testing del frontend

Decidida en `docs/tasks/` (TASK-023):

- **Vitest, entorno `node`** para servicios y markup estático (`renderToStaticMarkup`). Es el
  entorno por defecto de `front/tests/vitest.config.mjs`.
- **Vitest + jsdom + Testing Library** para interacción: foco, clics, teclado y efectos. Cada spec
  `.spec.tsx` declara `// @vitest-environment jsdom` en la primera línea; el entorno global no
  cambia. Se mockean los servicios, `next/navigation` y `next/link`
  (`front/tests/support/next-link.tsx`), y cada archivo llama a `afterEach(cleanup)`.
- **Tests de caracterización** antes de refactorizar: describen lo que el código hace hoy. Un
  comportamiento dudoso se fija tal como está, con un comentario, y se corrige en otra tarea.
- **Playwright** (`*.browser.spec.mjs`) para recorridos reales contra el harness, con Postgres y
  Mailpit. Corre solo en local. `visual.browser.spec.mjs` guarda capturas de referencia
  versionadas, que se regeneran solo desde Linux con el Google Chrome del sistema, y falla ante violaciones axe
  `serious` o `critical` que no estén listadas como conocidas.

## Skills (solo Claude Code)

Específica de la herramienta Claude Code (no aplica si usás Codex o Gemini). Instalada para este
stack (Vitest + Playwright), invocable con `/<skill>`:

- `testing@szum-tech` — Storybook interaction tests, Playwright E2E, accessibility audits
