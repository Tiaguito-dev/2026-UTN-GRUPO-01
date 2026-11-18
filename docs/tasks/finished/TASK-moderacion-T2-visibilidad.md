# T2 — Visibilidad pública y consistencia de estadísticas

Fecha: 2026-11-17. Autorizada T2 y sus pruebas; detenerse antes de T3.
El cierre en cuatro commits locales fue autorizado posteriormente, sin push.
T1 revisada y registrada por autorización expresa en commit `2f619db`; sin push.
Estado: T2 completada y validada; T3 no ejecutada.
Referencia: [plan incremental](../in-progress/TASK-moderacion-reportes-incremental.md).

## Alcance y decisiones antes de implementar

Solo `back/`, esta tarea, plan y CHANGELOG. Sin frontend, endpoints nuevos, reportes,
clasificadores, M1.3, dependencias ni despliegue. No modificar la migración de T1.

- Experiencia pública = APROBADO, deletedAt nulo y tres causas falsas. Política pequeña en
  reviews/domain con adaptaciones Prisma y SQL dentro de infraestructura, reutilizadas por
  feedback/feed/likes/respuestas/rankings y selección del voto de materia.
- Mantener get/historial propios y detalle ADMIN con guards existentes; no convertir detalle
  privado en detalle comunitario. Para terceros, padres no visibles en interacciones devuelven 404.
- Bloquear altas/ediciones de respuestas y cambios de likes sobre padre no visible, sin destruir
  relaciones; lectura de respuestas oculta todo el hilo. No ampliar permisos del autor de respuestas.
- Nuevas experiencias explícitamente PENDIENTE. Una edición real de APROBADO pasa a PENDIENTE
  para evitar publicar contenido que no fue revisado; RECHAZADO permanece rechazado. No-op intacto.
  Incrementar versión y guardar metadatos en snapshots de creación/edición/baja. Esta conexión
  mínima del writer actual es necesaria para T2, sin nuevas acciones HTTP de T3.
- Crear tras rechazo/retirar conserva antecedente humano consultando experiencias previas del
  mismo autor/comisión, también eliminadas; no existe publicación automática en esta etapa.
- Único voto usuario/materia: última experiencia visible puntuada según último evento CREACION o
  EDICION de contenido, con fallback createdAt si no hay historial, y desempate estable por evento/id.
  Aprobar/ocultar/restaurar no cambia ese orden. Históricos sin puntuación no contribuyen.
- Reutilizar ValoracionMateria como proyección persistida. Un helper transaccional en reviews
  selecciona elegible, inserta/reactiva/actualiza o da de baja, y devuelve diferencias para el mismo
  evento de auditoría. Se llama desde create/update/remove y transitionModeration. Bloqueos:
  comisión -> fila cuando corresponde -> advisory del par autor/materia; nunca ordenar al revés.
- Lecturas agregadas de materias se basan en la selección visible autoritativa para que una
  proyección antigua o escrita por fixtures/seed no filtre votos privados. Reutilizar la misma
  selección SQL que sincroniza ValoracionMateria; consultas acotadas a materias de la página.
- Si hace falta reconciliar votos anteriores, agregar una migración exclusivamente de datos T2
  (sin tocar T1), con el mismo criterio de selección y sin inventar decisiones de moderación.
  Aplicar únicamente en PostgreSQL desechable durante esta tarea.
- Revisar también seed-feedback: no puede generar votos públicos para experiencias pendientes.
  Sin modificar reputaciones/modelos ni convertir automáticamente en aprobadas nuevas experiencias.

## Archivos y módulos

reviews/domain/feedback-visibility.ts; adaptador SQL/Prisma y selección/sincronización de votos en
reviews/infrastructure; repositorios existentes feedback, feed, likes, respuestas, ranking;
academic/infrastructure/prisma-materia.repository.ts; seed-feedback si la inspección confirma bypass.
Pruebas focalizadas nuevas y ajustes semánticos explícitos en pruebas existentes afectadas por
publicación pendiente. No cambiar timeouts ni fixtures antiguos para ocultar fallos.

## Criterios de aceptación

1. Matriz estado x baja x causas protege listados, filtros, totales, feed, hilo y agregados.
2. Propio/autor/ADMIN conservan consulta autorizada, anonimato y DTO público sin metadatos privados.
3. Likes/respuestas de ocultos no se consultan ni generan; al restituir vuelven las relaciones vigentes.
4. Pendiente no altera votos; aprobar/ocultar/restituir/rechazar/editar/retirar sincroniza el par
   correcto y selecciona el respaldo visible si lo hay. Levantar una causa con otra activa no publica.
5. Dos comisiones del mismo autor/materia no duplican votos; concurrencia y fallo de ledger
   preservan atomicidad y versión. Compatibilidad con metadatos legados nulos y estrellas NULL.
6. No endpoints de moderación ni listado propio nuevos; no cambios al frontend o experimentos.

## Validación

Tests RED antes de implementación. PostgreSQL real desechable para SQL/transacciones/migraciones.
Pruebas específicas; regresiones experiencias/feed/likes/respuestas/rankings/valoraciones/T1;
typecheck, lint y build. Intentar suite global con archivos seriales para evitar cruce de fixtures
públicos conocido en T1. Registrar comandos, resultados originales y reejecuciones sin cambiar
timeouts. Integraciones omitidas no cuentan como satisfactorias.

Al terminar: actualizar esta ficha, plan, back/OVERVIEW y CHANGELOG; mover ficha a finished si
T2 cumple aceptación, conservando evidencia de cualquier fallo global y su diagnóstico.
No desplegar T1/T2 aisladamente y esperar autorización para T3. La restricción inicial de no
hacer commits de T2 fue reemplazada por la autorización expresa de cierre local.

## Implementación y archivos afectados

- Política de dominio: `back/src/reviews/domain/feedback-visibility.ts`. La definición única
  produce el chequeo de filas y las representaciones Prisma/SQL de
  `back/src/reviews/infrastructure/prisma-feedback-visibility.ts`.
- `prisma-feedback.repository.ts`: listados visibles; detalle/historial ajenos no visibles 404;
  consultas propias y retiro autorizado conservados. Altas pendientes explícitas, antecedente
  de rechazo preservado, edición aprobada -> pendiente, snapshots/versiones y sincronización.
- `prisma-feedback-feed.repository.ts`, `prisma-ranking.repository.ts`,
  `prisma-feedback-like.repository.ts` y `prisma-feedback-respuesta.repository.ts`: misma
  política pública, incluyendo padres, conteos, agrupaciones e interacciones por ruta directa.
- `back/src/reviews/infrastructure/prisma-feedback-rating.ts`: selección SQL única del voto
  visible, bloqueo advisory y sincronización de la proyección, sin capas o servicios paralelos.
- `back/src/academic/infrastructure/prisma-materia.repository.ts`: resumen público basado en
  esa selección autoritativa; una proyección manual/obsoleta no publica votos privados.
- `back/src/reviews/seed-feedback.ts`: nuevas demos pendientes, snapshots de filas persistidas y
  proyección sincronizada, sin aprobar automáticamente ni fabricar votos desde valores previstos.
- `back/prisma/migrations/20261117010000_feedback_valoracion_visible/migration.sql`: reconciliación
  de datos. Bloquea fuentes y proyección, conserva identidades/createdAt, da de baja inelegibles
  y reactiva/actualiza elegibles. No cambia experiencias ni decisiones/historial. T1 intacta.
- Tests nuevos: `feedback-visibility.spec.ts`, `feedback-visibility.integration.spec.ts`,
  `feedback-rating-visibility.integration.spec.ts`, soporte `support/moderation-harness.ts`.
- Regresiones adaptadas: feedback-create/update/remove, feedback.integration, feed, likes,
  respuestas, ranking, materia-valoracion, admin-limits y mock del repositorio de moderación T1.
  No se modificaron timeouts; los fixtures publicados declaran explícitamente su revisión previa.
- Documentación: esta ficha, plan incremental, `back/OVERVIEW.md` y `CHANGELOG.md`.

Los timestamps de contenido se fijan después de adquirir el bloqueo del par: CURRENT_TIMESTAMP
por defecto toma el inicio de la transacción y no representa bien un escritor que esperó ese
bloqueo. Los eventos de moderación se excluyen de la prioridad del voto, aun si son posteriores.
El límite Int de versión se valida antes de escribir. Transiciones sin cambios no producen eventos.

## Evidencia de validación focalizada

- RED inicial: política inexistente, antes de implementación. Harness nuevo inicialmente ajustado
  por precisión de segundos JWT frente a sesión; solo se corrigió el fixture, no autenticación.
- Nuevos tres archivos: **107/107 aprobados**, ejecución root con TEST_DATABASE_URL real y
  `--no-file-parallelism`, 76.49 s (48 dominio, 50 HTTP, nueve estadísticas/migración).
- Escritores create/update/remove: **52/52 aprobados**. Primera corrida 47/49 por esperar403 en
  fixture oculto; se separaron visible403 y oculto404. Luego se añadieron casos de antecedente
  humano y estrellas históricas NULL. No se quitaron los invariantes de normas/permisos/rollback.
- HTTP de experiencias: **46/46 aprobados**, 37.61 s. Primera corrida conjunta 89/96 con siete
  expectativas del contrato anterior (voto/publicación inmediata y respaldo obsoleto); corregidas
  de acuerdo con la política T2 y reejecutadas. Históricos y snapshots anteriores se conservaron.
- Materia: **24/24 aprobados**, 15.74 s (13 unitarios, 11 PostgreSQL), incluyendo caché obsoleta,
  un voto por autor y pendiente -> aprobación -> edición pendiente -> reaprobación -> retiro.
- Regresiones de interacciones/feed/ranking/T1: una ejecución previa 163/166 tuvo tres fallos de
  fixtures que se marcaron aprobados sin sincronizar voto. Corregidos para usar revisión interna
  real y conservar expectativas de historial; la reejecución se interrumpió durante reanudación
  y no se cuenta como aprobada. Quedan incluidas en la ejecución global serial final.
- Typecheck, lint, build backend y diffcheck aprobados. No dependencias nuevas.
- Migraciones 26/26 aplicadas solo en tres bases nuevas del contenedor desechable PostgreSQL16.15:
  pruebas focalizadas, primera global y segunda global. Mailpit local desechable para SMTP.

Primera suite global serial en base nueva: **1410/1412 aprobadas**, 62 archivos aprobados y dos
fallidos de 64; exit 1, 331.23 s. No hubo integraciones omitidas ni fallos de autenticación.

- admin-limits: fixture de comentario histórico sin estado explícito quedó pendiente por el
  default de T1. Se declaró APROBADO como precondición de una publicación histórica; contenido,
  snapshots y aserciones de preservación no cambiaron.
- ranking.spec: una aserción textual esperaba alias `f` sin comillas, mientras el adaptador SQL
  central usa `"f"`. La condición de visibilidad estaba presente y el SQL real pasó integración;
  se ajusta el test para verificar también estado/causas en la representación centralizada.

No se cuenta esta primera ejecución como completamente satisfactoria. La corrección del test
unitario de ranking pasó 12/12 y mantuvo conteos/privacidad, agregando comprobación de parámetros.

Segunda global con código/pruebas congelados y otra base nueva: **1412/1412 aprobadas**, **64/64
archivos**, exit 0, 279.56 s. Con TEST_DATABASE_URL y TEST_MAILPIT_API_URL reales: ninguna
integración omitida. Incluye T1, experiencias, feed, likes, respuestas, rankings, valoraciones,
administración, migraciones y autenticación/SMTP. Sin aumentar timeouts ni modificar CI.

Typecheck y lint finales posteriores a las últimas adaptaciones de pruebas: exit 0. Build de
backend con la fuente final: exit 0. Diffcheck final: exit 0 (avisos CRLF de Git no son errores).

## Comandos y límites de esta entrega

- Revisión/commit T1 solicitado antes de T2: `git diff --cached`, `git diff --cached --check`,
  40 pruebas unitarias T1 repetidas y commit local `2f619db`. Sin push. La autorización inicial
  de no hacer commits de T1 fue reemplazada por ese pedido.
- Con DATABASE_URL apuntando únicamente a cada base desechable: `npm run db:deploy --workspace=back`.
- Con TEST_DATABASE_URL real: `npm run test --workspace=back -- tests/feedback-visibility.spec.ts
  tests/feedback-visibility.integration.spec.ts tests/feedback-rating-visibility.integration.spec.ts
  --no-file-parallelism` (argumentos en una sola invocación).
- Global: `npm run test --workspace=back -- --no-file-parallelism`, con TEST_DATABASE_URL de base
  nueva y TEST_MAILPIT_API_URL del buzón local. Sin aumentar timeouts ni cambiar configuración CI.
- `npm run typecheck --workspace=back`, `npm run lint --workspace=back`,
  `npm run build --workspace=back`, `git diff --check`.

No se modificaron frontend, autenticación, routers, componentes globales, dependencias, clasificador
o experimentos. No se verificó navegador porque no se implementó UI: T2 valida HTTP/SQL reales.
No hay endpoints de moderación ni listado propio nuevos, ni tablas/acciones de reportes.
La sincronización de ocultoReportes queda preparada para el escritor transaccional futuro de T5;
T2 no activa el umbral de denuncias. Los cambios externos directos de DB no reemplazan al repositorio.
No desplegar estas etapas aisladamente: faltan los flujos HTTP/administrativos de T3 y la UI posterior.

## Cierre y preparación para T3

T2 cumple los criterios de aceptación. No quedan fallos funcionales de esta etapa ni fallos de
regresión pendientes después de la segunda global. Las ejecuciones fallidas originales se
conservan arriba como evidencia, sin sustituirlas por una afirmación de verde retrospectivo.

La migración T1, los experimentos y el frontend permanecen sin cambios. T1 conserva su commit
`2f619db`; T2 se registra por autorización expresa en los cuatro cortes detallados abajo. No se aplicaron migraciones
ni se desplegó sobre datos del usuario. Se detuvieron y retiraron los dos contenedores desechables
de PostgreSQL/Mailpit al terminar, sin dejar bases o servicios de pruebas ejecutándose.

T3 puede incorporar las acciones HTTP sobre estas operaciones internas y preparar la bandeja,
pero no se inició: la aprobación/ocultamiento/restauración se verificó invocando repositorios en
tests. La UI actual aún no explica estados pendientes; su integración queda para el alcance
autorizado posterior. El rechazo editable en contexto académico cerrado sigue perteneciendo a T3.

## Cierre local autorizado

Se revisaron los cambios con `git diff --cached` y `git diff --cached --check`. Los archivos
compartidos se prepararon por fragmentos del índice, conservando intacto el contenido final.
Los cortes, en orden de dependencia, son:

1. `5096112` — `feat(moderacion): protege consultas e interacciones públicas`: política compartida,
   listados, feed, rankings, likes y respuestas con sus regresiones.
2. `1d71181` — `feat(valoraciones): sincroniza votos con experiencias visibles`: selección y sincronización
   transaccional, escritores, protección del detalle y pruebas HTTP/SQL de integración.
3. `3904324` — `fix(datos): reconcilia valoraciones históricas y seed`: migración exclusivamente de datos,
   seed pendiente y caso de prueba de reconciliación idempotente.
4. `docs(moderacion): documenta T2 y sus validaciones`: ficha, plan, contratos y changelog.

Antes de registrar los cortes se repitieron 160 pruebas de política/interacciones y 72 de
escritores/moderación/valoraciones: todas satisfactorias. La validación global PostgreSQL
1412/1412 y el build anteriores corresponden al mismo contenido funcional final; no se
repitieron integraciones durante la separación de commits ni se aplicaron nuevas migraciones.
Sin push ni implementación de T3. Detenerse y esperar autorización para continuar.
