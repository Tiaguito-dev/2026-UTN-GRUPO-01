# T4 — Sistema de reportes de experiencias

Autorización exclusiva T4 y pruebas. T3 cerrada en `2835d55`; árbol limpio,
sin merge, cherry-pick, revert, rebase ni sequencer pendientes. Sin commits ni push.
Estado: completada y validada. Detenerse antes de T5/T6.

## Alcance y aceptación

Reportar experiencias públicas ajenas con sesión; consulta y cierre ADMIN dentro de
ReviewsModule. Migración nueva, evidencia histórica, auditoría atómica, privacidad,
unicidad y cuota PostgreSQL. Sin frontend, dependencias, T5/T6, cambios M1.3,
despliegue, visibilidad automática ni efectos en interacciones o estadísticas.

## Decisiones previas a implementación

- FeedbackReporte: denunciante, feedback, versionReportada (versionModeracion del
  servidor), historialId explícito, motivo enum, descripción opcional, estado,
  creación, resolución, administrador y justificación. FK compuesta a snapshot del
  mismo feedback; no copiar textos. La evidencia se verifica contra texto,
  anonimato y puntuación bajo bloqueo del feedback; snapshots legados sin versión
  pueden anclar contenido idéntico. Una evidencia ausente impide reportar con 409,
  nunca se inventa una versión histórica. Verificar esta garantía con integración.
- POST /feedback/:id/reportes: body estricto {motivo,descripcion?}, 201 nuevo,
  200 reintento idéntico; identidad y versión de sesión/servidor. Único por
  denunciante/feedback/versión. Payload normalizado diferente para la misma clave:
  409, incluso cerrado. No reapertura. Solo experiencias visibles ajenas, 404
  para contenido privado; 403 autorreporte visible.
- Máximo cinco creaciones por diez minutos móviles, incluidas ya cerradas.
  Advisory lock PostgreSQL por denunciante, luego comisión -> feedback; reintento
  antes de cuota. Reloj PostgreSQL leído después del lock. Todas las escrituras
  toman el mismo lock de feedback; cierre toma comisión -> feedback -> reporte.
  No locks User, evitando invertir jerarquías de autenticación.
- GET /admin/feedback-reportes: ADMIN, page/pageSize hasta nueve, estado/motivo/
  feedbackId opcionales, creación/id descendente, total y datos RepeatableRead.
  GET /admin/feedback-reportes/:id: evidencia, contexto académico persistido,
  situación actual separada, resoluciones anteriores paginadas de tres.
- POST /admin/feedback-reportes/:id/resolucion: {estado:RESUELTO|DESESTIMADO,
  motivo}, obligatorio normalizado 1–1000 sin controles; solo ABIERTO, 409 cerrado,
  un ganador concurrente. Registro y AdministracionHistorial atómicos; no cambiar
  moderación. Entidad del ledger feedbackReporte, acción CREACION/RESOLUCION/DESESTIMACION.
- Conteo T5: usuarios distintos con ABIERTO entre todas las versiones; consultar
  desde la misma transacción tras bloquear Feedback. Sin activar ocultoReportes.
- Respuesta al denunciante con campos propios explícitos, sin identidad del autor
  ni otros denunciantes. ADMIN recibe datos de reporte; ninguna lectura pública
  agrega reportes. Guards, CSRF/Origin y no-store existentes.

## Validación prevista

Testing delegado según .agents/OVERVIEW.md: contratos y HTTP/PostgreSQL reales,
permisos/CSRF, versiones, unicidad, concurrencia, cuota, cierre, rollback/auditoría,
anonimato y ausencia de efectos. RED antes de implementar; regresiones T1–T3.
Servicios desechables separados de datos del usuario; suite focalizada y global
serial con PostgreSQL/SMTP, typecheck, lint, build, diffcheck. Registrar resultados
reales y limitaciones. Actualizar plan, back/OVERVIEW.md y CHANGELOG.md.

## Implementación

- `back/prisma/schema.prisma`: enums y FeedbackReporte, relaciones User/Feedback y
  FK compuesta a FeedbackHistorial; unicidad e índices de consulta/cuota.
- `back/prisma/migrations/20261117020000_feedback_reportes/migration.sql`: DDL
  transaccional, checks de versión/descripción/cierre y ampliación de entidades
  admitidas por AdministracionHistorial. No altera migraciones anteriores ni datos
  de experiencias. Aplicada solo a PostgreSQL desechable.
- `back/src/reviews/domain/feedback-reporte.ts`: tipos de recibo, administración,
  detalle, contexto y conteos, separados de la situación actual de Feedback.
- `back/src/reviews/application/feedback-reporte-input.ts`: contratos Zod estrictos,
  validaciones y normalización; `feedback-reporte.service.ts`: servicio y errores;
  `ports/feedback-reporte.repository.ts`: puerto de persistencia.
- `back/src/reviews/infrastructure/prisma-feedback-reporte.repository.ts`: bloqueos,
  cuota móvil, idempotencia, snapshots por referencia, conteos agrupados, consultas
  RepeatableRead, cierre y ledger atómicos. countFeedbackReportesAbiertos queda
  disponible para T5 con precondición de bloqueo Feedback en decisiones.
- `back/src/reviews/feedback-reportes.controller.ts` y `reviews.module.ts`: cuatro
  endpoints en el módulo existente, guards actuales, no-store y códigos 201/200.
- `back/tests/feedback-reportes.spec.ts` y `feedback-reportes.integration.spec.ts`:
  contratos, servicios, HTTP y PostgreSQL reales. No se modifican tests T1–T3.
- Documentación: esta ficha, plan incremental, back/OVERVIEW.md y CHANGELOG.md.

La inspección confirmó snapshots en los escritores de creación, edición, baja,
moderación y seed existentes. La FK explícita fija contenido sin inferir metadatos
históricos ausentes. La prueba de corrupción elimina el snapshot en un esquema
propio y verifica 409 sin reporte ni cuota/evento, evitando evidencia inventada.
Los campos académicos de Feedback son snapshots existentes y su destino no puede
cambiar; se reutilizan como contexto. No se requiere otra entidad de evidencia/cola.

## Evidencia de validación

- RED unitario antes del producto: módulo de validación inexistente (exit 1).
  GREEN final: 55 unitarias y 31 HTTP/integración, **86/86**, exit 0, 29.49 s.
- Primera integración: 26/26 fallaron por deserialización del retorno void del
  advisory lock. Corregido mediante cast PostgreSQL a text.
- Segunda focalizada: 63 aprobadas/23 fallidas por CHECK del ledger que todavía
  no admitía feedbackReporte. Se amplía solo desde la migración T4, conservando
  todas las entidades previas. Tercera: 84 aprobadas/2 fallidas; las expectativas
  usaban GET privado de autor para lectura comunitaria. Se corrigieron las pruebas
  para usar el listado comunitario por comisión, sin cambiar autorizaciones.
- Final focalizada: `npm run test --workspace=back -- tests/feedback-reportes.spec.ts
  tests/feedback-reportes.integration.spec.ts --no-file-parallelism`, con
  TEST_DATABASE_URL exclusiva de t4_focus. Ninguna integración omitida.
- Casos reales: permisos/CSRF, motivos/descripción, matrices de visibilidad,
  duplicados normalizados, payload diferente 409, concurrencia con edición,
  varios usuarios sin umbral, cuota cinco de ocho solicitudes, reintentos fuera
  de cuota, cierre no libera cuota, ventana móvil, dos clientes Prisma/pools
  independientes, legado sin versión, edición/reaprobación y evidencia original,
  conteo entre versiones y cierres 2/1 -> 1/1 -> 0/0, páginas/filtros/orden,
  privacidad comunitaria y del autor, resoluciones justificadas/carrera ADMIN,
  rollback mediante trigger de ledger, FK compuesta y restricciones PostgreSQL.
  Se comprueba conservación de likes, respuestas y votos reales y snapshots.
- Comprobación manual mediante peticiones HTTP a `back/dist` compilado en
  t4_manual: creación 201 -> reintento 200 mismo ID -> autor sin acceso ADMIN 403
  -> edición 200 pendiente -> evidencia original ADMIN 200 -> desestimación 200
  -> segundo cierre 409. Dos eventos de reporte, sin activar ocultoReportes ni
  alterar la moderación del contenido. El script temporal ajustó un ID de sesión
  obligatorio del fixture y se retiró tras la comprobación.
- Typecheck, lint backend completo y build: exit 0. diffcheck: exit 0.
  Node 22.22.3; sin dependencias ni cambios de timeouts/configuración de tests.
- Primera y única suite global tras las correcciones focalizadas: **1559/1559
  pruebas, 68/68 archivos**, exit 0, 283.99 s. Incluye regresiones T1/T2/T3,
  administración, migraciones, experiencias, feed, interacciones, rankings,
  valoraciones, autenticación y SMTP; ninguna integración omitida.
- Global: `npm run test --workspace=back -- --no-file-parallelism`, con
  TEST_DATABASE_URL exclusiva t4_global_final, TEST_SMTP_PORT y
  TEST_MAILPIT_API_URL de servicios desechables. Log local ignorado:
  `.tmp/t4-global.log`. Base nueva con las 27 migraciones finales, sin usar
  servicios ni volúmenes del usuario. La base t4_global inicial solo comprobó
  la primera versión DDL; la global usó otra base nueva tras ampliar el ledger.
- Infraestructura: PostgreSQL 16.15 y Mailpit v1.32.0 de imágenes locales, sin
  descargas ni volúmenes persistentes montados. Al cerrar se retiran solamente
  los contenedores creados por esta tarea: butchery-t4-postgres y butchery-t4-mailpit.
  No quedan servicios ni bases de esta validación ejecutándose.
- Comandos estáticos: `npm run typecheck --workspace=back`,
  `npm run lint --workspace=back`, `npm run build --workspace=back`,
  `git diff --check`. Todos aprobados.

## Límites y riesgos

No se aplicó migración a datos del usuario. Sin frontend, T5/T6, umbral preventivo,
restitución por reportes, cambios M1.3, clasificadores, despliegue, commits o push.
El conteo futuro debe ejecutarse bajo el mismo bloqueo Feedback para decidir una
transición atómica; leer la bandeja no autoriza a decidir con un conteo anterior.
La ausencia de snapshot por corrupción/escrituras externas se trata como conflicto
seguro y requiere recuperar evidencia; no se fabrica historia ni se duplica texto.
El advisory lock tiene alcance de base PostgreSQL y no requiere Redis. Desacoplar
reportes a otro almacenamiento en el futuro requerirá preservar esta coordinación.
No hay validación visual de frontend porque está expresamente fuera de T4.

Mensaje sugerido, sin ejecutar:
`feat(reportes): agrega denuncias de experiencias y resolución auditada`

## Ajuste T4 — Identidad y trazabilidad de denunciantes

Pedido posterior del usuario, limitado a T4; sin commits, push ni T5/T6.
Se conservan los cambios T4 existentes sin registrar y los contratos vigentes.

Decisiones antes de implementar:

- Cada reporte mantiene denuncianteId obligatorio con FK a User, obtenido de la
  sesión. Ningún payload puede reemplazar esa identidad.
- El detalle GET /admin/feedback-reportes/:id agrega a reporte el objeto
  denunciante: {id,displayName}. Usa la misma selección explícita id/displayName
  de las proyecciones administrativas existentes. No selecciona ni devuelve
  contraseñas, sesiones, tokens, credenciales ni email. El nombre corresponde
  al nombre actual de la cuenta; no se inventa un nombre legal ni histórico.
- Los campos y las rutas anteriores permanecen disponibles. Listado, recibos
  de creación/reintento y respuesta de cierre conservan sus contratos. El detalle
  administrativo ya permite consultar motivo, descripción, fechas, resoluciones
  anteriores de la experiencia y evidencia. No se agrega un historial global de
  denunciantes ni un sistema de evaluación de su conducta.
- Autor y otros usuarios no acceden al detalle administrativo. El anonimato de
  una experiencia se mantiene en la comunidad sin suprimir referencias internas
  para la trazabilidad autorizada. El cierre conserva denunciante, administrador,
  fecha, justificación y evidencia, incluso después de una baja lógica de cuenta.
- DESESTIMADO es una decisión sobre el reporte; no presume mala fe, no sanciona
  ni modifica reputaciones o permisos. No incorporar automatismos de T5/T6.

Aceptación y validación: pruebas específicas primero (RED), luego selección segura en detalle;
regresión focalizada HTTP/PostgreSQL, global serial aislada, typecheck, lint,
build y diffcheck. Documentar resultados del ajuste separados de la validación
inicial de T4; retirar servicios desechables al terminar.

Implementación del ajuste:

- `back/src/reviews/domain/feedback-reporte.ts`: el tipo del detalle agrega
  denunciante al reporte; los tipos del listado, recibos y cierres no cambian.
- `back/src/reviews/infrastructure/prisma-feedback-reporte.repository.ts`: get
  selecciona únicamente User.id/displayName y devuelve ambos campos explícitamente
  en reporte.denunciante. Las demás consultas y mutaciones no se modifican.
- `back/tests/feedback-reportes.integration.spec.ts`: siete pruebas específicas
  de autorización, proyección segura, nombres actuales, cierres/cuentas inactivas,
  ausencia de sanciones, filtraciones públicas y asociación obligatoria a sesión.
- Ficha T4, plan incremental, back/OVERVIEW.md y CHANGELOG.md actualizados.
  No hay cambios de schema, migraciones o dependencias para este ajuste.

Evidencia inicial del ajuste:

- RED de los siete casos nuevos con PostgreSQL real: seis fallidos por ausencia
  de reporte.denunciante y uno de privacidad aprobado, exit 1, 17.01 s. Los 31
  casos anteriores quedaron excluidos deliberadamente por filtro `-t 'identidad T4'`;
  no se omitieron por falta de servicio. Luego se agregó la proyección segura.
- Typecheck, lint completo, build y diffcheck: exit 0.
- Focalizada final del ajuste: **93/93**, dos archivos, exit 0, 28.12 s: 55
  unitarias y 38 integraciones HTTP/PostgreSQL reales (31 originales y siete
  nuevas). Comando: `npm run test --workspace=back -- tests/feedback-reportes.spec.ts
  tests/feedback-reportes.integration.spec.ts --no-file-parallelism`, con
  TEST_DATABASE_URL de t4_identity_focus. Ninguna integración omitida.
- Comprobación manual con HTTP sobre el compilado y base t4_identity_manual:
  reporte 201 sin identidad en recibo; detalle autor/denunciante 403; ADMIN 200
  con id/displayName y sin email; experiencia pública sigue anónima, sin identidad
  del denunciante; desestimación 200 conserva denunciante/ADMIN/fecha y no
  desactiva la cuenta. Exit 0. Script temporal retirado al finalizar.
- Global final del ajuste: **1566/1566 pruebas, 68/68 archivos**, exit 0,
  265.61 s. Primera y única global de este ajuste, sin integraciones omitidas,
  con PostgreSQL/SMTP reales y regresiones T1/T2/T3 incluidas. Comando:
  `npm run test --workspace=back -- --no-file-parallelism`, con
  TEST_DATABASE_URL exclusiva t4_identity_global, TEST_SMTP_PORT y
  TEST_MAILPIT_API_URL desechables. Log local ignorado:
  `.tmp/t4-identity-global.log`. La focalizada coincidió brevemente con la global,
  con bases y esquemas separados; los archivos permanecieron congelados y ambas
  ejecuciones terminaron aprobadas. Se observó aviso deprecatorio no fatal de pg
  sobre consultas concurrentes, sin errores de pruebas ni cambios de dependencias.
- Las 27 migraciones existentes se aplicaron a una base nueva exclusivamente
  de pruebas; no se agrega ni modifica migración para este ajuste. PostgreSQL
  16.15 y Mailpit v1.32.0 desechables, sin descargas ni volúmenes del usuario.
  Se retiraron únicamente butchery-t4-identity-postgres y
  butchery-t4-identity-mailpit junto a sus volúmenes desechables; no quedan
  servicios de esta validación ejecutándose.

Ajuste completado. Asociación obligatoria y cierres trazables preservados; nombre
de cuenta visible únicamente en detalle ADMIN con selección segura. No quedan
fallos funcionales detectados. Sin frontend, T5/T6, umbral, sanciones, reputaciones,
commits, push o despliegue. Mensaje sugerido para el ajuste, sin ejecutar:
`feat(reportes): incorpora identidad administrativa del denunciante`

## Cierre local autorizado

Posteriormente el usuario autorizó ejecutar los commits de esta etapa. Reemplaza
únicamente la restricción de commits locales: no autoriza push, despliegue o T5/T6.
Se registra T4 y su ajuste de identidad como un único cambio del módulo reviews,
con migración, implementación, pruebas y documentación en los 15 archivos de la etapa.
Revisión de `git diff`, `git diff --cached` y `git diff --cached --check` antes
del commit; sin archivos ajenos al alcance ni operaciones Git pendientes.

Comprobación previa al commit: `npm run test --workspace=back --
tests/feedback-reportes.spec.ts tests/feedback-moderation.spec.ts
tests/feedback-actions.spec.ts --no-file-parallelism`: **117/117** en tres
archivos, exit 0, 1.27 s. No se repitieron integraciones en el cierre: la global
1566/1566 y las 93 focalizadas documentadas corresponden al mismo código final.
Sin push. Mensaje del commit local:
`feat(reportes): agrega denuncias y resolución administrativa auditada`
