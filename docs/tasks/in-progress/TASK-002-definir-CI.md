# TASK-002: CI obligatoria para PR a desarrollo y main

Estado: En curso; implementación y validación local completas, aceptación remota pendiente.
Fecha de actualización: 2026-10-26.

## Objetivo

Ejecutar tests y typecheck de backend y frontend en cada PR hacia `desarrollo`
y `main`, y exigir los checks exitosos antes del merge.

## Estado previo y relación con TASK-036

El contexto de Trello del 2026-10-10 (sin CI y conteos antiguos de tests) es histórico.
Ya existen `back.yml` y `front.yml`. TASK-036 implementó lint y CI de backend,
PostgreSQL 17, Mailpit, migraciones y detección de deriva; conserva evidencia local,
pero su aceptación remota sigue pendiente. Excluyó expresamente branch protection.
TASK-055 resolvió un hallazgo posterior de lint en la configuración de correo.

TASK-002 reutiliza esos workflows y completa su cobertura de PR, los checks
obligatorios y la documentación del equipo. No vuelve a configurar el linter ni
repite las verificaciones de migraciones implementadas en TASK-036.

## Alcance y decisiones previas a implementar

- Mantener los dos workflows por las distintas necesidades de preparación.
- Ejecutar ambos en cada PR a `desarrollo` y `main`, sin filtros por archivos.
- Usar jobs únicos `backend-ci` y `frontend-ci` para seleccionar checks sin ambigüedad.
- Quitar los triggers de push: el control pedido es sobre PR, evitando repetir
  las verificaciones después del merge. Conservar Node desde `.nvmrc` y `npm ci`
  desde la raíz con el lockfile compartido.
- Conservar typecheck, lint, tests, builds y la preparación de integración existente.
- Documentar el DoD, la selección de checks obligatorios y la prueba negativa.
- Revisar las reglas existentes antes de cambiar protecciones, preservando revisiones
  y demás restricciones. Se requieren permisos administrativos de GitHub.

## Exclusiones y restricciones

Sin dependencias nuevas, Docker builds, Playwright en CI, despliegues, cambios de
producto ni cambios a autenticación. No crear tests permanentes artificiales.
El desarrollador autorizó el commit local de los cambios revisados. No hacer
push automáticamente. La apertura del PR corresponde al
desarrollador según la política del repositorio. No cerrar TASK-036 ni TASK-002
sin la evidencia remota correspondiente.

## Criterios de aceptación

- Ambos checks ejecutan typecheck, lint, tests y build en cada PR hacia ambas ramas,
  incluso en un PR que cambie solo documentación.
- Las suites de integración backend se ejecutan con PostgreSQL y Mailpit,
  sin omisiones por falta de sus variables de entorno.
- Los dos checks se exigen para mergear a `desarrollo` y `main`.
- Ambos checks terminan en verde en una PR de prueba.
- Un test fallido produce un check fallido y bloquea el merge; después de
  corregirlo, ambos checks vuelven a verde. Por decisión del desarrollador,
  esta comprobación se difiere hasta que ocurra un fallo durante el desarrollo,
  sin introducir ahora una falla artificial.
- La guía del equipo establece que pasar en CI es obligatorio en el DoD.

## Validación prevista

Revisar sintaxis YAML y contrato de triggers/jobs/pasos, ejecutar los comandos
afectados cuando el entorno local lo permita, y revisar `git diff --check`.
Registrar las limitaciones sin presentar pruebas locales como evidencia remota.
Usar el procedimiento de `CONTRIBUTING.md` para la PR y la protección de ramas.

## Evidencia

### Validación local del 2026-10-26

Rama: `ci/verificaciones-pr`, basada en el ajuste de lint `cd1b999`.
Node 22.17.0 y npm 10.9.2 en el host; Node no coincide con el 22.22.3 oficial.
Sin dependencias nuevas ni cambios en código de aplicación o tests.

| Verificación | Resultado |
|---|---|
| Comprobación previa de cobertura de PR | Falló como se esperaba por los filtros `paths` originales. |
| Parseo YAML con `js-yaml` instalado y aserciones de contrato después del ajuste | Exit 0: ambos destinos, sin filtros ni push, jobs únicos, permisos de lectura, Node desde `.nvmrc`, comandos requeridos y servicios de integración presentes; sin `continue-on-error`. |
| `npm run db:generate --workspace=back` | Exit 0. |
| `npm run typecheck --workspace=back` | Exit 0 tras regenerar Prisma; el primer intento detectó un cliente local desactualizado. El workflow ya genera antes de typecheck. |
| `npm run typecheck --workspace=front` | Exit 0. |
| `npm run lint --workspaces` | Exit 0 en ambos workspaces, sin errores ni advertencias. |
| `npm run db:deploy --workspace=back` contra la base temporal | 11 migraciones aplicadas correctamente. |
| `prisma migrate diff` entre migraciones y schema con shadow temporal y `--exit-code` | Exit 0, `No difference detected.` |
| `npm run test --workspace=back -- --no-file-parallelism` | Exit 0, 28 archivos y 651 tests aprobados, sin omitidos. |
| `npm run test --workspace=front` | Exit 0, 36 archivos y 281 tests aprobados. |
| `npm run build --workspace=back` | Exit 0. |
| `npm run build --workspace=front` con `NEXT_PUBLIC_API_URL=https://api.example.invalid` | Exit 0. |
| `git diff --check` y revisión manual del diff | Exit 0; solo configuración CI y documentación. |

Integración validada con imágenes locales `postgres:17.11-bookworm` (misma mayor
17 del workflow) y `axllent/mailpit:v1.29.2`, en los contenedores exclusivos
`task002-ci-postgres` y `task002-ci-mailpit`, sin volúmenes del proyecto. Base de
pruebas y shadow creadas únicamente en ese PostgreSQL. Se usaron
`TEST_DATABASE_URL`, `TEST_MAILPIT_API_URL` y `TEST_SMTP_TIMEOUT_MS=8000` como en CI.
Ambos contenedores se detuvieron y retiraron al finalizar.

### Revisión remota y pendientes

- Existe evidencia histórica de backend en verde en una
  [PR anterior](https://github.com/Tiaguito-dev/2026-UTN-GRUPO-01/actions/runs/40235366580).
- La [PR posterior](https://github.com/Tiaguito-dev/2026-UTN-GRUPO-01/actions/runs/40237412336)
  falló en lint por `back/src/auth/email.config.ts:22`, regla `no-control-regex`;
  sus pasos de migraciones y typecheck pasaron. Los logs confirman que es el
  hallazgo resuelto localmente en `cd1b999` (TASK-055).
- La consulta autenticada de protección de ambas ramas devolvió HTTP 403,
  `Resource not accessible by integration`; la conexión disponible no permite
  verificar ni administrar esos checks obligatorios. No se alteraron protecciones.
- Pendiente publicar estos cambios y abrir manualmente una PR para comprobar
  los checks nuevos y las integraciones en el runtime oficial de CI.
- Pendiente exigir ambos checks en ambas ramas. La comprobación del bloqueo con
  un test fallido se difiere por decisión del desarrollador hasta un fallo durante
  el desarrollo, seguido de verde tras corregirlo. No se introducirá un fallo
  artificial para este commit. La evidencia histórica no sustituye esta aceptación.

La tarea permanece en `in-progress`; la validación local no satisface por sí sola
el entregable de bloqueo de merge en GitHub.
