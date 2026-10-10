# AGENTS.md

Guía operativa mínima para cualquier agente (Claude, Codex, Gemini u otro) que trabaje en este
repositorio. No reemplaza [.agents/OVERVIEW.md](./.agents/OVERVIEW.md); es el punto de entrada que
las herramientas leen automáticamente.

## Stack oficial

- Lenguaje: TypeScript.
- Runtime: Node.js 22.22.3, fijado en `.nvmrc` y `package.json`.
- Gestión de paquetes: npm workspaces con un único `package-lock.json`.
- Backend: NestJS.
- Frontend: Next.js (App Router) + React.
- Persistencia: PostgreSQL con Prisma ORM y adapter `pg`.
- Infra local: Docker Compose.

No se incorpora tecnología o dependencia nueva sin una tarea que la justifique.

## Cómo trabajar acá

1. Metodología, roles (`back`/`front`/`test`) y el gate de tarea + TDD antes de implementar:
   ver [.agents/OVERVIEW.md](./.agents/OVERVIEW.md).
2. Commits, branching, push, PR y merge: seguir la skill
   [.agents/skills/commit-work/SKILL.md](./.agents/skills/commit-work/SKILL.md).
3. Nunca push directo a rama protegida ni PR sin instrucción explícita del desarrollador.
4. Registrar en `CHANGELOG.md` al cerrar una tarea.

## Documentación

- `README.md` (raíz), `index.md` (mapa), `OVERVIEW.md` por carpeta. No se crean otros
  `README.md`/`index.md` fuera de la raíz, salvo paquetes de skills autocontenidos.
- Decisiones de diseño no triviales se documentan dentro de la propia tarea (`docs/tasks/`) antes
  de implementarse.

## Áreas sensibles

No se toca sin autorización explícita: layout global, router principal, autenticación, hooks
compartidos, estilos base, componentes reutilizables globales. Antes de una acción destructiva o
externa, el agente explica qué hará y espera aprobación.

## Pendiente de definición

Convenciones funcionales (paginación, navegación post-guardado), arquitectura de módulos,
seguridad por rol y UX detalladas no están codificadas acá: se definen dentro de la tarea
concreta que las necesite (ver "Estándares" en [.agents/back.md](./.agents/back.md) /
[front.md](./.agents/front.md)).
