# TASK-036: Linter, CI y check de migraciones para `back`

Estado: En curso.
Fecha: 2026-10-25

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
   defecto del contenedor oficial.

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

(Se completa durante la implementación, con la salida real de cada comando.)
