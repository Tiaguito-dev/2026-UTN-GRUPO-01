# Índice del Repositorio

Mapa de navegación de este repositorio. Se mantiene separado de `README.md` para que el README
se enfoque en presentar el proyecto.

## Raíz

| Ruta | Propósito |
|---|---|
| `README.md` | Presentación del proyecto y punto de entrada. |
| `index.md` | Este archivo — mapa de navegación del repositorio. |
| `CONTRIBUTING.md` | Workflow de contribución y estándares. |
| `TEAM_CHARTER.md` | Roles del equipo y acuerdos de trabajo. |
| `.gitignore` | Rutas ignoradas por Git. |
| `.dockerignore` | Exclusiones del contexto de build de Docker. |
| `.env` / `.env.example` | Variables de entorno locales y su plantilla. |

## Carpetas

| Carpeta | Propósito |
|---|---|
| `docs/` | Documentación del proyecto (lean documentation — ver README). |
| `docs/standards/` | Estándares y convenciones de código, referenciados desde `CONTRIBUTING.md` (ej. `git-workflow.md`). |
| `docs/tdd/` | Documentación de diseño técnico (*Technical Design Documentation*, no test-driven development). Ver [docs/tdd/OVERVIEW.md](docs/tdd/OVERVIEW.md). |
| `front/` | Aplicación frontend (tecnología a definir). |
| `front/tests/` | Tests de frontend, a cargo del agente de Testing. |
| `back/` | Aplicación backend (tecnología a definir). |
| `back/tests/` | Tests de backend, a cargo del agente de Testing. |
| `agents/` | Perfiles de agentes de IA (`.md`): `back`, `front`, `test`. Ver [agents/OVERVIEW.md](agents/OVERVIEW.md) para la metodología de delegación. |
| `skills/` | Definiciones de skills usables por los agentes, compatibles con Claude, Codex y Gemini. |
| `rules/` | Reglas del proyecto que los agentes deben seguir al operar en este repo. |

## Documentación a nivel de carpeta

Una carpeta lo suficientemente compleja como para necesitar explicación lleva un archivo
`OVERVIEW.md` adentro — nunca otro `README.md` o `index.md`. Ver
[CONTRIBUTING.md](./CONTRIBUTING.md#reglas-de-documentación).
