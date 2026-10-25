# TASK-039: Ampliar el esquema para carreras, comisiones y profesores por comisión (PR1 de TASK-037)

Estado: Pendiente. Plan acordado con el desarrollador el 2026-10-25.
Depende de TASK-037 (diseño cerrado). Es el PR1 de su sección 6.
Fecha: 2026-10-25

## Objetivo

Agregar a la base las estructuras del modelo nuevo (enums `Carrera` y `CargoDocente`, tablas
`MateriaCarrera` y `ComisionProfesor`, `Comision.carrera` y `Comision.numero`) y volver opcional
`Cursada.profesorId`. Todo lo nuevo es opcional o queda sin usar: la API se comporta igual.

## Contexto verificado (2026-10-25)

- `back/prisma/schema.prisma` L90-151: `Materia` con `anioCarrera`/`nivelElectiva` VARCHAR,
  `Cursada.profesorId` obligatorio con `@@index([profesorId])`, `Comision` con
  `@@unique([cursadaId, nombre])`. Prisma 6.19.3; el cliente se genera en `back/src/generated/prisma`.
- Las migraciones posteriores a `20261010043754_add_academic_entities` están escritas a mano:
  carpeta `YYYYMMDDHHMMSS_snake_case` con un `migration.sql`, sin cabecera. Los CHECK se escriben
  en SQL crudo y se nombran `<Tabla>_<columna>_check`
  (`20261022010000_materia_nivel_electiva/migration.sql`). Prisma no los ve.
- `back/src/academic/domain/cursada.ts`: `Cursada.profesorId: string`.
  `application/listar-cursadas-por-materia.ts` exporta `resumirCursada`, que hace
  `profesores.findById(cursada.profesorId)` y devuelve `""` si no lo encuentra.
- `infrastructure/prisma-comision.repository.ts` devuelve las filas de Prisma sin mapear: las
  columnas nuevas aparecen en la respuesta como `carrera: null, numero: null`. Los esquemas Zod
  del front son `z.object` no estrictos y las ignoran.
- Comisiones en Neon: el desarrollador las borró todas (TASK-037, D5).

## Decisiones

- El unique `(cursadaId, carrera, numero)` **no** se crea acá: lo crea TASK-044 (PR5). Hasta
  entonces la unicidad la garantiza `@@unique([cursadaId, nombre])`, porque TASK-040 escribe
  `nombre = "S-31"`.
- `numero` tiene un CHECK `IS NULL OR BETWEEN 1 AND 999` desde ahora: la regla vive en la base.
- `MateriaCarrera.anioCarrera` es NOT NULL (cada plan tiene año), con el mismo CHECK de valores
  que hoy tiene `Materia`. El CHECK de `nivelElectiva` es el de `Materia` copiado.
- Las columnas nuevas que aparecen en las respuestas de comisión como `null` se aceptan: son
  aditivas y ningún cliente las lee.

## Alcance

- `back/prisma/schema.prisma`:
  - `enum Carrera { S C Q I M }` y `enum CargoDocente { TITULAR ADJUNTO JTP }`.
  - `model MateriaCarrera { materiaId Uuid, carrera Carrera, anioCarrera VarChar(8), nivelElectiva VarChar(1)?, materia (onDelete: Restrict) }`,
    `@@id([materiaId, carrera])`, `@@index([carrera, anioCarrera, nivelElectiva])`.
  - `model ComisionProfesor { comisionId Uuid, profesorId Uuid, cargo CargoDocente, createdAt Timestamptz(3) default now, relaciones (onDelete: Restrict) }`,
    `@@id([comisionId, profesorId])`, `@@index([profesorId])`.
  - `Materia.carreras MateriaCarrera[]`, `Profesor.comisiones ComisionProfesor[]`,
    `Comision.carrera Carrera?`, `Comision.numero Int?`, `Comision.profesores ComisionProfesor[]`.
  - `Cursada.profesorId String?` y `profesor Profesor?`.
- `back/prisma/migrations/20261026000000_carreras_comisiones_profesores/migration.sql` (nuevo, a mano):
  `CREATE TYPE` de los dos enums, `CREATE TABLE` de las dos tablas con PK, FK e índices (nombres
  estilo Prisma), CHECK `MateriaCarrera_anioCarrera_check` y `MateriaCarrera_nivelElectiva_check`,
  `ALTER TABLE "Comision" ADD COLUMN "carrera" "Carrera"`, `ADD COLUMN "numero" INTEGER` y
  `Comision_numero_check`, `ALTER TABLE "Cursada" ALTER COLUMN "profesorId" DROP NOT NULL`.
- `back/src/academic/domain/cursada.ts`: `profesorId: string | null`.
- `back/src/academic/application/listar-cursadas-por-materia.ts`: `resumirCursada` devuelve `""`
  sin consultar cuando `profesorId` es `null`.
- `back/src/academic/infrastructure/prisma-cursada.repository.ts`: solo si el tipo lo exige.
- `back/tests/academic-fixture.ts` y `back/tests/academic.use-cases.spec.ts`: tipos y un caso
  nuevo (`resumirCursada` con `profesorId` null devuelve `""` sin llamar a `findById`).

## Fuera de alcance

- Leer o escribir las columnas y tablas nuevas desde la API (TASK-040 y TASK-041).
- Relleno de `MateriaCarrera` (TASK-040).
- Unique nuevo de comisión y borrado de columnas legadas (TASK-044).
- Front: no cambia.

## Pasos

1. Tiago comprueba en Neon `SELECT count(*) FROM "Comision";` = 0 (agente: no se conecta a Neon).
2. Test (agente `test`): caso de `resumirCursada` con `profesorId` null; tiene que fallar al compilar
   o al correr.
3. Back: `schema.prisma` y `migration.sql`; `npm run db:generate --workspace=back`.
4. Back: tipo de dominio y guarda en `resumirCursada`.
5. Verificación completa (abajo).

## Criterio de "listo"

Automático (PowerShell, desde la raíz; base de test descartable en Docker):

```powershell
docker run -d --name utn-test-db -e POSTGRES_PASSWORD=test -e POSTGRES_DB=utn_test -p 127.0.0.1:55450:5432 postgres:17-alpine
$env:TEST_DATABASE_URL = "postgresql://postgres:test@127.0.0.1:55450/utn_test"
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npm run db:deploy --workspace=back
cd back; npx prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma/schema.prisma --exit-code; cd ..
npm run typecheck --workspace=back
npm run test --workspace=back
npm run build --workspace=back
npm run test --workspace=front
```

- `migrate diff` sale con código 0: la migración a mano coincide con `schema.prisma`.
- `npm run build` (borra el cache de `tsc`) es el chequeo de tipos que vale; un typecheck
  incremental limpio solo no alcanza.
- Las suites de integración no se saltean (corren con `TEST_DATABASE_URL`).
- `npm run test --workspace=front` pasa sin cambios (`validation-parity.spec.ts` importa validadores del back).
- Al terminar: `docker rm -f utn-test-db`.

Manual (Tiago):
- `\d "MateriaCarrera"`, `\d "ComisionProfesor"`, `\d "Comision"` en la base de test muestran los CHECK.
- `INSERT` de una comisión con `numero = 0` falla por `Comision_numero_check`.
- Que no se rompa: listado de materias, detalle, cursadas y comisiones en local se ven igual que antes.

## Skills para la implementación

- `ponytail` (diff mínimo).
- Agentes: `back` (schema, migración, dominio) y `test` (tests). Estándares:
  `docs/standards/arquitectura-de-capas.md`.

## Riesgos y preguntas abiertas

- Si Neon tiene comisiones, frenar: TASK-037 D5 supone la tabla vacía.
- `migrate diff` no compara CHECK: revisarlos a mano en el SQL.
- Despliegue: `db:deploy` contra Neon y después Render (`infra/DESPLIEGUE-CLOUD.md`). La migración
  es solo aditiva, así que el back viejo sigue funcionando entre los dos pasos.

## Al cerrar

- Sección corta en `back/OVERVIEW.md` (modelo nuevo, CHECK a mano, unique pendiente para TASK-044).
- Entrada en `CHANGELOG.md`; mover la tarea a `finished/`.

## Resultado

Pendiente.
