# Contribuir

## Workflow

1. Crear una rama desde `desarrollo` usando `tipo/descripcion-corta` (ej. `feat/login-form`, `fix/cors-error`).
2. Commitear usando [Conventional Commits](https://www.conventionalcommits.org/): `tipo(scope): descripción` (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`, ...).
3. Abrir un pull request contra `desarrollo`. Mantener los PR chicos y acotados a un solo cambio.
4. Se requiere al menos una aprobación de revisión antes de mergear.
5. Una vez mergeado, borrar la rama de la feature.

Detalle completo (modelo de branching, formato de commit): [docs/standards/git-workflow.md](docs/standards/git-workflow.md).
El mismo flujo como skill ejecutable por agentes: [skills/conventional-commit-flow.md](skills/conventional-commit-flow.md).

## Estándares

Los estándares y convenciones de código en detalle viven en `docs/standards/`. Este archivo solo
enuncia las reglas que aplican a todo el repo; cualquier cosa que requiera más profundidad
(convenciones de nombres, estrategia de testing, detalles de git workflow, guías de estilo por
stack, etc.) tiene su propio archivo bajo `docs/standards/` y se linkea desde acá a medida que se
escribe.

## Reglas de Documentación

- **Un solo README, un solo index.** `README.md` e `index.md` existen únicamente en la raíz del
  repositorio. Ninguna otra carpeta puede tener un archivo llamado `README.md` o `index.md`.
- **Las explicaciones a nivel de carpeta usan `OVERVIEW.md`.** Si el contenido de una carpeta no
  se explica solo, agregar un `OVERVIEW.md` adentro describiendo su propósito y estructura. Nunca
  duplicar `README.md` o `index.md` para esto.

## Agentes, Skills y Reglas

Este repositorio soporta desarrollo multiagente:

- **Los agentes** se definen como perfiles `.md` bajo `agents/`, un archivo por agente,
  describiendo su rol, alcance y responsabilidades.
- **Las skills** viven bajo `skills/`. Una skill solo puede agregarse si cumple las tres
  condiciones:
  1. **Justificada** — el archivo de la skill indica por qué hace falta (qué problema resuelve
     que no esté ya cubierto).
  2. **Usada** — al menos un perfil de agente bajo `agents/` la referencia.
  3. **Portable** — está escrita para poder usarse con agentes de Claude, Codex y Gemini (sin
     sintaxis específica de una herramienta, salvo que sea explícita e inevitable).
- **Las reglas** bajo `rules/` definen restricciones que los agentes deben seguir al operar en
  este repo (ej. límites de alcance, criterios de escalamiento).

## Variables de Entorno

Nunca commitear secretos reales en `.env`. Agregar las variables nuevas a `.env.example` con
valores de ejemplo cada vez que `.env` cambie.
