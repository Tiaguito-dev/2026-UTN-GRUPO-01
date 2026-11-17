# T5 — Ocultamiento preventivo por reportes

Autorizada exclusivamente T5 y sus pruebas. Sin frontend, T6, modelos, M1.3,
dependencias nuevas, despliegue, commits ni push.
Estado: completada y validada. Detenerse antes de T6.

## Precondiciones verificadas

T1–T4 y ajuste de identidad terminados y validados según sus fichas. Git principal
limpio en 983c681, con T1–T4 registrados, sin operaciones Git pendientes.
El usuario confirma que M1.3 del worktree separado queda estacionada para el final;
sus cambios no se tocan. Existen transición transaccional, lock comisión -> feedback
-> par autor/materia y countFeedbackReportesAbiertos (DISTINCT usuario, ABIERTO,
todas las versiones). No hay otra operación pendiente identificada sobre T5.

## Decisiones antes de implementar

- POST de reporte conserva contrato estricto y evidencia T4. Bajo advisory del
  denunciante -> comisión -> feedback: crear, contar, activar solo ocultoReportes
  al tercero, snapshot/evento correlacionados y syncMateriaVote en una transacción.
  La transición aumenta versionModeracion, conserva APROBADO y las otras causas.
  El ledger registra origen AUTOMATICO y actor real que cruza el umbral.
- Reutilizar la persistencia de transiciones T1/T2 mediante una función interna
  que recibe la transacción y fila bloqueada; sin transacciones anidadas ni nueva
  abstracción de aplicación. Dos acciones históricas nuevas en migración aditiva:
  OCULTAMIENTO_REPORTES y RESTITUCION_REPORTES.
- Nuevos reportes solo sobre contenido público. En cuatro solicitudes concurrentes,
  las primeras tres pueden crear y la siguiente recibe 404 si el tercero ya ocultó.
  Un reintento propio sobre contenido oculto por reportes puede recuperar su recibo
  previo si la evidencia coincide con el contenido actual, sin crear/reabrir reportes
  ni revelar otras identidades. No se permite este acceso tras baja o por otras causas.
- POST /admin/feedback/:id/moderacion admite RESTITUCION_REPORTES con los mismos
  versionEsperada y motivo obligatorio. Recontar bajo lock; >=3 ABIERTO distintos
  produce 409. Solo levanta ocultoReportes, incluso con otras causas/estado privado.
  Mantiene permisos ADMIN, versión, no-op y auditoría existentes. El cierre individual
  T4 nunca restituye. Rechazo formal usa RECHAZO de T3. Mantener pendiente no escribe.
- GET /admin/feedback-reportes agrega filtro ocultoReportes=true|false; mantiene
  paginación nueve y las versiones/reportes existentes. Listado y detalle agregan
  ultimoReporteAt (todos los reportes, incluso cerrados) y mantienen conteos abiertos,
  estado y causas actuales en la misma lectura RepeatableRead. No hay tabla de cola.
  Identidades solo ADMIN; historial de autor conserva su proyección segura.

## Aceptación y validación prevista

Testing delegado según .agents/OVERVIEW.md; primero RED de T5, luego pruebas reales
HTTP/PostgreSQL: umbral 1/2/3, duplicados/versiones/cerrados, concurrencia y pools,
cierres/restitución concurrentes, independencia de causas, nuevos ciclos, versión,
auditoría/origen/actor, privacidad, ADMIN, estadísticas e interacciones conservadas,
rollback durante sync y ledger. Actualizar expectativas T4 incompatibles con el umbral.
PostgreSQL y SMTP desechables, focalizada, global serial sin omisiones, typecheck,
lint, build, diffcheck y comprobación manual HTTP del compilado. Registrar fallos reales.
Actualizar esta ficha, plan, back/OVERVIEW.md y CHANGELOG.md. Detenerse al cerrar T5.

## Implementación

- `back/prisma/schema.prisma` y migración nueva
  `20261117030000_feedback_ocultamiento_reportes/migration.sql`: dos acciones enum
  históricas, sin tablas nuevas, backfill de ocultamiento ni alteración de reportes.
- `back/src/reviews/domain/feedback-moderation.ts`: acciones internas preventivas,
  permisos, conteo obligatorio válido, umbral y restitución independiente de causas.
  Conserva estado/revisión/motivo de rechazo, versión y semántica no-op T1/T3.
- `back/src/reviews/infrastructure/prisma-feedback-moderation.ts`: extrae la escritura
  de transición ya existente para reutilizarla desde reportes con la misma transacción.
  Mantiene lock del par, snapshot/ledger con UUID compartido y syncMateriaVote;
  registra origen automático o administrativo en los dos eventos preventivos.
- `back/src/reviews/infrastructure/prisma-feedback-reporte.repository.ts`: creación
  T4 seguida de COUNT DISTINCT ABIERTO, transición y sincronización bajo locks;
  reintentos propios seguros sin escritura; bandeja/detalle con filtro y fecha máxima
  de reporte, conteos agrupados, RepeatableRead y proyecciones explícitas.
- `back/src/reviews/infrastructure/prisma-feedback.repository.ts`: reutiliza la
  persistencia común y verifica ADMIN activo y conteo bloqueado para restitución.
- `back/src/reviews/application/feedback-input.ts` y `feedback-reporte-input.ts`:
  RESTITUCION_REPORTES en DTO administrativo, filtro booleano estricto de bandeja.
- `back/src/reviews/domain/feedback-reporte.ts`: tipos aditivos ultimoReporteAt.
- `back/src/administration/admin-detail.service.ts`: origen entre los campos seguros
  exclusivos del historial administrativo de Feedback. La historia del autor conserva
  su selección sin actor ni identidad de denunciantes.
- `back/tests/feedback-reportes-threshold.spec.ts` y
  `feedback-reportes-threshold.integration.spec.ts`: 56 pruebas nuevas. Adaptación de
  dos expectativas en `feedback-reportes.integration.spec.ts`: concurrencia ahora oculta
  al tercero; paginación de 11 reportes usa población persistida legada de T4, sin
  eludir el umbral mediante HTTP ni debilitar assertions.
- Esta ficha, plan incremental, `back/OVERVIEW.md` y `CHANGELOG.md`.

## Evidencia de validación

- RED antes de producto: contratos T5, tres fallidas y once aprobadas, exit 1,
  649 ms; faltaban RESTITUCION_REPORTES y los dos filtros booleanos.
- Regresión unitaria de producto/transición T1/T3 y reportes: 138/138, cinco
  archivos, exit 0, 2.23 s. Incluye los 14 contratos T5 iniciales.
- Primera focalizada real: 130/132, exit 1; los dos fallos eran expectativas T4
  de visibilidad sin umbral y creación de once reportes sobre una publicación.
  Se conservaron controles de paginación, evidencia, privacidad y serialización.
- Segunda focalizada: 149/149, exit 0, 65.68 s. Focalizada final tras ampliar
  aserciones de cierre parcial multiversión/reintento cerrado: 149/149, cuatro
  archivos, exit 0, 81.97 s. Desglose: T5 25 unitarias +31 integraciones; T4
  55 unitarias +38 integraciones. PostgreSQL real, ninguna integración omitida.
- Focalizada: `npm run test --workspace=back -- tests/feedback-reportes-threshold.spec.ts
  tests/feedback-reportes-threshold.integration.spec.ts tests/feedback-reportes.spec.ts
  tests/feedback-reportes.integration.spec.ts --no-file-parallelism`, una invocación,
  TEST_DATABASE_URL exclusiva de t5_focus. Pruebas de carreras con sesiones HTTP
  reales y dos pools Prisma, no bloqueos simulados. Triggers de fallo solo en schema
  aleatorio propio verifican rollback de estadísticas, reporte, estado, versión,
  snapshot y ledger, además de reintento posterior satisfactorio.
- Typecheck inicial de producto falló por inferencia demasiado estrecha del array
  de cambios; una segunda anotación mediante interfaz no satisfacía el tipo JSON
  de Prisma. Se conserva el tipo estructural explícito original y pasa typecheck.
  Un typecheck intermedio de pruebas detectó una declaración duplicada y referencia
  temporal ausente; corregidas antes de la segunda focalizada verde.
- Typecheck, lint backend completo y build finales: exit 0. Sin aumentar timeouts,
  modificar configuración de tests ni introducir dependencias.
- Comprobación manual con peticiones HTTP al backend `back/dist` compilado y base
  nueva t5_manual: aprobación -> tres denuncias -> ocultamiento/voto retirado ->
  reintento 200 -> restitución con tres 409 -> cierre sin restituir -> detalle
  autor 403 / ADMIN con identidad -> restitución explícita con dos -> visibilidad
  y voto recuperados. UUID snapshot/ledger, origen AUTOMATICO y tercer actor real
  comprobados. Exit 0. El primer intento del script temporal carecía del parámetro
  AUTH_PASSWORD_RESET_URL del fixture; se corrigió sin tocar auth ni producto.
- Aviso deprecatorio no fatal de pg por consultas concurrentes del patrón existente;
  sin suprimir advertencias ni cambiar dependencias.
- Primera y única global final: **1622/1622 pruebas, 70/70 archivos**, exit 0,
  309.59 s. Código y pruebas congelados; PostgreSQL y SMTP reales, sin integraciones
  omitidas. Incluye regresiones T1–T4, acciones ADMIN, privacidad, migraciones,
  interacciones, feed, rankings, valoraciones y autenticación/SMTP. La focalizada
  final coincidió brevemente con la global en bases/esquemas separados, sin cambios
  de archivos. Ambas ejecuciones aprobaron.
- Global: `npm run test --workspace=back -- --no-file-parallelism`, con
  TEST_DATABASE_URL exclusiva de t5_global, TEST_SMTP_PORT=51035 y
  TEST_MAILPIT_API_URL=http://127.0.0.1:58035. Log local ignorado `.tmp/t5-global.log`.
- Comandos estáticos: `npm run typecheck --workspace=back`,
  `npm run lint --workspace=back`, `npm run build --workspace=back`,
  `git diff --check`: exit 0 con el contenido final. Node 22.22.3.
- Infraestructura exclusiva: PostgreSQL 16.15 y Mailpit v1.32.0 de imágenes locales,
  sin descargas ni volúmenes del usuario. Bases nuevas t5_focus, t5_manual y t5_global;
  28 migraciones finales aplicadas solamente allí mediante db:deploy, y en esquemas
  propios de las integraciones. Script manual temporal retirado tras validar.
- Al cerrar se retiraron únicamente butchery-t5-postgres y butchery-t5-mailpit
  con sus volúmenes desechables; consulta Docker final sin contenedores T5 activos.
  No se tocaron otros servicios, datos ni el worktree estacionado de M1.3.

## Límites y preparación para T6

El umbral se evalúa al crear un reporte nuevo; la migración no toma decisiones
retroactivas sobre reportes legados. El contenido ya oculto rechaza nuevas denuncias;
los reintentos recuperan únicamente recibos propios sobre evidencia coincidente.
Una nueva versión admite nuevas filas, sin reabrir ni contar reportes cerrados.
No hay sanciones ni valoración de conducta de denunciantes.

La coordinación atómica requiere mantener los escritores sobre el mismo PostgreSQL;
una futura separación de servicios deberá preservar locks/atomicidad. La política T2
recupera el voto público solo si todas las condiciones se cumplen y conserva la
prioridad por evento de contenido, sin promover un voto por un evento de moderación.
La interfaz T6 puede consumir acciones y consultas existentes ampliadas, con nueve
reportes por página y tres resoluciones/eventos históricos. No se implementó T6 ni
se verificó una UI nueva; la validación de esta etapa es HTTP/SQL real.

Sin frontend, M1.3, modelos, dependencias nuevas, despliegue, commits o push.
T5 completada y validada; no quedan fallos funcionales ni de regresión detectados.
La evidencia de fallos intermedios se conserva arriba. Detenerse antes de T6.
Mensaje sugerido, sin ejecutar:
`feat(reportes): agrega ocultamiento preventivo y restitución auditada`

## Cierre local autorizado

El usuario autorizó posteriormente ejecutar el commit de T5. Esta autorización
reemplaza únicamente la restricción de commits locales; no autoriza push, despliegue,
T6 ni cambios M1.3. Se registra una sola unidad de trabajo del módulo reviews:
implementación, migración, pruebas y documentación en los 17 archivos de T5.

Revisión de `git diff`, `git diff --cached` y `git diff --cached --check`, sin
archivos ajenos al alcance. Verificación previa al commit: `npm run test
--workspace=back -- tests/feedback-reportes-threshold.spec.ts
tests/feedback-reportes.spec.ts tests/feedback-moderation.spec.ts
tests/feedback-actions.spec.ts --no-file-parallelism`: **142/142** pruebas en cuatro
archivos, exit 0, 1.61 s. Sin repetir integraciones: la global 1622/1622 y la
focalizada 149/149 documentadas corresponden al mismo contenido funcional final.
El worktree separado de M1.3 permanece intacto. Sin push.
