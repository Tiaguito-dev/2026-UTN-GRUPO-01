# TASK-044: Contraer el modelo legado de materias, cursadas y comisiones (PR5 de TASK-037)

Estado: Completada. Plan acordado con el desarrollador el 2026-10-25.
Depende de TASK-042 (el front ya no lee ni manda campos legados, desplegado en Vercel) y de
TASK-046 (historial con `actor`). No depende de TASK-043.
Fecha: 2026-10-25

## Objetivo

Cerrar la migración expand-contract:
- `Comision.carrera` y `numero` pasan a obligatorios, con unique `(cursadaId, carrera, numero)`;
- se eliminan `Comision.nombre`, `Cursada.profesorId`, `Materia.anioCarrera` y
  `Materia.nivelElectiva` (con sus índices y CHECK);
- la API deja de aceptar y devolver los campos legados.

## Contexto verificado (2026-10-25)

- Nombres en la base:
  - El unique `(cursadaId, nombre)`, el índice y la FK de `Cursada.profesorId` vienen de
    `20261010043754_add_academic_entities/migration.sql` (Prisma): el agente copia de ahí los nombres exactos.
  - Los CHECK `Materia_anioCarrera_check` y `Materia_nivelElectiva_check`, y los índices
    `Materia_deletedAt_anioCarrera_nombre_id_idx` y `Materia_deletedAt_anioCarrera_nivelElectiva_nombre_id_idx`,
    vienen de las migraciones `20261022*`.
- Lo legado que dejan TASK-040 y TASK-041:
  - formas de entrada legadas (materia con `anioCarrera` suelto, comisión con `nombre`, cursada con `profesorId`);
  - upsert de la fila `S` en el `PATCH` legado;
  - listado sin `carrera` con filtros y orden legados;
  - `profesor` en el resumen y el detalle de cursada (N+1 de `resumirCursada`);
  - `nombre` guardado;
  - `anioCarrera`/`nivelElectiva` en las respuestas de materia;
  - `actorId` en el historial.
- `infra/DESPLIEGUE-CLOUD.md`: el orden normal es `db:deploy` → Render → Vercel. Render tarda
  minutos en desplegar.
- `seed-academic.ts` busca comisiones por `cursadaId_nombre` y guarda `profesorId` en cursadas.

## Decisiones

- **Orden de despliegue invertido para este PR**: primero Render (back nuevo) y enseguida
  `db:deploy` contra Neon. El back nuevo no lee ni escribe columnas legadas. Solo `POST /comisiones`
  falla durante la ventana, porque `nombre` todavía es NOT NULL. Con el orden normal, el back viejo
  rompería todas las lecturas de materias y comisiones mientras Render despliega.
  - Alternativa descartada: hacer `nombre` nullable en una migración previa. Suma un PR por una
    ventana de minutos.
- **Prechequeos en Neon (bloqueantes)**:
  - `SELECT count(*) FROM "Comision" WHERE "carrera" IS NULL OR "numero" IS NULL;` = 0.
  - `SELECT count(*) FROM "Materia" m WHERE "deletedAt" IS NULL AND NOT EXISTS (SELECT 1 FROM "MateriaCarrera" c WHERE c."materiaId" = m."id");` = 0.
    Si no da 0, un admin completa esas materias desde "Editar materia" antes de seguir.
- **Listado sin `carrera`**: ordena por `nombre`, `id`; `anioCarrera` o `nivelElectiva` sin `carrera` → 400.
- **Entradas legadas**: desaparecen. Con `z.strictObject`, mandarlas da 400 `CAMPOS_NO_PERMITIDOS`.
- **`nombre` de comisión**: se deriva al mapear (`${carrera}-${numero}`). El duplicado se busca por
  `(cursadaId, carrera, numero)` y el P2002 del unique nuevo sigue mapeando a
  `ComisionAlreadyExistsError`, con el texto ajustado a "Ya existe esa comisión en esa cursada.".
- **Historial**: el enum de `campo` conserva `anioCarrera` y `nivelElectiva` para las entradas viejas.
  `actorId` sale de la respuesta.

## Alcance

- `back/prisma/schema.prisma`: quitar columnas, índices y relación `Cursada.profesor`/`Profesor.cursadas`.
  `Comision.carrera`/`numero` obligatorios, `@@unique([cursadaId, carrera, numero])`.
- `back/prisma/migrations/20261101000000_contraer_modelo_legado/migration.sql` (nuevo, a mano; fecha
  real al implementar): `SET NOT NULL`, nuevo unique, `DROP` de unique/índices/FK/CHECK/columnas.
- `back/src/academic/domain/*.ts`: sin campos legados.
- `back/src/academic/application/`:
  - `materia-input.ts` (sin `materiaFields` legado; reemplazarlo por el esquema nuevo y ajustar
    `validation-parity`), `crear-materia*.ts`, `actualizar-materia.ts`;
  - `crear-comision*.ts`, `crear-cursada*.ts`;
  - `listar-materias.ts`, `listar-cursadas-por-materia.ts`, `obtener-cursada.ts`
    (sin `ProfesorRepository` ni N+1), `listar-historial-materia.ts`;
  - `ports/*.ts`.
- `back/src/academic/infrastructure/prisma-*.repository.ts`: consultas sin columnas legadas.
- `back/src/academic/academic.module.ts`: dependencias que ya no hacen falta.
- `back/src/academic/seed-academic.ts`: clave `cursadaId_carrera_numero`, cursadas sin profesor,
  materias sin año legado.
- `front/tests/validation-parity.spec.ts`: lo que importe del back.
- Tests de back (agente `test`): todos los que mencionen campos legados.

## Fuera de alcance

- Front de producción: no cambia (TASK-042 ya no usa lo legado). Solo cambia el test de paridad.
- Editor de año por carrera, edición y baja de comisiones.

## Pasos

1. Tiago corre los prechequeos en Neon.
2. Test: casos que fallan primero:
   - entradas legadas → 400;
   - listado sin `carrera` ordenado por nombre, y año/nivel sin `carrera` → 400;
   - nombre derivado y duplicado por carrera + número;
   - respuestas sin campos legados.
3. Back: código (dominio, entradas, casos de uso, repositorios, módulo, seed).
4. Back: schema y migración.
5. Verificación completa. El ensayo sobre un branch de Neon lo hace Tiago.

## Criterio de "listo"

Automático (PowerShell, desde la raíz):

```powershell
docker run -d --name utn-test-db -e POSTGRES_PASSWORD=test -e POSTGRES_DB=utn_test -p 127.0.0.1:55450:5432 postgres:17-alpine
$env:TEST_DATABASE_URL = "postgresql://postgres:test@127.0.0.1:55450/utn_test"
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npm run db:deploy --workspace=back
cd back; npx prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma/schema.prisma --exit-code; cd ..
npm run typecheck --workspace=back
npm run test --workspace=back
npm run build --workspace=back
npm run academic:seed --workspace=back
npm run test --workspace=front
```

- Las suites de integración no se saltean.
- Al terminar: `docker rm -f utn-test-db`.

Manual (Tiago):
- Prechequeos de Neon en 0 antes de desplegar.
- Ensayo con datos reales: crear un branch de Neon, correr `db:deploy` contra él con la migración
  nueva y comprobar que aplica sin error. La base Docker solo prueba la migración sobre una base
  vacía más el seed.
- Despliegue: Render primero, `db:deploy` enseguida, y después verificar `/health/ready`.
- Con el front de TASK-042:
  - el listado "Todas" ordena por nombre;
  - las cursadas ya no muestran profesor (no lo leían);
  - crear una comisión duplicada da 409.
- Que no se rompa: todos los flujos manuales de TASK-042.

## Skills para la implementación

- `ponytail`.
- Agentes `back` y `test`. Estándares: `docs/standards/arquitectura-de-capas.md`, `validacion-con-zod.md`,
  `catalogo-de-errores.md`.

## Riesgos y preguntas abiertas

- La migración borra datos (columnas legadas). No hay vuelta atrás sin backup: antes de aplicarla
  en Neon, Tiago saca un branch o un snapshot de Neon.
- Si TASK-046 no está desplegada, no se quita `actorId`. Se deja para una tarea chica aparte.

## Al cerrar

- `back/OVERVIEW.md`: quitar la nota de campos legados; dejar constancia del orden de despliegue invertido.
- `CHANGELOG.md`; mover a `finished/`. TASK-037 puede pasar a `finished/` cuando esta cierre.

## Resultado

Completada el 2026-10-25.
- Base de datos contraída: `Comision.carrera` y `numero` obligatorios con unique `[cursadaId, carrera, numero]` y check 1-999; eliminadas columnas `Comision.nombre`, `Cursada.profesorId`, `Materia.anioCarrera` y `Materia.nivelElectiva` con sus FKs, índices y checks asociados en la migración `20261101000000_contraer_modelo_legado`.
- Verificado `prisma migrate diff` con exit-code 0 (sin diferencias entre base de datos migrada y schema).
- Casos de uso y validación Zod estrictos (`z.strictObject`): rechazo de campos legados con 400 `CAMPOS_NO_PERMITIDOS`.
- Eliminado `ProfesorRepository` y llamadas legadas del listado y detalle de cursada (sin N+1).
- `GET /materias`: orden por `nombre ASC, id ASC` sin filtro de carrera; 400 si se envía año/nivel sin carrera.
- `GET /materias/:id/historial`: retirado `actorId` de la respuesta pública, conservando `actor: { id, displayName }`.
- Seed académico (`seed-academic.ts`) actualizado a modelo contraído y verificado aditivo e idempotente.
- Verificación automática completa:
  - Backend: typecheck, 452 unit tests, 296 academic tests con base Postgres real, build (`nest build`), seed.
  - Frontend: lint (0 warnings), typecheck, 30 test files (261 tests), build (`next build`).
- Documentado orden de despliegue invertido (Render primero, luego Neon `db:deploy`) en `back/OVERVIEW.md` y registrado en `CHANGELOG.md`.
