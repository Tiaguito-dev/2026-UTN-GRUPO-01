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

### Entrega acumulada de autenticación y Docker

`desarrollo` es una rama protegida y recibe los cambios mediante PR. Para esta entrega,
el desarrollador solicitó la rama `feature/auth`, con commits atómicos en español.

1. Acumular los commits relacionados en `feature/auth`, separados por responsabilidad.
2. El desarrollador realiza el push de esa rama; no lo ejecuta el agente.
3. El desarrollador abre una única PR de `feature/auth` hacia `desarrollo`, con todos los commits.
4. La integración posterior de `desarrollo` hacia `main` es una entrega independiente.

No crear commits directamente en `desarrollo` ni hacer push directo a ramas protegidas.
Una PR puede incluir varios commits atómicos; no se necesita una por cada cambio.

### Ramas de feature (flujo general)

1. Crear la rama desde `desarrollo` usando la convención de nombres de arriba.
2. Commitear usando Conventional Commits.
3. Pushear la rama.
4. Abrir un pull request contra `desarrollo` (paso manual, no automatizado por agentes).
5. Una vez aprobado y mergeado, borrar la rama de la feature para mantener el repo limpio.

Ver [.agents/skills/commit-work/SKILL.md](../../.agents/skills/commit-work/SKILL.md) para la
versión de este flujo ejecutable por agentes.
