# Paginación

Estándar transversal para cualquier listado nuevo del backend, en cualquier módulo.

## Regla

Ningún listado devuelve un array sin paginar. Todo endpoint de listado recibe `page`/`pageSize`
por query string, valida con Zod (ver `docs/standards/validacion-con-zod.md`) y devuelve la
forma compartida `PaginatedResult<T>`.

## Tipos compartidos

`back/src/shared/domain/pagination.ts`:

```ts
export interface Pagination { page: number; pageSize: number; }
export interface PaginatedResult<T> { items: T[]; total: number; page: number; pageSize: number; }
```

`back/src/shared/domain/pagination-input.ts` — `validatePagination(value: unknown): Pagination`.
Defaults: `page=1`, `pageSize=20`. Límites: `page >= 1`, `1 <= pageSize <= 100`. Tira
`InvalidPaginationError` (`shared/domain/errors.ts`) si no cumple.

## En el adaptador de infraestructura

Dos queries en paralelo, no una — Prisma no devuelve el total junto con los resultados:

```ts
const [items, total] = await Promise.all([
  this.prisma.materia.findMany({ where, skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize }),
  this.prisma.materia.count({ where }),
]);
return { items, total, page: pagination.page, pageSize: pagination.pageSize };
```

El mismo `where` (incluyendo `deletedAt: null`, ver `docs/standards/soft-delete.md`) se usa para
ambas queries — si no, el `total` no coincide con lo que realmente se puede listar.

## Por qué el límite de `pageSize`

Sin un máximo, cualquier cliente puede pedir una página de tamaño arbitrario y forzar un listado
completo igual que si no hubiera paginación. 100 es el límite elegido para este proyecto — se
puede ajustar si un caso de uso real lo justifica, pero nunca se quita el límite.

## Referencia

`back/src/academic/infrastructure/prisma-materia.repository.ts` y hermanos.
