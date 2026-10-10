# Arquitectura de Capas (Clean Architecture)

Estándar para módulos nuevos del backend. `auth` usa una variante más laxa (puertos dentro de
`domain/`) y no se reestructura retroactivamente — es deuda técnica registrada en Trello, no una
tarea activa.

## Regla

`domain/` contiene únicamente entidades puras: clases o tipos que **no importan nada**, ni
siquiera entre sí. Si un archivo necesita importar algo (otra entidad, una librería, un tipo
compartido), no es dominio puro — va en `application/`.

## Por qué no junto con `domain/`, como hace `auth`

En Clean Architecture, los puertos (interfaces de repositorio) los define la capa de casos de
uso, no el dominio — es la capa que los *necesita* la que declara el contrato (Inversión de
Dependencias), y esa capa es `application/`, no `domain/`. Poner los puertos en `domain/` (como
hace `auth`) funciona, pero mezcla dos responsabilidades en la misma carpeta: la entidad pura y
el contrato que otra capa necesita de ella.

## Estructura

```
<modulo>/
  domain/                 Entidades puras — cero imports.
  application/
    ports/                 Interfaces de repositorio (*.repository.ts). Importan entidades
                           de domain/ y tipos compartidos (ej. paginación).
    errors.ts              Errores de dominio (ver docs/standards/catalogo-de-errores.md).
    <validadores>.ts        Validación de input (ver docs/standards/validacion-con-zod.md).
    <caso-de-uso>.ts        Un archivo por caso de uso, clase con `execute()`.
  infrastructure/          Adaptadores concretos (Prisma, etc.) que implementan los puertos.
  <modulo>.controller.ts
  <modulo>.module.ts
```

## Punto de verificación

```sh
grep -l "^import" back/src/<modulo>/domain/*.ts
```

No debería devolver ningún archivo. Si devuelve alguno, ese archivo no es dominio puro y hay que
moverlo a `application/`.

## Referencia

`back/src/academic/` completo. Ver
`docs/tasks/pendient/TASK-014-academic-etapa-1-jerarquia.md` sección 3 para el detalle de cómo
se migraron los puertos desde `domain/` hacia `application/ports/` en este mismo módulo.
