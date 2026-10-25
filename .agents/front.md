# Agente: Frontend

## Rol

Implementa y mantiene la aplicación frontend bajo `front/` y su descripción, `front/OVERVIEW.md`.

[front/OVERVIEW.md](../front/OVERVIEW.md) describe el front tal como es hoy: rutas, flujos y
estructura. Las reglas obligatorias viven en `docs/standards/` (ver [Estándares](#estándares-que-aplica)).
Este perfil reúne lo necesario para mantener el repo y planificar tareas nuevas sin repetir una
auditoría. No repite reglas: enlaza al estándar de cada una.

## Alcance

- `front/` (código de la aplicación)

## Fuera de Alcance

- Código de `back/`
- Escribir tests (a cargo del agente de Testing — ver [test.md](./test.md))

## Mapa del front

| Dónde | Qué vive ahí |
|---|---|
| `front/src/app/` | Rutas del App Router: páginas delgadas, `layout.tsx` con el shell y los guards por segmento. |
| `front/src/components/ui/` | Primitivas genéricas, sin dominio (`Card`, `Notice`, `PageHeader`, `PaginatedListView`, …). |
| `front/src/components/<módulo>/` | Componentes por módulo: `home/` (shell, sidebar, Inicio), `academic/`, `admin/`, `auth/`. |
| `front/src/hooks/` | Hooks compartidos: paginación por URL, datos paginados, formularios, foco, detalle por recurso. |
| `front/src/services/` | Clientes HTTP por módulo y los esquemas Zod de respuesta (`schemas.ts`). |
| `front/src/lib/` | Formatos para mostrar (`lib/format/`) y textos repetidos (`lib/messages.ts`). |
| `front/src/types/` | Tipos del dominio que comparten servicios y pantallas. |
| `front/src/validations/` | Validaciones de formularios y constructores de URLs internas. |
| `front/src/styles/` | CSS por capas: tokens, base, layout y un archivo por área de componentes. |
| `front/tests/` | Vitest (`node` y jsdom) y Playwright (`*.browser.spec.mjs`). |

Rutas, flujos y detalle de cada carpeta: [front/OVERVIEW.md](../front/OVERVIEW.md).

## Estándares que aplica

- [frontend-estilos.md](../docs/standards/frontend-estilos.md): capas, archivos por área, tokens.
- [frontend-componentes.md](../docs/standards/frontend-componentes.md): `ui/` frente a módulos,
  primitivas, `lib/`, nombres.
- [frontend-pantallas.md](../docs/standards/frontend-pantallas.md): patrones de pantalla,
  encabezado, shell, accesibilidad y el checklist de pantalla nueva.
- [frontend-tests.md](../docs/standards/frontend-tests.md): qué se prueba con qué.
- [validacion-con-zod.md](../docs/standards/validacion-con-zod.md): respuestas validadas en
  `services/schemas.ts`.
- [paginacion.md](../docs/standards/paginacion.md) y [soft-delete.md](../docs/standards/soft-delete.md):
  contratos del back que consumen los listados y detalles.
- [git-workflow.md](../docs/standards/git-workflow.md).

## Cómo revisar el estado del front

Estos comandos reemplazan a una auditoría manual. Se corren desde la raíz:

| Comando | Qué mira | Si falla |
|---|---|---|
| `npm run lint --workspace=front` | ESLint (Next `core-web-vitals`, `react-hooks`, `jsx-a11y`). Todas las reglas son error y no admite advertencias. | Se corrige la causa. Una excepción solo con `// eslint-disable-next-line <regla> -- <motivo>` y registrada en la tarea. |
| `npm run typecheck --workspace=front` | Tipos de `src/` y de `tests/`, incluidos los nombres de campo de `AltaForm`. | Se corrige el tipo; no se castea para silenciarlo. Si falla solo después de un `next build` local, ver la sección 6 de [TASK-032](../docs/tasks/finished/TASK-032-front-consistencia-y-accesibilidad.md). |
| `npm run test --workspace=front` | Servicios, validaciones, primitivas, hooks y pantallas con Vitest. | Si el comportamiento cambió a propósito, el agente de Testing actualiza el test con un comentario. Si no, es una regresión. |
| `npm run test:e2e --workspace=front` | Recorridos de cuenta y `visual.browser.spec.mjs`: capturas y axe de las pantallas principales. Solo local. | Diferencia de captura buscada: se regenera desde Linux. Violación axe: se corrige ([frontend-tests.md](../docs/standards/frontend-tests.md#playwright-capturas-y-axe)). |

CI (`.github/workflows/front.yml`) corre `typecheck`, `lint`, `test` y `build` en cada PR que toca
el front.

Lo que ningún comando cubre se busca a mano. Cada resultado es una deriva a corregir o a anotar
como tarea:

```sh
# 1. Valores sueltos que tienen token. Se permiten dentro de calc()/clamp()/min()/max()
#    y en medidas de caja (width, height, flex-basis).
rg -n '(^|[^0-9.-])(\.25|\.5|\.75|1|1\.25|1\.5|2|2\.5|3|4)rem|#[0-9a-fA-F]{3,6}\b|font-weight: *[0-9]' front/src -g '*.css' -g '!tokens.css'
# 2. Botones sin clase y estructuras de primitiva armadas a mano.
rg -nP '<button(?![^>]*className)' front/src -g '*.tsx'
rg -n 'className="(card|notice|badge|field)[" ]' front/src -g '*.tsx' -g '!components/ui/**'
# 3. Títulos fuera de PageHeader: solo se aceptan en las páginas públicas.
rg -n '<h1' front/src -g '*.tsx' -g '!components/ui/**'
```

## Cómo escribir una tarea nueva del front

- Cumple el ["Gate de tarea"](./OVERVIEW.md#gate-de-tarea-exigible): alcance, exclusiones,
  restricciones, criterios de aceptación y validaciones, con las decisiones no triviales
  documentadas en la tarea.
- Una tarea que crea o cambia una pantalla usa el
  [checklist de pantalla nueva](../docs/standards/frontend-pantallas.md#checklist-de-pantalla-nueva)
  como criterio de aceptación, y nombra los comandos de la sección anterior como validación.
- Si toca un área sensible de [AGENTS.md](../AGENTS.md#áreas-sensibles) (layout global, router,
  autenticación, hooks compartidos, estilos base, `components/ui/`), la tarea lo dice y es la
  autorización explícita, dentro de su alcance.
- Si cambia una regla (un token nuevo, una primitiva nueva, otro patrón), la tarea lo declara en
  su alcance e incluye actualizar el estándar correspondiente.

## Qué mantiene

- `front/OVERVIEW.md`, en cada tarea que cambie rutas, flujos o estructura.
- Los estándares `frontend-*.md`, solo cuando una tarea los cambia de forma explícita.
- Nunca un estándar del back.

## Pendientes conocidos

Temas que dejaron abiertos las etapas del plan de refactorización. Se resuelven en una tarea
propia:

- Normalizar los valores fuera de escala (radios, tamaños, paddings) y unificar las variantes de
  `Card`: sección 6 de [TASK-027](../docs/tasks/finished/TASK-027-front-tokens-de-diseno.md).
- CSS Modules para componentes nuevos: decisión 1 de
  [TASK-028](../docs/tasks/finished/TASK-028-front-cascada-css-controlada.md).
- `router.push` frente a `router.replace` en la paginación (que atrás recorra las páginas):
  decisión 3 de [TASK-030](../docs/tasks/finished/TASK-030-front-patrones-de-pantalla.md).
- Paquete `packages/contracts` con los esquemas Zod compartidos: sección 6 de
  [TASK-031](../docs/tasks/finished/TASK-031-contratos-front-back-academico.md).
- `/account/change-password` no recibe `Cache-Control: no-store` ni `Referrer-Policy`, porque
  `next.config.ts` solo lista `/account`; y las pantallas fuera del spec visual no se analizaron
  con axe: sección 6 de [TASK-032](../docs/tasks/finished/TASK-032-front-consistencia-y-accesibilidad.md).
- No hay formato de fecha en `lib/format/` (`UsuariosList` tiene uno local): sección 6 de
  [TASK-033](../docs/tasks/pendient/TASK-033-front-estandar-y-documentacion.md).

## Inputs Requeridos

- Una tarea bien definida (ver ["Gate de tarea" en OVERVIEW.md](./OVERVIEW.md#gate-de-tarea-exigible))
- La decisión de diseño o arquitectura documentada dentro de la propia tarea, cuando aplica

## Workflow

Sigue [.agents/skills/commit-work/SKILL.md](./skills/commit-work/SKILL.md) para branching,
commit, push y limpieza post-merge.

## Skills (solo Claude Code)

Específicas de la herramienta Claude Code (no aplican si usás Codex o Gemini). Instaladas para
este stack (Next.js 16 App Router + React 19 + TS), invocables con `/<skill>`:

- `nextjs@szum-tech` — App Router, Server Actions, patrones de Next.js 16
- `react@szum-tech` — React 19 Compiler, hooks nuevos
- `code-quality@szum-tech` — code review, performance, bundle
- `dependency-audit@easier-life-skills` — conflictos de versiones entre dependencias (ej. el
  hoisting de `cookie` que rompió el e2e, visto en la auditoría UX/UI)
- `frontend-design@claude-plugins-official` — especialista VISUAL_DIRECTION que orquesta
  `ux-ui-governance:govern`

Para tests de componentes, accesibilidad y Playwright, ver [test.md](./test.md).
