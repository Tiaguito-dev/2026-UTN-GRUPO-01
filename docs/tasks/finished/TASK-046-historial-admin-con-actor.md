# TASK-046: Historial de materia solo para ADMIN y con el nombre del actor (D3 de TASK-037, parte back)

Estado: Completada.
Depende de TASK-045 (desplegada en Vercel). Independiente de TASK-039 a TASK-043.
Fecha: 2026-10-25

## Objetivo

`GET /materias/:materiaId/historial` pasa a exigir ADMIN y cada entrada trae
`actor: { id, displayName }`. El detalle de materia muestra el nombre en lugar del id.

## Contexto verificado (2026-10-25)

- `back/src/academic/academic.controller.ts` L54: `@Get("materias/:materiaId/historial")` sin `@Roles`.
  Las altas usan `@Roles("ADMIN")`. `RolesGuard` responde 403 si el rol no coincide.
- `back/src/academic/infrastructure/prisma-materia.repository.ts` L92-101: `findHistorial` ordena por
  `createdAt` y `id` descendentes, sin `include`.
- `back/src/academic/domain/materia.ts`: `MateriaHistorial {id, materiaId, actorId, createdAt, cambios}`.
- `back/tests/admin.integration.spec.ts`: L283 y L311-318 leen `/historial` con `userCookie`
  (usuario común), así que se rompen con este cambio.
- `front/src/services/schemas.ts`: `materiaHistorialSchema` con `actorId`. `MateriaDetail.tsx`
  muestra "Usuario: {entry.actorId}". El tipo vive en `front/src/types/materias.ts`.

## Decisiones

- `include: { actor: { select: { id: true, displayName: true } } }` en la misma consulta (TASK-037
  D3, sin N+1). `actorId` se mantiene en la respuesta hasta TASK-044.
- El front lee `actor.displayName` con el esquema obligatorio. Se despliega después que el back
  (orden normal de `infra/DESPLIEGUE-CLOUD.md`), así que el esquema nunca ve una respuesta sin `actor`.
- Una sola tarea para el back y la línea del front: es el mismo contrato y se revisan juntos.

## Alcance

- `back/src/academic/academic.controller.ts`: `@Roles("ADMIN")` en `historial`.
- `back/src/academic/domain/materia.ts`: `MateriaHistorial.actor: { id: string; displayName: string }`.
- `back/src/academic/infrastructure/prisma-materia.repository.ts`: `include` y mapeo en `findHistorial`.
- `back/tests/academic-fixture.ts`, `materias-filtros.spec.ts`, `admin.integration.spec.ts` (agente
  `test`): leer con admin; usuario común → 403; sin sesión → 401; entrada con `actor.displayName`.
- `front/src/types/materias.ts`, `front/src/services/schemas.ts`: `actor`.
- `front/src/components/academic/MateriaDetail.tsx`: "Usuario: {entry.actor.displayName}".
- `front/tests/materia-detalle.spec.tsx`: muestra el nombre.

## Fuera de alcance

- Quitar `actorId` (TASK-044).
- Exponer el historial a no admins.

## Pasos

1. Test: casos que fallan primero (403 para USER, `actor` en la respuesta, nombre en pantalla).
2. Back: `@Roles`, dominio, repositorio.
3. Front: tipo, esquema, línea de la vista.
4. Verificación.

## Criterio de "listo"

```powershell
docker run -d --name utn-test-db -e POSTGRES_PASSWORD=test -e POSTGRES_DB=utn_test -p 127.0.0.1:55450:5432 postgres:17-alpine
$env:TEST_DATABASE_URL = "postgresql://postgres:test@127.0.0.1:55450/utn_test"
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npm run db:deploy --workspace=back
npm run typecheck --workspace=back
npm run test --workspace=back
npm run build --workspace=back
npm run lint --workspace=front
npm run typecheck --workspace=front
npm run test --workspace=front
npm run build --workspace=front
```

- Las suites de integración no se saltean.
- Al terminar: `docker rm -f utn-test-db`.

Manual (Tiago):
- Como admin, editar el nombre de una materia: el historial muestra tu `displayName`.
- Con un cliente HTTP como usuario común, `/historial` da 403.
- Que no se rompa: edición de materia y paginación del historial (páginas de 3).

## Skills para la implementación

- `ponytail`.
- Agentes `back`, `front` y `test`. Estándar `docs/standards/catalogo-de-errores.md`.

## Riesgos y preguntas abiertas

- Si TASK-045 no está desplegada en Vercel, el usuario común ve un error en el detalle. Hay que
  confirmarlo antes de desplegar Render.
- Conflicto posible con TASK-042 en `schemas.ts` y `MateriaDetail.tsx`.

## Al cerrar

- `back/OVERVIEW.md`: historial solo ADMIN, con `actor`.
- `CHANGELOG.md`; mover a `finished/`.

## Resultado

Completada.
- Se agregó `@Roles("ADMIN")` al endpoint `GET /materias/:materiaId/historial` en `academic.controller.ts`.
- Se extendió el dominio `MateriaHistorial` con `actor: { id: string; displayName: string }`.
- Se actualizó `PrismaMateriaRepository.findHistorial` con `include: { actor: { select: { id: true, displayName: true } } }` sin consultas N+1 y mapeando el objeto `actor` en cada fila.
- En el frontend, se actualizaron `types/materias.ts`, `services/schemas.ts` y `MateriaDetail.tsx` para validar y renderizar `Usuario: {entry.actor.displayName}`.
- Se actualizaron las pruebas unitarias y de integración (`admin.integration.spec.ts`, `materia-detalle.spec.tsx`) verificando 403 para usuarios comunes, 401 sin sesión y 200 con `actor.displayName` para administradores.
- Verificación completa con base PostgreSQL de pruebas: `typecheck`, `test` y `build` en back y front.
