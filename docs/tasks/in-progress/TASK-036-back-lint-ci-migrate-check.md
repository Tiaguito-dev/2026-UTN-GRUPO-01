# TASK-036: Linter, CI y check de migraciones para `back`

Estado: En curso.
Fecha: 2026-10-25

## Seguimiento con TASK-002 (2026-10-26)

La implementación descrita abajo ya existe; el contexto original se conserva como
registro histórico. TASK-002 reutiliza este pipeline y el de frontend para validar
ambos módulos en cada PR a `desarrollo` y `main`. Sustituye los filtros por rutas y
el trigger push originales por ejecución exclusiva en PR, y cambia `verify` por
`backend-ci` para ofrecer un check obligatorio único. Conserva los servicios y
todos los pasos de verificación de esta tarea.

La configuración de checks obligatorios, excluida originalmente aquí, y la
actualización del DoD pertenecen a TASK-002. Compartir la evidencia de una PR verde
del backend entre ambas tareas; mantener la prueba negativa de lint de TASK-036
y la prueba de test fallido con bloqueo de merge de TASK-002 (diferida por el
desarrollador hasta un fallo durante el desarrollo). Ambas tareas siguen
abiertas hasta completar su aceptación remota; los cambios locales no la sustituyen.

Revisión remota durante TASK-002: existe una
[PR histórica con backend verde](https://github.com/Tiaguito-dev/2026-UTN-GRUPO-01/actions/runs/40235366580).
La [PR posterior de correo](https://github.com/Tiaguito-dev/2026-UTN-GRUPO-01/actions/runs/40237412336)
falló por `no-control-regex` en `email.config.ts:22`, con migraciones y typecheck
aprobados, según sus pasos y logs; ese hallazgo fue resuelto por TASK-055.
TASK-002 registra además una nueva corrida local completa: 651 tests backend sin
omitidos, typecheck/lint/build y deriva de migraciones en verde. Falta ejecutar
en una PR los cambios actuales y completar la aceptación de TASK-002.

## 1. Contexto y objetivo

Un 500 en login reciente se debió a que `schema.prisma` había cambiado sin que se generara/aplicara
la migración correspondiente en la base real. `back` no tiene hoy ninguna verificación automática
que hubiera detectado ese desincronismo antes del deploy:

- **No hay linter en `back`.** `back/package.json` no tiene script `lint` ni `eslint`/
  `typescript-eslint` en `devDependencies`.
- **No hay CI para `back`.** `.github/workflows/` solo tiene `front.yml`.
- **`front` ya resolvió ambas piezas** (TASK-023/TASK-033) y sirve de molde: `front/eslint.config.mjs`
  (flat config + helper `toError()`/`asErrors()` que promueve toda regla activa a `error`) y
  `.github/workflows/front.yml` (checkout → setup-node vía `.nvmrc` → `npm ci` → typecheck → lint →
  test → build).
- La causa puntual del 500 de hoy (prod atrasada respecto a `prisma/migrations/`) ya tiene
  mitigación aparte: `render.yaml` corre `npm run db:deploy --workspace=back` antes de `start` en
  cada arranque de Render (no es parte de esta tarea).
- El typecheck de `back` **no** está roto: la nota de TASK-021 sobre mocks sin métodos nuevos quedó
  vieja, se corrigió en algún commit posterior sin actualizar esa tarea. Verificado en esta sesión
  sobre el HEAD de `desarrollo`: `npm run typecheck --workspace=back` termina en verde.
- `prisma migrate diff` (CLI 6.19.3) soporta `--from-migrations <dir> --to-schema-datamodel <schema>
  --shadow-database-url <url> --exit-code` (exit 2 si hay diferencias, 0 si no) para detectar drift
  entre `prisma/migrations/` y `schema.prisma` sin tocar ninguna base real.

Objetivo: que `back` tenga linter, CI propia (typecheck + lint + test + build) y un paso que falle
si alguien edita `schema.prisma` sin generar la migración correspondiente.

## 2. Alcance

1. **`back/eslint.config.mjs`** (nuevo): flat config con `@eslint/js` + `typescript-eslint`
   recomendado (sin type-checking, ver decisión 6), reutilizando el patrón `toError()`/`asErrors()`
   de `front/eslint.config.mjs` para promover toda regla activa a `error`. Ignora `dist/**` y
   `src/generated/**` (código generado por Prisma, fuera de nuestro control).
2. **`back/package.json`**: agregar `"lint": "eslint . --max-warnings 0"` a `scripts`, y `eslint` +
   `typescript-eslint` (misma mayor que `eslint ^9.x` de `front`) a `devDependencies`.
3. **`back/src/`**: corregir cada hallazgo real del linter nuevo, o silenciarlo con
   `// eslint-disable-next-line <regla> -- <motivo>` cuando corresponda. No se sabe cuántos ni
   cuáles hasta correr la config — se documentan en la sección 6.
4. **`.github/workflows/back.yml`** (nuevo), mismo patrón que `front.yml`:
   - Triggers: `pull_request` hacia `[desarrollo, main]` y `push` a `[desarrollo]`, filtrados por
     `back/**`, `package.json`, `package-lock.json`, `.github/workflows/back.yml`.
   - Servicio `postgres:17` con credenciales fijas de CI (no secretos reales).
   - Pasos: checkout → setup-node (`.nvmrc`) → `npm ci` → `prisma generate` → **migrate-check**
     (`prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel
     prisma/schema.prisma --shadow-database-url <db2 del mismo servicio> --exit-code`, falla el job
     si hay diferencias) → `prisma migrate deploy` contra la DB del servicio → `typecheck` → `lint`
     → `test` (con `TEST_DATABASE_URL` apuntando al servicio) → `build`.

## 3. Fuera de alcance

- **Comparar la Neon de producción contra el repo.** Exigiría guardar su `DATABASE_URL` como
  secreto de CI — una credencial de producción expuesta a un sistema más, por una garantía que ya
  da el `render.yaml` corregido. El problema que CI puede prevenir barato es otro: que alguien edite
  `schema.prisma` y se olvide de generar la migración (eso sí es el alcance de esta tarea).
- **Reglas de lint type-aware** (`recommendedTypeChecked`, `no-floating-promises`, etc.). Mantiene
  el pipeline simple y rápido, a la par del esfuerzo que ya tiene el linter de `front` (tampoco es
  type-aware). Mejora incremental futura si se quieren cazar bugs de promesas sin `await`.
- **Branch protection en GitHub** (hacer el check de `back` obligatorio para mergear). Es una acción
  de administración del repo que afecta a todo el equipo, no un archivo de esta tarea.
- **Actualizar tarjetas de Trello** (TAREA-02/03/04). Trabajo del agente `po` sobre el tablero.
- **Levantar `pgvector` o cualquier otra extensión.** No hace falta para este check.
- **Tocar `front/`.** Ya tiene linter y CI, nada que cambiar.
- **Escribir tests nuevos.** Fuera del alcance del agente `back` (ver `.agents/back.md`); si el
  linter obliga a tocar código de `back/src/`, el cambio se limita a lo mínimo para pasar la regla
  o a la justificación documentada, sin tocar comportamiento.

## 4. Decisiones de diseño

1. **El check de "migrate" detecta drift `schema.prisma` ↔ `prisma/migrations/`, no drift contra
   Neon de producción.** Ver "Fuera de alcance": comparar contra Neon real expondría una credencial
   de producción a CI por una garantía que el `render.yaml` corregido ya cubre.
2. **El pipeline de `back` exige typecheck desde el día uno**, igual que `front`. Ya está verde
   (ver contexto); no hay motivo para arrancar más débil que `front`.
3. **Una sola tarea/PR** (linter + workflow de CI + migrate-check). Las tres piezas son la misma
   pieza de infraestructura (verificación automática de `back`) y revisar un solo PR es más simple
   que coordinar el orden de tres.
4. **Mismo criterio de severidad que `front` (TASK-033): toda regla activa es error,
   `--max-warnings 0`, excepción con `eslint-disable` + motivo.** Consistencia con el DoD "sin
   errores de lint" y con el estándar que ya aplica `front`.
5. **Postgres 17 como servicio de CI**, no otra versión. Es la versión real de Neon
   (`infra/DESPLIEGUE-CLOUD.md` paso 1) — la misma lógica que ya llevó a fijar `region: ohio` en
   `render.yaml` para no probar contra algo distinto de producción.
6. **Reglas de lint sin type-checking** (`typescript-eslint` recomendado, no
   `recommendedTypeChecked`). Mantiene el pipeline simple y rápido, a la par del esfuerzo que ya
   tiene el linter de `front`. Si más adelante se quiere cazar bugs de promesas sin `await` en los
   repositorios Prisma, es una mejora incremental, no parte de este alcance.
7. **Shadow database para `migrate diff`**: una segunda base en el mismo contenedor `postgres:17`
   del job (el rol `postgres` por defecto tiene `CREATEDB`), no un segundo servicio Postgres
   dedicado. Más simple y no hay motivo a priori para esperar problemas de permisos con el rol por
   defecto del contenedor oficial. Confirmado en validación local: sin problemas de permisos.
8. **Servicio `mailpit` agregado al workflow, no previsto en el plan original.** Al validar
   localmente (paso obligatorio antes de confiar en el YAML) se descubrió que la mayoría de los
   tests de integración de `back` no se limitan a comprobar SMTP explícitamente: `POST
   /auth/register`, `forgot-password`, `reset-password` y la verificación de correo intentan una
   entrega SMTP real y responden 503 si falla (comportamiento documentado en
   `back/OVERVIEW.md`). Sin un servidor de correo alcanzable en `127.0.0.1:1025` (el host que usa
   `tests/auth-test.config.ts` por defecto), decenas de tests fallan, no solo los que piden
   `TEST_MAILPIT_API_URL`. Se agrega el servicio `mailpit` (misma imagen que
   `docker-compose.dev.yml`, `axllent/mailpit:v1.29.2`) con sus dos puertos (1025 SMTP, 8025 API),
   y `TEST_MAILPIT_API_URL` en el entorno del job. Efecto colateral positivo: deja de saltearse la
   única suite que antes se omitía por falta de esa variable, cumpliendo el criterio "0 salteados"
   de la sección 5 tal como estaba escrito.
9. **Paso `test` corre con `--no-file-parallelism`, no previsto en el plan original.** Validación
   local: con los archivos de prueba en paralelo (comportamiento por defecto de Vitest), las
   suites de integración que envían correo real compiten por el mismo `mailpit` del job y exceden
   el timeout SMTP configurado (1500 ms); eso produjo decenas de fallas 503 al correr todo en
   paralelo. Serializar por archivo evita esa saturación.
10. **`TEST_SMTP_TIMEOUT_MS: "8000"` en el entorno del job, no previsto en el plan original.**
    Incluso serializado, algunas corridas locales mostraron 1 a 3 tests fallando de forma
    intermitente por 503: medí directamente con `nodemailer` fuera de los tests que dos envíos
    SMTP concurrentes contra el mismo `mailpit` tardaron hasta ~2060 ms en este entorno (Windows +
    Docker Desktop), por encima del timeout de 1500 ms que usan los tests por defecto. No se tocó
    `back/src/` ni `back/tests/`: `tests/auth-test.config.ts:11` ya lee
    `TEST_SMTP_TIMEOUT_MS` como override pensado exactamente para esto
    (`process.env["TEST_SMTP_TIMEOUT_MS"] ?? "1500"`); seteé esa variable a 8000 ms únicamente en
    el entorno del job de `back.yml`, sin cambiar ningún archivo de código o de test. Alternativa
    descartada: bajar a un solo archivo de test vía más serialización o un `pool` con un worker —
    no ataca la causa (latencia SMTP real), solo la escondería peor y más lento. Confirmado con 3
    corridas completas de la suite en local con esta variable: 492/492 verdes, 0 salteados, las
    tres veces (sección 6).

## 5. Criterios de aceptación

**Automático:**
- `npm run lint --workspace=back` → exit 0.
- `npm run typecheck --workspace=back` → exit 0 (ya lo está; no debe romperse).
- `npm run test --workspace=back` con `TEST_DATABASE_URL` seteado → todos los tests corren (ninguno
  salteado por falta de la variable), todos verdes.
- `npm run build --workspace=back` → exit 0.
- `npx prisma migrate diff --from-migrations back/prisma/migrations --to-schema-datamodel
  back/prisma/schema.prisma --shadow-database-url <local> --exit-code` → exit 0 (sin diferencias)
  contra el HEAD de esta rama.
- El workflow `back.yml` corre en verde sobre el PR de este cambio en GitHub Actions (validación
  posterior a este commit local, al abrir el PR).

**Manual (para Tiago, después del PR):**
- Confirmar que el check de `back` aparece junto al de `front` en la lista de checks del PR.
- Editar a mano `back/src/` algo que rompa una regla del linter nuevo en un commit de prueba aparte
  (no mergear) y confirmar que `back.yml` falla; después descartar ese commit.
- Confirmar que no se rompió nada de `front`: su workflow sigue sin tocarse y sigue en verde.

## 6. Validación

Ejecutada el 2026-10-25 sobre `ci/back-lint-tests-migrate-check`, en local, con un contenedor
`postgres:17` descartable (puerto publicado distinto del Postgres de desarrollo) y el `mailpit`
ya corriendo del stack de desarrollo (misma imagen `axllent/mailpit:v1.29.2` que usa
`docker-compose.dev.yml` y que el workflow nuevo agrega como servicio).

| Comando | Resultado |
|---|---|
| `npm run lint --workspace=back` | Exit 0. 4 hallazgos reales (`no-control-regex`), los cuatro justificados con `eslint-disable-next-line` (detalle abajo). |
| `npm run typecheck --workspace=back` | Exit 0. |
| `npx prisma migrate diff --from-migrations back/prisma/migrations --to-schema-datamodel back/prisma/schema.prisma --shadow-database-url <shadow local> --exit-code` | Exit 0, "No difference detected." |
| `npm run db:deploy --workspace=back` contra la base de prueba | 8 migraciones aplicadas sin error. |
| `npm run test --workspace=back -- --no-file-parallelism` con `TEST_DATABASE_URL`, `TEST_MAILPIT_API_URL` y `TEST_SMTP_TIMEOUT_MS=8000` seteados | 3 corridas completas, independientes, con la base de datos truncada entre cada una: **492/492 verdes, 0 salteados, las tres veces.** Antes de agregar `TEST_SMTP_TIMEOUT_MS`, con el timeout por defecto (1500 ms), 1 a 3 tests fallaban de forma intermitente por 503 (ver decisión 10). |
| `npm run build --workspace=back` | Exit 0, `dist/` generado. |
| Workflow `back.yml` en un PR real de GitHub Actions | Pendiente — se confirma al abrir el PR (paso 5, fuera de este commit local). |

### Hallazgos de lint (4, los cuatro justificados)

Seguimiento del 2026-10-26 (TASK-055): `back/src/auth/email.config.ts` incorporó
otra validación deliberada de caracteres de control para la configuración de
correo. Se agregó la misma excepción puntual `no-control-regex` con motivo.
Lint de ambos workspaces: exit 0, sin errores ni advertencias; pruebas de
configuración del proveedor de correo: 13/13 aprobadas. Este seguimiento no
cierra las verificaciones pendientes de CI de TASK-036.

Los cuatro son la misma regla, `no-control-regex`, sobre regex de validación de entrada que
rechazan caracteres de control deliberadamente (NUL, DEL, C0/C1): no son errores de tipeo, son el
comportamiento buscado. Se agregó `// eslint-disable-next-line no-control-regex -- <motivo>` en
cada línea:

- `back/src/academic/application/materia-input.ts:33` (filtro de búsqueda de materias).
- `back/src/auth/auth.config.ts:41` (validación de variables de entorno de autenticación).
- `back/src/auth/domain/registration-input.ts:12` (validación de email de registro).
- `back/src/auth/smtp.config.ts:20` (validación de variables de entorno SMTP).

### Latencia SMTP hacia `mailpit` en este entorno (resuelto con `TEST_SMTP_TIMEOUT_MS`)

Varios tests de integración de `back/tests/` (registro, verificación de correo, recuperación de
contraseña) envían un correo real contra `mailpit` y fallan con 503 si la entrega no se confirma
dentro del timeout SMTP. En este entorno (Windows + Docker Desktop) medí directamente con
`nodemailer`, fuera de los tests, que dos envíos SMTP concurrentes contra el mismo `mailpit`
tardaron 1064 ms y 2059 ms — por encima del default de 1500 ms que usan los tests
(`tests/auth-test.config.ts:11`). Con el default, corridas completas con `--no-file-parallelism`
dieron 491/492, 489/492 y 491/492 verdes: siempre fallando por 503 en un flujo que depende de SMTP
real, nunca por los cambios de este commit (ningún archivo de `back/src/` ni `back/tests/` tocado
para esto).

Se fijó `TEST_SMTP_TIMEOUT_MS: "8000"` solo en el entorno del job de `back.yml` (decisión 10):
holgado a propósito para absorber la contención de un único `mailpit` compartido por 22 archivos
de test, sin tocar código ni tests. Confirmado con 3 corridas completas e independientes (base de
datos truncada entre cada una) contra el mismo contenedor Postgres/mailpit descartables:
**492/492 verdes, 0 salteados, las tres veces.**

### Dependencias agregadas

`eslint` ^9.39.5 (misma mayor que `front`) y `typescript-eslint` ^8.72.0, ambas de desarrollo.
`@eslint/js` no se agregó como dependencia directa: ya es una dependencia transitiva de `eslint`
9.x (resuelta como `9.39.5` en este repo) y se usa igual que en cualquier config de
`typescript-eslint` sin tipos.
