# TASK-014: Módulo `academic`, etapa 1 — jerarquía académica (HU-04, solo lectura)

Estado: Implementado y verificado (tests + smoke test contra el backend real); validación manual
del equipo pendiente.
Fecha: 2026-10-10

Nota sobre esta tarea: ya no existe un documento de diseño técnico (TDD) separado en este repo
(convención retirada el 2026-10-10). Las decisiones de diseño de este hito viven directamente
acá, no en `docs/tdd/`.

Las convenciones que este hito estableció como estándar para módulos nuevos (no solo
`academic`) quedaron generalizadas en `docs/standards/`: [catálogo de
errores](../../standards/catalogo-de-errores.md), [validación con
Zod](../../standards/validacion-con-zod.md), [arquitectura de
capas](../../standards/arquitectura-de-capas.md), [soft
delete](../../standards/soft-delete.md) y [paginación](../../standards/paginacion.md). Las
secciones siguientes cuentan la historia y el porqué puntual de este módulo; las reglas
reusables para el próximo módulo viven en esos documentos, no acá.

## 1. Contexto y objetivo

Cubre HU-04 Escenario 1: que un estudiante autenticado pueda navegar la jerarquía académica real
—Materia → Cursada (período) → Comisión (turno)— hasta encontrar el curso concreto que busca.
Es la primera pieza del módulo `academic`; no incluye todavía HU-05 (validación de profesores
contra mock/API real) ni HU-11 (CRUD admin) — quedan para tareas siguientes (ver sección 7).

## 2. Modelo de dominio — decisiones y por qué

El modelo original de los borradores (`docs/temporal/03-modelo-de-dominio.md`) tenía `Subject`
(Materia), `Chair` (Cátedra) y `ProfessorChair` como asignación. Se revisó en conversación con
Tiago y cambió en tres puntos:

1. **Materia y Cátedra se fusionan en una sola entidad, `Materia`.** En la práctica de esta
   facultad no hay más de una Cátedra por Materia — mantenerlas separadas era una capa sin
   beneficio real.
2. **Se agrega `Cursada`, que no estaba en el modelo original.** Resuelve un problema concreto
   que señaló Tiago: si el profesor asignado a una Materia cambia de un año a otro, y solo se
   guarda "el profesor actual" como un campo mutable, una reseña de 2024 terminaría mostrando el
   profesor de 2025 — un bug de integridad real, no un detalle menor. `Cursada` es el registro
   histórico: Materia + período (`anio` + `cuatrimestre`) + el Profesor que la dictó *ese*
   período, inmutable una vez creada. El profesor "actual" de una Materia ya no es un campo
   propio — se deriva de su Cursada más reciente.
3. **`Commission` (ahora `Comisión`) se confirmó como entidad de esta iteración**, y vive dentro
   de una `Cursada` puntual (no es una subdivisión fija de la Materia que persiste entre
   períodos) — porque en esta facultad las comisiones se abren y cierran por cuatrimestre.

**Supuesto pendiente de confirmación** (no bloqueante para esta etapa, pero afecta HU-06 cuando
se escriba `Review`): el profesor queda asignado a nivel `Cursada`, no a nivel `Comisión` — todas
las comisiones de una misma Cursada comparten el mismo profesor "titular". Si en la práctica cada
comisión tiene su propio profesor, el campo `profesorId` se movería de `Cursada` a `Comisión`.

### Entidades (nombres en español — decisión puntual de Tiago para este módulo, no es la
convención general del proyecto; ver nota de idioma en la sección 8)

```
Materia   { id, nombre, createdAt, deletedAt }
Profesor  { id, nombreCompleto, createdAt, deletedAt }
Cursada   { id, materiaId, profesorId, anio, cuatrimestre (PRIMERO|SEGUNDO), createdAt, deletedAt }
Comision  { id, cursadaId, nombre, activa, createdAt, deletedAt }
```

Las 4 tienen `deletedAt: DateTime?` (soft delete) — decisión explícita de Tiago, aplicada a todo
el módulo desde el día uno. Ningún caso de uso de borrado existe todavía (HU-11 excluye
eliminación esta iteración); el campo está listo para cuando exista. **Límite conocido, no
resuelto todavía**: los índices únicos (`Materia.nombre`, `Comision` por `(cursadaId, nombre)`)
no son parciales — no filtran por `deletedAt IS NULL`. Si algún día se borra una Materia y se
quiere reutilizar su nombre, Postgres va a rechazar el alta por el índice único existente, aunque
la vieja esté "borrada". Se arregla con un índice único parcial el día que exista un caso de uso
real de borrado — no antes, porque hoy nadie borra nada.

Migración aplicada: `20261010043754_add_academic_entities`.

## 3. Arquitectura — capas y por qué

Se armó siguiendo Clean Architecture más estricto que lo que ya tiene `auth` (decisión explícita
de Tiago: no replicar las convenciones de `auth` para este módulo nuevo). Dos reglas puntuales:

- **`domain/` contiene únicamente clases/tipos que no importan nada** — ni siquiera entre sí.
  Hoy son 4 archivos: `materia.ts`, `profesor.ts`, `cursada.ts` (con el tipo `Cuatrimestre`),
  `comision.ts`. Son las entidades puras.
- **Los puertos (interfaces de repositorio) viven en `application/ports/`, no en `domain/`** —
  porque sí importan (las entidades + los tipos de paginación), y en Clean Architecture es la
  capa de casos de uso la que define qué necesita de afuera (Inversión de Dependencias), no el
  dominio puro.

```
back/src/academic/
  domain/               Materia, Profesor, Cursada, Comision — cero imports
  application/
    ports/              *.repository.ts (interfaces)
    errors.ts            MateriaNotFoundError, CursadaNotFoundError, InvalidIdError
    academic-id.ts        validateId(value: unknown): string — Zod, z.string().uuid()
    listar-materias.ts
    listar-cursadas-por-materia.ts
    listar-comisiones-por-cursada.ts
  infrastructure/        PrismaMateriaRepository, PrismaProfesorRepository,
                         PrismaCursadaRepository, PrismaComisionRepository
  academic.controller.ts
  academic.module.ts
```

### Zod (decisión nueva para este módulo)

`auth` valida todo a mano (regex, ifs). Para `academic`, a pedido de Tiago, se instaló Zod y se
usa para: `validateId` (formato UUID en los `:id` de ruta, estricto — comparación exacta contra
la parte después del único `@`/del UUID completo, no `endsWith`/`includes`, para que no pase un
id tipo `"evil"+uuid`) y `validatePagination` (`back/src/shared/domain/pagination-input.ts`,
compartido — `page` default 1 mínimo 1, `pageSize` default 20, entre 1 y 100). Es una
inconsistencia de estilo deliberada entre módulos, no un descuido — ver sección 8 para el resto
de la convivencia con `auth`.

### Paginación

Todos los listados (`Materia`, `Cursada` por Materia, `Comision` por Cursada) devuelven
`PaginatedResult<T> = { items, total, page, pageSize }` (`back/src/shared/domain/pagination.ts`).
Los adaptadores Prisma hacen `skip`/`take` + un `count` en paralelo (`Promise.all`) para el total
— dos queries, no una, porque Prisma no da el total gratis junto con los resultados.

### Proyección de `Cursada`

`ListarCursadasPorMateria` no devuelve la entidad `Cursada` cruda — devuelve
`{ id, anio, cuatrimestre, profesor: string }`, resolviendo el nombre del profesor vía
`ProfesorRepository.findById` por cada cursada (decisión de Tiago: mostrar solo el nombre, no el
objeto `{id, nombreCompleto}` completo). No se optimizó con un batch fetch — el volumen esperado
de cursadas por materia es chico.

## 4. Catálogo de errores — nuevo patrón, y retrofit a `auth`

Se construyó desde cero para `academic` (no existía en el repo): `DomainError`
(`back/src/shared/domain/domain-error.ts`, clase abstracta con `httpStatus` obligatorio por
subclase) + un único filtro global de Nest. Reemplaza el `try/catch` ad-hoc por ruta que tenía
`auth.controller.ts`.

**Se retroaplicó a `auth` el mismo día** (a pedido explícito de Tiago, después de confirmar que
el filtro ya funcionaba contra `academic`): 8 clases de error de `auth`/`users` pasaron a extender
`DomainError`, y se borraron los `try/catch` de `auth.controller.ts` (excepto el de `refresh`, que
no traduce errores — solo limpia cookies antes de relanzar, mismo comportamiento que antes).

### Un bug real que apareció al retroaplicar, y cómo se resolvió

Registrar el filtro de `academic` como `APP_FILTER` *también* desde `auth.module.ts` generaba dos
filtros globales iguales compitiendo — Nest los aplica a los dos y el segundo rompe al intentar
escribir una respuesta que el primero ya mandó. Se resolvió moviendo el filtro a un módulo
compartido único (`back/src/shared/shared.module.ts`), importado una sola vez por cada módulo que
lo necesita.

Después, al correr la suite completa contra una base de datos real (no solo los mocks), aparecieron
dos regresiones reales que los tests sin DB no detectaban:

1. El filtro nuevo, construido con `new HttpException(mensaje, status)` a secas, no agrega el
   campo `error` (el reason-phrase HTTP) que sí agregan las subclases específicas de Nest
   (`BadRequestException`, etc.) — rompió 9 tests existentes de `auth` que verificaban la forma
   exacta del body de error. Se arregló agregando `error: STATUS_CODES[status]` (de `node:http`,
   sin librería nueva) a mano en el filtro.
2. Un filtro global `@Catch()` sin tipo (pensado para capturar errores inesperados y loguearlos)
   interceptó, en la práctica, al `BadRequestException` del body-parser *antes* que
   `RegistrationBadRequestFilter` (el filtro ya existente que enmascara el mensaje crudo de JSON
   malformado para que no filtre fragmentos del body) — Nest no garantiza que el filtro más
   específico gane sobre un catch-all genérico si ambos están registrados como globales por
   separado. Se resolvió consolidando todo en **un único filtro global**
   (`UnhandledErrorFilter`, `back/src/shared/presentation/unhandled-error.filter.ts`) que decide
   explícitamente, en código, sin depender del orden de resolución de Nest: `DomainError` → su
   `httpStatus`; `BadRequestException` → delega a `RegistrationBadRequestFilter` (reutilizada,
   no duplicada); cualquier otro `HttpException` → se deja pasar igual; cualquier otra cosa →
   500 genérico + log del error real server-side (antes esto no se logueaba en ningún lado).

Lección para el futuro: **nunca registrar dos `APP_FILTER` globales que puedan matchear la misma
excepción** — consolidar en uno solo que decida explícitamente, no confiar en que Nest elige el
más específico.

## 5. Rutas HTTP y acceso

```
GET /materias                        → ListarMaterias
GET /materias/:materiaId/cursadas    → ListarCursadasPorMateria
GET /cursadas/:cursadaId/comisiones  → ListarComisionesPorCursada
```

Las 3 exigen `AuthenticationGuard` (sesión obligatoria) — **decisión de producto confirmada por
Tiago**: un visitante sin cuenta no puede navegar la jerarquía académica en esta iteración.

**Bug de infraestructura encontrado y corregido**: el proxy Nginx (`infra/proxy/nginx.dev.conf` y
`nginx.conf`) solo conocía `/auth/`, `/health` y `/health/ready` — cualquier pedido a `/materias`
caía al `location /` genérico y lo atendía el frontend (404 de Next.js, no del backend). Se
agregaron `location = /materias`, `location /materias/` y `location /cursadas/` apuntando al
backend, en los dos archivos (dev y producción). Ambas imágenes Docker (`backend`, `proxy`) están
compiladas, no bind-mounteadas — hubo que reconstruirlas (`docker compose build`) para que
tomaran el código nuevo; un `docker restart` solo no alcanza en este setup.

## 6. Verificación

- `back/tests/academic.use-cases.spec.ts` (20 tests, unitarios, repos fake en memoria):
  paginación (default/explícita/fuera de rango), `MateriaNotFoundError`/`CursadaNotFoundError`,
  `InvalidIdError` (incluye casos de spoofing de UUID), proyección de `profesor` como string.
- `back/tests/academic.integration.spec.ts` (6 tests, HTTP + Prisma real,
  `skipIf(!TEST_DATABASE_URL)`): guard sin sesión → 401, listado con sesión real, soft-delete
  excluido de los resultados, 404/400 según corresponda.
- Suite completa verificada dos veces: sin base de pruebas (220 passed, 89 skipped — estándar del
  repo) y con una base Postgres aislada temporal, migrada y luego borrada (308 passed, 1 skipped
  por Mailpit, no por esto).
- Smoke test manual contra el backend real reconstruido (`curl` a través del proxy): 401 con
  `error: "Unauthorized"` en `/materias` sin sesión, 400 con UUID inválido.

## 7. Qué queda para después (no es parte de esta tarea)

- **HU-05** (validación de profesores/comisiones, mock vs. API real de la facultad — Spike 1
  sigue sin resolverse) y **HU-11** (CRUD admin de Materia/Profesor/Cursada/Comisión) — tareas
  siguientes, numeración `TASK-015`/`TASK-016` ya reservada en la conversación de planificación,
  todavía no escritas como archivo.
- Deuda técnica logueada en Trello (tablero `2026-UTN-Cloud`, lista Backlog, label BACK) para
  evaluar más adelante sobre `auth`/`users` — no se tocan ahora: migrar su validación manual a
  Zod, evaluar soft delete en `User`/`Session`, evaluar renombrar sus entidades a español.
- Índice único parcial (`WHERE deletedAt IS NULL`) en `Materia`/`Comision` — pendiente hasta que
  exista un caso de uso real de borrado (sección 2).

## 8. Nota de idioma (sin resolver, a decisión de Tiago)

`01-arquitectura-y-tecnologias.md` fija nombres de entidad en inglés como convención del
proyecto. Las entidades de `academic` se nombraron en español por pedido puntual de Tiago para
este módulo — queda como inconsistencia deliberada entre módulos, no una convención nueva del
proyecto. Si se quiere, en algún momento, actualizar ese documento para reflejar `academic` como
excepción, o reabrir la discusión de idioma a nivel proyecto, es decisión de Tiago — no se resolvió
acá.
