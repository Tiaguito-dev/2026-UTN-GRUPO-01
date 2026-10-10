# Índice del Repositorio

Mapa de navegación de este repositorio. Se mantiene separado de `README.md` para que el README
se enfoque en presentar el proyecto.

## Raíz

| Ruta | Propósito |
|---|---|
| `README.md` | Presentación del proyecto y punto de entrada. |
| `index.md` | Este archivo — mapa de navegación del repositorio. |
| `AGENTS.md` | Reglas operativas obligatorias para agentes. |
| `CONTRIBUTING.md` | Workflow de contribución y estándares. |
| `TEAM_CHARTER.md` | Roles del equipo y acuerdos de trabajo. |
| `CHANGELOG.md` | Historial de tareas finalizadas. |
| `package.json` / `package-lock.json` | Workspaces, scripts y dependencias reproducibles. |
| `docker-compose.yml` | Stack productivo: PostgreSQL interno, migraciones, backend, frontend y proxy HTTPS. |
| `docker-compose.dev.yml` | Stack de desarrollo: HTTP local, puertos en loopback y Mailpit opcional. |
| `.nvmrc` | Versión de Node.js acordada. |
| `.gitignore` | Rutas ignoradas por Git. |
| `.dockerignore` | Exclusiones del contexto de build de Docker. |
| `.env` / `.env.example` | Variables de entorno locales y su plantilla. |

## Carpetas

| Carpeta | Propósito |
|---|---|
| `docs/` | Documentación del proyecto (lean documentation — ver README). |
| `docs/standards/` | Estándares y convenciones de código, referenciados desde `CONTRIBUTING.md` (ej. `git-workflow.md`). |
| `docs/tasks/` | Tareas autocontenidas organizadas por estado. |
| `front/` | Aplicación frontend TypeScript con Next.js y React. |
| `front/tests/` | Tests de frontend, a cargo del agente de Testing. |
| `back/` | API TypeScript con NestJS, Prisma ORM y PostgreSQL. |
| `back/tests/` | Tests de backend, a cargo del agente de Testing. |
| `infra/` | Proxy Nginx y [comandos Docker](infra/OVERVIEW.md) por entorno. |
| `docs/tasks/finished/` | Autenticación, Docker y UX aceptados por el desarrollador; evidencia y límites de cada etapa. |
| `.agents/` | Perfiles de agentes de IA (`.md`): `back`, `front`, `test`. Ver [.agents/OVERVIEW.md](.agents/OVERVIEW.md) para la metodología de delegación. |
| `.agents/skills/` | Definiciones de skills usables por los agentes, compatibles con Claude, Codex y Gemini. |

## Documentación a nivel de carpeta

Una carpeta lo suficientemente compleja como para necesitar explicación lleva un archivo
`OVERVIEW.md` adentro — nunca otro `README.md` o `index.md`. Ver
[CONTRIBUTING.md](./CONTRIBUTING.md#reglas-de-documentación).
