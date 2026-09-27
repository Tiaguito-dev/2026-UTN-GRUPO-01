# Historial de Cambios

## [Sin publicar]

### Agregado

- Monorepo npm con Node.js 22.22.3 y TypeScript 6.
- Backend NestJS con Prisma ORM, PostgreSQL, endpoint de salud y prueba automatizada.
- Frontend Next.js con App Router y pantalla inicial.
- PostgreSQL local mediante Docker Compose con volumen y healthcheck.
- Flujo SDD, tareas documentadas y reglas operativas en `AGENTS.md`.
- Arquitectura de despliegue en la nube en `docs/tdd/TDD-INFRA-CLOUD-H1.md` (Vercel, Render y Neon).
- Tarea de investigación para autenticación institucional en `docs/tasks/pendient/TASK-004-investigar-autenticacion-institucional.md`.
- Variables de entorno para producción en `.env.example` y sección de infraestructura en `README.md`.

### Seguridad

- Prisma usa el adapter JavaScript `pg` sin motor binario nativo.
- `deepmerge-ts` se fija en 8.0.2 mediante `overrides`.
