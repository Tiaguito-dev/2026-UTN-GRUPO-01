# TASK-040: Doble escritura de carreras, comisiones nuevas y profesores por comisión (PR2 de TASK-037)

Estado: Pendiente. Plan acordado con el desarrollador el 2026-10-25.
Depende de TASK-039 (esquema ampliado, desplegado en Neon).
Fecha: 2026-10-25

## Objetivo

La API empieza a escribir el modelo nuevo sin romper el front actual. Las materias aceptan
`carreras[]` y se rellenan las existentes. Las comisiones se crean con carrera y número. Se agregan
la asignación y la baja de profesores por comisión, y la cursada deja de exigir profesor. El seed
pasa al formato nuevo.

## Contexto verificado (2026-10-25)

- `back/src/academic/application/materia-input.ts`: `materiaFields` (`nombre`, `anioCarrera`,
  `nivelElectiva`), `updateSchema` estricto y `resolveNivelElectiva` (exige nivel si el año es
  `ELECTIVA`). `front/tests/validation-parity.spec.ts` importa `materiaFields`,
  `validateCrearComisionInput` y `validateCrearCursadaInput` del back.
- `crear-comision-input.ts`: `z.strictObject({ cursadaId, nombre: nombreSchema(100) })`, con mensajes
  por campo y `CAMPOS_NO_PERMITIDOS` para claves de más.
- `crear-cursada-input.ts`: esquema armado por llamada (año máximo `now+1`); `profesorId: z.string().uuid()`.
- `infrastructure/prisma-materia.repository.ts` L54-90: `update` corre en `$transaction` con
  `SELECT … FOR UPDATE`, calcula `cambios` solo con diferencias reales y crea `MateriaHistorial`.
  `create` y `update` mapean P2002 a `MateriaAlreadyExistsError`.
- `prisma-comision.repository.ts`: `findByCursadaIdAndNombre`, `create`; P2002 → `ComisionAlreadyExistsError`.
- `academic.controller.ts`: guardas `AuthenticationGuard, RolesGuard` a nivel clase; altas con
  `@Roles("ADMIN")`. No hay `@Put` ni `@Delete` todavía.
- `academic.module.ts`: cada caso de uso es `useFactory` + `inject` de los símbolos de repositorio.
- Errores: `application/errors.ts`, subclases de `DomainError` con `httpStatus`; un único filtro
  global (`docs/standards/catalogo-de-errores.md`, sin try/catch en controladores).
- `seed-academic.ts`: crea 3 materias **sin** `anioCarrera`, profesores, 5 cursadas con
  `profesorId` y comisiones con nombre viejo ("Comisión 1 - Mañana"), por claves
  `materiaId_anio_cuatrimestre` y `cursadaId_nombre`.
- El front actual manda `POST /materias {nombre, anioCarrera, nivelElectiva?}`, `PATCH` parcial con
  esos campos, `POST /comisiones {cursadaId, nombre}` y `POST /cursadas` con `profesorId`. Hasta
  TASK-042 tiene que seguir funcionando.

## Decisiones

- **Entradas en dos formas, mutuamente excluyentes** (400 si llegan las dos):
  - Materia: `{nombre, carreras: [{carrera, anioCarrera, nivelElectiva?}]}` (nueva) o
    `{nombre, anioCarrera, nivelElectiva?}` (legada, se guarda como `carreras: [{carrera: "S", …}]`).
  - `carreras`: mínimo 1, sin carrera repetida, `resolveNivelElectiva` por cada fila.
  - Comisión: `{cursadaId, carrera, numero}` (nueva) o `{cursadaId, nombre}` (legada, sin cambios,
    deja `carrera` y `numero` en null).
- **Columnas legadas de materia**: con `carreras`, `Materia.anioCarrera`/`nivelElectiva` toman el
  primer elemento del arreglo tal como llega. Un `PATCH` legado actualiza las columnas legadas y
  hace upsert de la fila `S` de `MateriaCarrera`.
- **Historial**: un `PATCH` con `carreras` registra un solo cambio `campo: "carreras"`, serializado
  como `S:2,Q:ELECTIVA:4` (orden del enum S, C, Q, I, M; el nivel solo si existe). Las columnas
  legadas se sincronizan sin entradas extra. El `PATCH` legado registra lo mismo que hoy.
- **Quitar una carrera con comisiones** (no borradas) de esa carrera → 409 con un error nuevo
  `CarreraConComisionesError` ("No se puede quitar una carrera que tiene comisiones."). TASK-037
  pide el 409 pero no le pone nombre.
- **Comisión nueva**: `numero` entero 1-999; `carrera` debe estar entre las carreras de la materia
  de la cursada (si no, 400 `InvalidAcademicInputError`); `nombre = "${carrera}-${numero}"`, con lo
  que el `@@unique([cursadaId, nombre])` existente da el 409.
- **Profesores por comisión**:
  - `PUT /comisiones/:comisionId/profesores/:profesorId {cargo}` (ADMIN) hace upsert y devuelve
    `{id, nombreCompleto, cargo}`.
  - `DELETE` (ADMIN) devuelve 204. Si la comisión no existe o está borrada → `ComisionNotFoundError`
    (404); si el profesor no existe o está borrado → `ProfesorNotFoundError`; si no estaba asignado
    → `ProfesorNoAsignadoError` (404).
- **Cursada**: `profesorId` opcional; si llega, se valida que exista (404 como hoy) y se guarda.
- **Seed**:
  - Materias con carreras: Análisis Matemático II en las 5 carreras, año 2; AED Sistemas año 1;
    Sistemas Operativos Sistemas año 3. Las filas se agregan con `createMany({ skipDuplicates })`
    y el `anioCarrera` legado se completa solo al crear la materia.
  - Comisiones `S-1`, `S-2`, `Q-1`, etc., con carrera, número y de 1 a 3 profesores con cargo.
  - Las cursadas siguen guardando `profesorId` (lo quita TASK-044), para que el front actual no
    muestre profesores vacíos.
- **Relleno**: migración SQL con
  `INSERT INTO "MateriaCarrera" SELECT id, 'S', "anioCarrera", "nivelElectiva" FROM "Materia" WHERE "anioCarrera" IS NOT NULL ON CONFLICT DO NOTHING`.
  Las materias con `anioCarrera` null quedan sin carrera; un admin las completa con "Editar materia"
  (ya exige año cuando falta).

## Alcance

- `back/prisma/migrations/20261027000000_materia_carrera_backfill/migration.sql` (nuevo): el `INSERT` de arriba.
- `back/src/academic/domain/materia.ts`: tipo `Carrera`, `MateriaCarrera`; `MateriaCambio.campo` suma `"carreras"`.
- `back/src/academic/domain/comision.ts`: `CargoDocente`, `ProfesorAsignado {id, nombreCompleto, cargo}`.
- `back/src/academic/application/materia-input.ts`: `carreraSchema`, `materiaCarreraSchema`,
  las dos formas de alta y de edición. `materiaFields` se mantiene exportado tal cual.
- `back/src/academic/application/crear-materia-input.ts`, `crear-materia.ts`, `actualizar-materia.ts`:
  normalizan a `carreras` y validan.
- `back/src/academic/application/crear-comision-input.ts`, `crear-comision.ts`: forma nueva, chequeo
  de carrera contra la materia (nueva dependencia del repositorio de materias en el módulo).
- `back/src/academic/application/crear-cursada-input.ts`, `crear-cursada.ts`: `profesorId` opcional.
- `back/src/academic/application/asignar-profesor-comision.ts`, `quitar-profesor-comision.ts`
  (nuevos) y el validador de `{cargo}` (estricto, en el mismo archivo del caso de uso o en un `-input.ts`, como el resto).
- `back/src/academic/application/errors.ts`: `ComisionNotFoundError`, `ProfesorNoAsignadoError`, `CarreraConComisionesError`.
- `back/src/academic/application/ports/materia.repository.ts`: `create`/`update` reciben `carreras`;
  `findCarreras(materiaId): Promise<Carrera[]>`.
- `back/src/academic/application/ports/comision.repository.ts`: `findById`, `create` con `carrera`/`numero`
  opcionales, `asignarProfesor`, `quitarProfesor(): Promise<boolean>`, `existsByMateriaAndCarrera`
  (o equivalente) para el 409 de carreras.
- `back/src/academic/application/ports/cursada.repository.ts`: `profesorId` opcional en `create`.
- `back/src/academic/infrastructure/prisma-*.repository.ts`: implementaciones (en `update` de
  materia: reemplazo de `MateriaCarrera` dentro de la misma transacción con lock).
- `back/src/academic/academic.controller.ts`: `@Put` y `@Delete` (con `@HttpCode(204)`), ambos `@Roles("ADMIN")`.
- `back/src/academic/academic.module.ts`: cableado de los casos de uso nuevos.
- `back/src/academic/seed-academic.ts`: formato nuevo.
- Tests (agente `test`): `back/tests/academic-fixture.ts`, `academic-admin.use-cases.spec.ts`,
  `materias-filtros.spec.ts`, `admin.integration.spec.ts`; `front/tests/validation-parity.spec.ts`
  si cambia lo que importa.

## Fuera de alcance

- Respuestas con campos nuevos, filtro `?carrera=`, `GET /comisiones/:id` (TASK-041).
- Front (TASK-042).
- Quitar formas legadas o columnas (TASK-044).
- Historial solo ADMIN (TASK-045/046).
- Límite de profesores por comisión o Titular único (TASK-037 dice que no se valida).

## Pasos

1. Test: casos que fallan primero para entradas (dos formas, ambas a la vez, `carreras` vacío o
   repetido, nivel sin `ELECTIVA`, `numero` 0/1000/no entero, `cargo` inválido, claves de más).
2. Test: casos de uso (alta y edición con `carreras` y legada, 409 al quitar carrera con comisiones,
   historial `"carreras"`, comisión con carrera ajena 400, duplicada 409, asignar/cambiar
   cargo/quitar con sus 404, cursada sin profesor).
3. Back: dominio, errores, puertos.
4. Back: entradas y casos de uso; repositorios; controlador y módulo.
5. Back: migración de relleno y seed.
6. Test: integración HTTP de `PUT`/`DELETE` (403 para USER, 204, 404) y de `POST /materias` con `carreras`.
7. Verificación completa.

## Criterio de "listo"

Automático (PowerShell, desde la raíz; misma base Docker que TASK-039):

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
npm run academic:seed --workspace=back
npm run test --workspace=front
```

- El seed corre dos veces sin error (idempotente).
- Las suites de integración no se saltean.
- Al terminar: `docker rm -f utn-test-db`.

Manual (Tiago):
- En local con el front actual: alta de materia, edición de año, alta de cursada y alta de comisión
  con nombre libre siguen andando igual.
- Con un cliente HTTP como admin:
  - `POST /materias` con `carreras` de S y Q crea dos filas en `MateriaCarrera`.
  - `PATCH` sacando Q estando Q con comisiones da 409.
  - `PUT` y `DELETE` de profesor por comisión responden según la tabla de TASK-037 §5.2.
- Antes de desplegar: en Neon, después de `db:deploy`, `SELECT count(*) FROM "Materia" WHERE "anioCarrera" IS NOT NULL`
  coincide con `SELECT count(*) FROM "MateriaCarrera"`. Recién ahí correr el seed en Neon.

## Skills para la implementación

- `ponytail`.
- Agentes `back` y `test`. Estándares: `docs/standards/validacion-con-zod.md`,
  `catalogo-de-errores.md`, `arquitectura-de-capas.md`, `soft-delete.md`.

## Riesgos y preguntas abiertas

- Entre este PR y TASK-042, el front viejo puede crear comisiones con nombre libre (carrera null).
  TASK-042 y TASK-044 lo chequean antes de desplegar.
- Una entrada de historial `"carreras"` rompe el historial del front viejo (502 por el `z.enum`).
  Solo se genera con un `PATCH` que mande `carreras`, y el front viejo no lo manda.
- Es el PR más grande de la serie. Si el diff se vuelve difícil de revisar, se puede partir en
  materias y comisiones/profesores, con dos ramas y el mismo plan.

## Al cerrar

- `back/OVERVIEW.md`: formas de entrada legadas y su fecha de baja (TASK-044), formato de
  historial `"carreras"`, `CarreraConComisionesError`.
- `CHANGELOG.md`; mover a `finished/`.

## Resultado

Implementado el 2026-10-25 (sin commitear). Desvíos y decisiones de implementación:

- Formato del historial en la función pura `serializarCarreras` (`domain/materia.ts`).
- Un nivel en una fila que no es Electiva se normaliza a null (como `resolveNivelElectiva`
  en la forma legada); Electiva sin nivel es 400.
- `PATCH` legado: la fila `S` se actualiza solo si cambia el año o el nivel, para no agregar `S`
  a una materia que no la tiene al renombrarla.
- Las dos formas a la vez dan 400 con mensaje propio.
- El chequeo del 409 de carreras corre fuera del lock (marcado `ponytail:`).
- Bases con el seed viejo conservan sus comisiones viejas junto a las nuevas.

Evidencia (Docker `utn-test-db`, 2026-10-25):

- `db:deploy`: 10 migraciones aplicadas. `migrate diff --exit-code`: sin diferencias.
- `typecheck` y `build` back: ok. `test` front: 230/230.
- `academic:seed` dos veces: 3 materias, 5 cursadas, 8 comisiones; segunda corrida 0/0/0.
- `test` back: 527 pasan, 55 fallan, todas en las suites `auth*.integration` por
  `expected 503 to be 201` en `POST /auth/register`: el Mailpit local (puerto 1025) tarda ~1 s
  en saludar y `tests/auth-test.config.ts` fija `SMTP_TIMEOUT_MS: "250"`. Ningún archivo de auth
  cambió en esta tarea. `admin.integration` y `academic.integration` pasan completas.
- Pendiente: la verificación manual de Tiago.
