# T3 — Acciones HTTP de autor y administración

Fecha: 2026-11-17. Autorizada exclusivamente T3 y sus pruebas. Sin commits, push, frontend,
reportes, clasificadores, despliegue, dependencias nuevas ni cambios de arquitectura general.
Estado: completada y validada. Detenerse antes de T4.
Referencia: [plan incremental](../in-progress/TASK-moderacion-reportes-incremental.md).

## Inspección previa y decisiones

Git limpio en `461f9c5`; T2 registrada en `5096112`, `1d71181`, `3904324`, `461f9c5`.
Sin MERGE_HEAD, CHERRY_PICK_HEAD, REVERT_HEAD, rebase ni sequencer. T1: `2f619db`.
Reutilizar transitionFeedbackModeration, transitionModeration y syncMateriaVote con sus
bloqueos comisión -> comentario -> par autor/materia, snapshots y ledger correlacionados.

- GET `/feedback/propios`: sesión, paginación hasta nueve, creación/id descendente, sin bajas,
  todos los estados; proyección propia con contexto histórico y metadatos de moderación.
- GET `/admin/feedback`: ADMIN, mismo orden/paginación, `estado` opcional con default PENDIENTE.
  Cola derivada de Feedback sin tabla adicional. Detalle: `/admin/feedback/:id/detalle` existente.
- POST `/feedback/:id/ocultar`, `/restaurar`, `/revision`: body estricto `{versionEsperada}`,
  actor/acción determinados por sesión/ruta; respuesta 200 con estado de moderación.
- POST `/admin/feedback/:id/moderacion`: ADMIN, body estricto
  `{accion: APROBACION|RECHAZO|OCULTAMIENTO_ADMIN|RESTITUCION_ADMIN,versionEsperada,motivo}`.
  Respuesta 200. Motivo normalizado obligatorio 1–1000, sin controles.
- PATCH existente admite `versionEsperada` opcional para compatibilidad con clientes actuales;
  si falta, usar versión leída al iniciar la operación y revalidar bajo bloqueo. Igual control
  interno en DELETE existente. Una versión enviada obsoleta produce 409 incluso sin cambios.
- Corrección RECHAZADO usa el snapshot persistido sin exigir contexto académico activo;
  restantes ediciones y altas conservan validaciones vigentes. Nunca cambiar destino académico.
- El pedido T3 reemplaza la restricción anterior de restitución voluntaria: puede levantar
  exclusivamente ocultoAutor aunque haya otras causas activas; la política pública sigue ocultando.
- Detalle/consulta propios incorporan estado/versión/motivo seguro; historial privado omite
  motivos internos de aprobación/ocultamiento. ADMIN ve decisiones mediante ledger existente.
- Guards, Origin/CSRF, no-store y errores de dominio existentes; ningún cambio en autenticación.

## Aceptación y validación

Pruebas primero donde sea viable: contratos estrictos, roles, anonimato, bajas, estados,
revisión con texto distinto del último rechazo, contexto cerrado, no-op, conflictos concurrentes,
rollback de ledger, correlación de auditoría y valoraciones públicas. Regresiones T1/T2.
PostgreSQL y Mailpit desechables exclusivamente para pruebas, suite global serial con base aislada.
Typecheck, lint, build backend y git diff --check. Registrar originales y reejecuciones.
Actualizar ficha, plan, back/OVERVIEW.md y CHANGELOG.md; detenerse al terminar T3.

## Resultados

Implementación y validación completas.

### Archivos y comportamiento

- `back/src/reviews/reviews.controller.ts`: seis rutas nuevas; estáticas antes de `:id`,
  guards de sesión/rol existentes, no-store y códigos 200 explícitos de acciones.
- `application/feedback-input.ts`, `feedback.service.ts`, `ports/feedback.repository.ts`:
  DTO estrictos Zod, normalización/validación y conexión a la transición existente.
- `domain/feedback.ts`: tipo privado FeedbackOwn y metadatos seguros del historial del autor;
  `domain/feedback-moderation.ts`: restitución exclusivamente de la causa del autor.
- `infrastructure/prisma-feedback.repository.ts`: consulta propia y cola por estado,
  RepeatableRead para total/página, versión en edición/baja, corrección histórica de rechazados.
- `back/src/administration/admin-detail.service.ts`: lista permitida específica de campos de
  moderación/valoraciones para el historial existente, con actor real y justificación.
- `back/tests/feedback-actions.spec.ts`, `feedback-actions.integration.spec.ts`: contratos y HTTP
  real. `feedback-update.spec.ts`: dos casos adicionales de versión implícita/obsoleta.
- `feedback-moderation.spec.ts`, `feedback-moderation.integration.spec.ts`: adaptación explícita
  de dos expectativas T1 a restitución de autor con otras causas. No se cambian timeouts.
- `tests/support/moderation-harness.ts`: expone URL del servidor para probar CSRF sin mocks.
- Documentación: ficha T3, plan, `back/OVERVIEW.md`, `CHANGELOG.md`.

### Evidencia focalizada y comprobación manual

- RED inicial antes de producto: `feedback-actions.spec.ts` 7 fallidas/22 aprobadas de 29,
  por validadores/métodos ausentes y versión todavía no admitida en PATCH.
- GREEN con PostgreSQL real: acciones unitarias 29/29, acciones HTTP 30/30, dominio T1 33/33,
  repositorio T1 real 9/9; **101/101 en cuatro archivos**, exit 0, 48.34 s.
- Edición: **22/22**, incluidas dos pruebas nuevas de versión inicial implícita y conflicto
  explícito aun sin cambios. Total focalizado: **123/123**.
- Casos HTTP: autor/tercero/ADMIN/ADMIN autor, anónimos, bajas, todos los estados, CSRF/sesión,
  no-op, privacidad comunitaria e interna, causas múltiples, contexto académico cerrado,
  rechazo/retirar/recrear, versión vieja, dos administradores, aprobación/edición,
  ocultamiento/rechazo y solicitudes de revisión simultáneas. Las carreras tienen un ganador
  y 409 para la versión perdedora; nunca se publica una corrección sin revisión humana.
- Rollback HTTP real mediante trigger solo en esquema aleatorio de prueba: fallo del ledger
  revierte estado, versión, snapshot y voto. Se verifica el actor de sesión y la correlación
  snapshot/AdministracionHistorial por UUID, sin ledger nuevo ni eventos duplicados.
- Comprobación manual con peticiones HTTP sobre `back/dist` compilado y otra base desechable:
  alta pendiente -> aprobación/voto -> ocultar -> restaurar -> rechazo -> corrección con
  comisión dada de baja -> solicitud pendiente. Versión obsoleta devuelve 409; siete snapshots
  correlacionados con siete eventos; voto retirado al quedar privado. Exit 0.
- Primer chequeo de tipos/lint de pruebas nuevas detectó un array sin anotación y un import
  sobrante. Corregidos únicamente en las pruebas; reejecución typecheck/lint exit 0.
- `npm run typecheck --workspace=back`, `npm run lint --workspace=back`,
  `npm run build --workspace=back` y `git diff --check`: aprobados. Build regenera Prisma
  sin modificar schema ni migraciones; Node 22.22.3.
- Primera y única suite global T3 serial: **1473/1473 pruebas, 66/66 archivos**, exit 0,
  289.10 s. Base nueva t3_global, PostgreSQL/SMTP reales, ninguna integración omitida.
  Incluye regresiones T1/T2, migraciones, autores, administración, visibilidad, estadísticas,
  interacciones, rankings y autenticación. No hubo fallos globales que requirieran reejecución.

### Infraestructura y comandos

PostgreSQL 16.15 y Mailpit v1.32.0 desechables, sin montar volúmenes del usuario ni descargar
imágenes. 26 migraciones existentes aplicadas en bases nuevas separadas para focalizadas,
manual y global; no se aplicaron sobre datos del usuario. Los tests de moderación reproducen
además las migraciones en esquemas propios aleatorios y los retiran al terminar.
Al cerrar se detuvieron y retiraron únicamente `butchery-t3-postgres` y `butchery-t3-mailpit`;
no quedan servicios ni bases de esta validación ejecutándose.

Focalizada: `npm run test --workspace=back -- tests/feedback-actions.spec.ts
tests/feedback-actions.integration.spec.ts tests/feedback-moderation.spec.ts
tests/feedback-moderation.integration.spec.ts --no-file-parallelism` (una invocación).
Edición: `npm run test --workspace=back -- tests/feedback-update.spec.ts`.
Global: `npm run test --workspace=back -- --no-file-parallelism`, con TEST_DATABASE_URL exclusiva,
TEST_MAILPIT_API_URL y TEST_SMTP_PORT del buzón desechable. Sin aumentar timeouts ni cambiar CI.

### Límites y preparación para T4

Sin frontend, reportes, umbral preventivo, clasificadores, M1.3, nuevas dependencias, migraciones,
despliegue, commits ni push. Las causas independientes y la sincronización transaccional quedan
disponibles para la etapa futura, sin activar escritores de reportes ni permisos de T4/T5.
La versión opcional del PATCH mantiene clientes anteriores: detecta carreras durante la petición,
pero para detectar un formulario abierto antes de la petición el cliente debe enviar versionEsperada.
La integración visual de estados/acciones queda para T6. Detenerse tras T3 y esperar autorización.

T3 cumple aceptación, sin fallos funcionales pendientes detectados. Las pruebas no sustituyen
una verificación futura de UI ni autorizan despliegue. Mensaje sugerido, sin ejecutarlo:
`feat(moderacion): expone acciones de autor y administración`

## Cierre local autorizado

Posteriormente el usuario autorizó ejecutar el commit de T3. Esta autorización reemplaza
exclusivamente la restricción inicial de no realizar commits; no autoriza push ni avanzar a T4.
Se revisan los 18 archivos de implementación, pruebas y documentación como una única etapa,
con `git diff --cached`, `git diff --cached --check` y regresión unitaria focalizada antes del commit.
La reejecución previa al commit de feedback-actions, feedback-moderation y feedback-update
aprobó **84/84 pruebas en tres archivos**, exit 0, 1.52 s. No se repitieron integraciones;
la global 1473/1473 corresponde al mismo contenido funcional final.
