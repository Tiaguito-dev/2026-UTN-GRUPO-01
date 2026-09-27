# TASK-003: Revisar y sanear la PR de formalización del stack inicial

Estado: Finalizada
Fecha: 2026-09-27
TDD: [TDD-STACK-H1](../../tdd/TDD-STACK-H1.md)

## Objetivo

Revisar el contenido de la PR #3 (scaffold inicial del monorepo: NestJS, Next.js, Prisma, Docker
Compose) contra las convenciones ya vigentes en `desarrollo`, resolver las inconsistencias
encontradas, aprobar y mergear la PR, y dejar `desarrollo` sincronizado con el resultado.

## Alcance completado

- Recorte de `AGENTS.md` (263 a ~40 líneas): se sacaron las convenciones funcionales, de
  arquitectura, seguridad y UX que fijaba sin ningún TDD que las respalde.
- Fusión de `rules/task-intake.md` dentro de `agents/OVERVIEW.md` (sección "Gate de tarea"),
  eliminando la duplicación del mismo gate en dos archivos que podían desincronizarse.
- Corrección de las referencias a `.agents/skills/` que habían quedado apuntando al path viejo
  `skills/` tras el rename de la PR (`index.md`, `CONTRIBUTING.md`, perfiles personales bajo
  `.claude/agents/`).
- Ajuste de `docs/tdd/TDD-STACK-H1.md` para cumplir `docs/tdd/template.md`: escenario de falla
  agregado en 1.3, columna `Código HTTP` restaurada en la tabla de errores con `N/A` justificado
  donde no aplica.
- Aprobación (con comentario no bloqueante) y merge de la PR #3 a `main`.
- Sincronización de `desarrollo` con `main` (PR #4): ambas ramas habían mergeado el mismo scaffold
  inicial por separado y habían divergido en el grafo de commits sin diferencia real de contenido.
- Aplicación de los ajustes de documentación sobre `desarrollo` ya sincronizado (PR #5).
- Fusión de `.agents/skills/conventional-commit-flow.md` dentro de
  `.agents/skills/commit-work/SKILL.md` como una sola checklist secuencial (rama → commit → push →
  PR → merge), eliminando el archivo duplicado y actualizando todas sus referencias (PR #6).

## Fuera de alcance

- `TEAM_CHARTER.md`: quedan sin definir la cadencia de reuniones y el Definition of Done — es una
  decisión de equipo, no una corrección técnica.
- Llevar los commits de las PR #5 y #6 de `desarrollo` a `main`: `main` exige una aprobación de
  revisión que no puede ser propia (GitHub no permite autoaprobar). Queda para una PR aparte.

## Validaciones

- [x] PR #3 aprobada y mergeada a `main` (squash).
- [x] `desarrollo` sincronizado con `main`, árbol verificado idéntico tras el merge (PR #4).
- [x] Ajustes de documentación aplicados sobre `desarrollo` sin conflictos vía cherry-pick (PR #5).
- [x] `rules/task-intake.md` y `skills/` (path viejo) confirmados eliminados.
- [x] Fusión de skills de commit verificada sin referencias rotas en todo el repo.

## Resultado

`main` quedó con el scaffold inicial completo, revisado y aprobado. `desarrollo` quedó
sincronizado con `main` más las correcciones de documentación surgidas de la revisión. La
diferencia pendiente entre ambas ramas (las correcciones de las PR #5 y #6) se entrega en una PR
separada hacia `main`, a la espera de aprobación de otro integrante del equipo.
