# Git Workflow

## Mensajes de Commit

Este proyecto sigue [Conventional Commits](https://www.conventionalcommits.org/):

```
tipo(scope): descripción
```

Tipos comunes: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`, `perf`, `ci`, `build`.

## Modelo de Branching

- `desarrollo` es la rama de integración. Todas las ramas de feature se crean desde ahí, y todos
  los pull requests apuntan ahí.
- `main` queda reservada para código listo para producción, mergeado desde `desarrollo`.
- Los nombres de rama replican el tipo de conventional commit: `tipo/descripcion-corta` (ej.
  `feat/login-form`, `fix/cors-error`).

## Flujo

1. Crear la rama desde `desarrollo` usando la convención de nombres de arriba.
2. Commitear usando Conventional Commits.
3. Pushear la rama.
4. Abrir un pull request contra `desarrollo` (paso manual, no automatizado por agentes).
5. Una vez aprobado y mergeado, borrar la rama de la feature para mantener el repo limpio.

Ver [skills/conventional-commit-flow.md](../../skills/conventional-commit-flow.md) para la
versión de este flujo ejecutable por agentes.
