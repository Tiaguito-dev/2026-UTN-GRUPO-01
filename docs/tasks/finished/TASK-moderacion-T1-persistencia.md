# T1 — Persistencia y transiciones internas de moderación

Fecha: 2026-11-17. Alcance autorizado: T1 y pruebas únicamente. Sin commits.
Plan completo, dependencias, criterios y decisiones:
[moderación y reportes incremental](../in-progress/TASK-moderacion-reportes-incremental.md).

## Implementación

- `back/prisma/schema.prisma`: estados, versión, revisión humana obligatoria tras rechazo,
  motivo y tres causas independientes de ocultamiento. Snapshots con metadatos opcionales.
- `back/prisma/migrations/20261117000000_feedback_moderacion/migration.sql`: backfill aprobado
  para registros existentes, default pendiente para nuevos; restricciones de versión/rechazo/motivos,
  nuevas acciones e índice de cola. No inventa aprobaciones ni metadatos de snapshots antiguos.
- `back/src/reviews/domain/feedback-moderation.ts`: transiciones puras, permisos, justificaciones,
  no autorrevisión, causas independientes y control de versión/no-op.
- `back/src/reviews/application/errors.ts`: exportación del error de moderación.
- `back/src/reviews/application/ports/feedback.repository.ts`: operación interna tipada.
- `back/src/reviews/infrastructure/prisma-feedback.repository.ts`: transición en repositorio
  existente, bloqueo comisión -> comentario, relectura, snapshot y ledger correlacionados/atómicos.
- `back/src/reviews/domain/feedback.ts`: acciones históricas ampliadas sin cambiar DTO público.
- `back/OVERVIEW.md`: contrato interno y límite de despliegue.
- `CHANGELOG.md`: registro de etapa.

Todas las resoluciones ADMIN requieren motivo, incluida aprobación (regla del pedido sobre
resoluciones justificadas). El autor conserva acceso previsto por etapas siguientes; levantar
una causa no levanta las otras. Reenviar un rechazado exige diferencia textual contra el último
snapshot RECHAZO y mantiene revisión humana obligatoria. No se crean proveedores ni clasificadores.

## Pruebas y validación

Cuatro archivos nuevos, 53 casos aprobados (40 unitarios y 13 de integración PostgreSQL):

- `back/tests/feedback-moderation.spec.ts`: 33 casos de permisos, motivos, estados, causas,
  conflictos, no-op y límite de entero PostgreSQL.
- `back/tests/feedback-moderation-repository.spec.ts`: siete casos del límite transaccional,
  correlación de eventos, revalidación y evidencia de corrección.
- `back/tests/feedback-moderation-migration.integration.spec.ts`: cuatro casos SQL sobre
  esquemas legados aislados, conservación de datos, defaults y restricciones reales.
- `back/tests/feedback-moderation.integration.spec.ts`: nueve casos de repositorio real en esquema
  propio, todas las migraciones reproducidas, rollback por FK del ledger y decisiones simultáneas.

TDD: RED inicial por módulo/método inexistentes; GREEN final 53/53. El harness inicial basado en
LIKE falló por tipos enum ligados al schema public; se corrigió reproduciendo las migraciones
en un esquema propio, sin cambiar lógica de producto. El primer lint encontró no-control-regex;
se corrigió usando inspección de puntos Unicode como el validador existente, sin suprimir reglas.
La revisión final agregó un caso de rechazos con la misma fecha y UUID desfavorable: se consulta
la versión mayor primero para no aceptar reenvío sin corrección ante empates de milisegundos.

Validaciones aprobadas: `npm run db:generate --workspace=back`, Prisma validate,
`npm run typecheck --workspace=back`, `npm run lint --workspace=back`,
`npm run build --workspace=back` y `git diff --check`.

Migraciones: `npm run db:deploy --workspace=back` aplicó las 25 migraciones a una base PostgreSQL
16.15 desechable, creada exclusivamente para esta tarea. No se aplicó a la base del usuario.
Los tests específicos tuvieron TEST_DATABASE_URL configurada: las integraciones no se omitieron.
Mailpit local desechable se habilitó para la regresión SMTP existente, sin descargar imágenes.
Al terminar se detuvieron y retiraron ambos contenedores creados para esta validación; no se
dejaron servicios ni bases de pruebas ejecutándose.

Regresión global (con TEST_DATABASE_URL y TEST_MAILPIT_API_URL):

- `npm run test --workspace=back`: primera ejecución concurrente, 1298 aprobadas/12 fallidas.
  Ocho fallos correspondían a la versión inicial del harness de T1, corregida luego; los otros
  cuatro fueron cruces de fixtures públicos en feed/listado/likes. No se modificaron tests viejos.
- `npm run test --workspace=back -- --no-file-parallelism`: 60 archivos aprobados, uno fallido;
  1311/1314 casos aprobados. Feed/listado/likes y las pruebas T1 presentes en ese momento pasaron.
  Solo auth-password.integration tuvo dos timeouts de 5000 ms y una respuesta SMTP 503.
- Reejecución de `tests/auth-password.integration.spec.ts` sola, sin cambiar código ni timeouts:
  24/24 aprobadas, exit 0, 34.84 s. Los tres fallos globales no se reprodujeron.
- Después del último ajuste de orden por versión se repitieron los cuatro archivos de T1:
  53/53 aprobadas, exit 0, 4.41 s; también typecheck y lint finales aprobados.

No se declara que la ejecución global haya sido completamente verde. Toda prueba que falló
pasó después de corregir el harness o reejecutar sin interferencia; quedan registradas las
limitaciones observadas de aislamiento/tiempos de la suite existente, fuera de este incremento.

## Límites y preparación para T2

No hay nuevos endpoints, escritores públicos conectados a moderación, interfaz, reportes, umbral
automático ni cambios de estadísticas/visibilidad. Los writers actuales siguen omitiendo los
metadatos opcionales del snapshot; T2/T3 conectarán esos flujos y el control de versión de edición.

No desplegar T1 aisladamente: los lectores actuales filtran por deletedAt y todavía podrían
mostrar registros con los nuevos estados/causas. T2 debe aplicar la política visible y sincronizar
agregados antes de que T3 exponga decisiones. La presencia de un estado pendiente en persistencia
no implica que el flujo HTTP de publicación ya esté moderado.

No se verificó navegador: no hay cambios UI en esta etapa; el recorrido completo corresponde a T6.
No se tocaron frontend, auth, layout/router/hooks/primitivas globales, M1.3 ni experimentos.
El plan T1–T6 permanece en in-progress; esta ficha cierra únicamente T1 tras registrar resultados.
Detenerse y esperar autorización para T2. Mensaje sugerido, sin ejecutarlo:
`feat(moderacion): agrega persistencia y transiciones auditadas`
