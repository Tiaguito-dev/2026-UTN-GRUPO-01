# Validación de Entrada con Zod

Estándar para módulos nuevos del backend (`academic` en adelante). No es retroactivo — `auth`
sigue validando a mano (regex, ifs) por ahora; migrarlo es deuda técnica registrada en Trello
(tablero `2026-UTN-Cloud`, lista Backlog), no una tarea activa.

## Regla

Todo input externo (body, params, query) que un módulo nuevo necesite validar se declara como un
esquema Zod, no con validación manual. Esto incluye formato de UUID en parámetros de ruta y
parámetros de paginación en query string, además de los bodies de escritura que aparezcan a
futuro (alta/edición en HU-11).

## Cómo

Una función `validateX(value: unknown): X` que hace `schema.safeParse(value)` y, si falla, tira
el error de dominio correspondiente (ver `docs/standards/catalogo-de-errores.md`) — nunca deja
pasar el error nativo de Zod hacia afuera.

```ts
import { z } from "zod";
import { InvalidIdError } from "./errors.js";

const idSchema = z.string().uuid();

export function validateId(value: unknown): string {
  const result = idSchema.safeParse(value);
  if (!result.success) throw new InvalidIdError();
  return result.data;
}
```

Importante: `z.string().uuid()` usa un regex anclado (`^...$`) — rechaza correctamente intentos
de spoofing como un UUID válido con texto pegado antes o después. Verificado con test explícito,
no asumido.

## Dónde vive

Al lado de lo que valida, en `application/` (no en `domain/` — ver
`docs/standards/arquitectura-de-capas.md`, `domain/` no importa nada, ni siquiera Zod).

## Por qué no se migró `auth`

Ya funciona, está testeado (277+ tests), y migrarlo es puro refactor sin capacidad nueva — el
riesgo de re-testear un módulo estable para ganar solo consistencia estilística no se justifica
todavía. Se revisita cuando alguien ya esté tocando esos archivos por otro motivo.

## Referencia

`back/src/academic/application/academic-id.ts`, `back/src/shared/domain/pagination-input.ts`.
