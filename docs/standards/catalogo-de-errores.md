# Catálogo de Errores

Estándar transversal — aplica a todos los módulos del backend, nuevos y existentes (`auth` ya
migrado el 2026-10-10).

## Regla

Ningún controlador tiene un `try/catch` cuyo único propósito sea convertir una excepción en una
respuesta HTTP. Las excepciones de dominio se declaran por módulo, extendiendo la base común, y
un único filtro global las traduce.

## Cómo

1. Cada clase de error extiende `DomainError` (`back/src/shared/domain/domain-error.ts`) y fija
   su propio `httpStatus`:

   ```ts
   import { DomainError } from "../../shared/domain/domain-error.js";

   export class MateriaNotFoundError extends DomainError {
     readonly httpStatus = 404;
     constructor() { super("La materia solicitada no existe."); this.name = "MateriaNotFoundError"; }
   }
   ```

2. El caso de uso lanza la excepción. El controlador no la captura — la deja propagar.
3. `back/src/shared/presentation/unhandled-error.filter.ts` (`UnhandledErrorFilter`, `@Catch()`
   sin tipo) es el **único** filtro global registrado para esto. Se registra una sola vez, desde
   `back/src/shared/shared.module.ts`, importado por cada módulo que lo necesita. Decide en
   código, de forma explícita, qué hacer con cada tipo de excepción:
   - `DomainError` → responde con su `httpStatus` y su `message`.
   - `BadRequestException` → delega a `RegistrationBadRequestFilter` (enmascara errores de
     parseo de JSON malformado antes del controlador).
   - Cualquier otro `HttpException` (ej. lanzado por un guard) → se deja pasar sin tocar.
   - Cualquier otra cosa (no modelada) → 500 genérico, logueado server-side con el detalle real,
     nunca expuesto en la respuesta.

## Por qué un solo filtro, no uno por excepción

Nest no garantiza que, entre dos filtros globales registrados por separado (`@Catch(TipoA)` y
`@Catch()` sin tipo), el más específico gane. Se probó en código: un `@Catch()` genérico
interceptó un `BadRequestException` antes que el filtro específico que lo esperaba, salteando su
lógica de enmascarado. La única forma de que esto no dependa del orden de resolución de Nest es
que **una sola función de un solo filtro decida todo explícitamente**. Nunca registrar un
segundo `APP_FILTER` que pueda matchear el mismo tipo de excepción que otro ya registrado.

## Qué no hacer

- No envolver una excepción de dominio en una `HttpException` de Nest desde el controlador
  (`throw new BadRequestException(error.message)`). Eso es exactamente el `try/catch` que este
  patrón reemplaza.
- No registrar un segundo filtro global para un tipo de excepción que ya cubre otro filtro
  global.

## Referencia

Implementación de referencia: `back/src/academic/` (primer módulo construido con este patrón
desde el día uno) y `back/src/auth/` (migrado después, ver
`docs/tasks/in-progress/TASK-014-academic-etapa-1-jerarquia.md` sección 4 para el detalle de la
migración y los dos bugs reales que aparecieron al hacerla).
