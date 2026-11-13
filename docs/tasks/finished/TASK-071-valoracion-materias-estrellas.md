# TASK-071: Valoración de materias con estrellas

Estado: Finalizada (cierre funcional y documental local; CI e integración pendientes).
Fecha de última actualización: 2026-11-12.
Responsables por dominio: back (persistencia y API), front (formulario y resumen), test (pruebas).

## 0. Revisión técnica final y aceptación funcional (2026-11-12)

Este apartado describe el estado vigente. Las autorizaciones incrementales y los resultados
parciales de las secciones siguientes se conservan como registro histórico; sus menciones a
funcionalidades todavía pendientes corresponden al momento de cada etapa.

### Funcionalidad implementada

- Estrellas individuales obligatorias de 1 a 5 en nuevos comentarios; históricos y sus snapshots
  conservan NULL. Edición opcional de estrellas, sin permitir retirarlas ni reenviarlas si no cambian.
- Creación, edición y baja lógica coordinan comentario, historial, voto global y auditoría dentro
  de una transacción. Un voto por usuario/materia, reutilizando su fila tras una reactivación.
- Al retirar el último comentario activo puntuado se da de baja el voto; si quedan otros, se
  conserva la última puntuación global, sin recalcularla desde comentarios anteriores.
- Promedio y cantidad globales de materia, compartidos entre carreras; solo votos vigentes,
  promedio redondeado a un decimal, NULL/0 sin votos. Lecturas por lote sin N+1 y consistencia
  RepeatableRead; contratos administrativos de escritura permanecen separados.
- Selector con radios nativos, teclado, foco y errores asociados; conserva datos ante errores y
  participa en cancelación. Tarjetas propias/públicas e historial muestran solo su puntuación
  individual, sin controles editables ni estrellas ficticias para NULL.
- Listado y detalle de materias muestran un decimal es-AR, cantidad singular/plural o
  «Sin valoraciones». Sin solicitudes adicionales ni exposición de identidades de votantes.

### Decisiones técnicas confirmadas

- Migración incremental aditiva 20261112000000_valoracion_materias_estrellas: columnas nullable
  de comentarios/historial, tabla global con PK compuesta, FK RESTRICT/CASCADE, índices y tres
  CHECK de rango. Sin cambios de migraciones históricas ni backfill de comentarios sin estrellas.
- Orden de bloqueo comisión → advisory transaccional usuario/materia, namespace 2026071;
  escrituras ReadCommitted y voto global por upsert. Auditoría correlacionada con snapshots;
  edición solo de texto y puntuación idéntica no alteran el voto global.
- Schemas frontend de lectura enriquecida exigen resumen coherente; POST/PATCH administrativos
  siguen usando el schema base. Incompatibilidades se informan, sin convertirlas en cero votos.
- Sin nuevos endpoints, dependencias, tablas de idempotencia, cambios de autenticación/permisos,
  navegación global ni estilos base. Prisma Client y artefactos de compilación quedan ignorados.

### Evidencia de validación

- Backend sin PostgreSQL: 799 aprobadas en 33 archivos, cero fallidas y cero omitidas; suites
  de integración excluidas explícitamente. No equivale a ejecutar todas las integraciones del proyecto.
- Frontend final: 836 aprobadas en 78 archivos, cero fallidas y cero omitidas con
  `npm.cmd run test --workspace=front -- --cache=false --no-file-parallelism`.
- Corrida frontend anterior: 835 aprobadas y un timeout de 5000 ms en academic-bajas.spec.tsx;
  reintento aislado 7/7 y regresión general final en serie aprobados, sin aumentar timeouts.
- Integración PostgreSQL aislada de TASK-071, resultados confirmados previamente y ratificados
  por la usuaria: feedback.integration.spec.ts 45/45 y materia-valoracion.integration.spec.ts
  11/11. No se repitieron esas suites durante esta revisión documental.
- Typecheck aplicación/tests de ambos workspaces aprobado, sin emisión ni incremental;
  ESLint completo de ambos workspaces aprobado sin advertencias; git diff --check aprobado.
- Builds backend/frontend aprobados con código 0; Prisma Client 6.19.3 reconoce modelo global y
  puntuaciones. Hashes de archivos no ignorados sin cambios por los builds.
- Diecinueve migraciones aplicadas y verificadas tanto en el entorno aislado de integración
  como en la base visual separada. En la visual se comprobaron checksums, PK, FK, índices y CHECK.
- Fixtures GET de materias en admin-tables.browser.spec.mjs adaptados a valoracion, preservando
  respuestas POST/PATCH y aserciones; sintaxis, lint y comprobaciones de contrato aprobadas.
- La usuaria informó aceptación satisfactoria del checklist manual en navegador: creación,
  edición, eliminación, promedios, tarjetas, historial y responsive. Esta aceptación es informada
  por la usuaria; no se presenta como una ejecución automatizada de Playwright o axe por el agente.

### Límites, pendientes y relación con TASK-072

- No ejecutados para este cierre: Playwright general, nuevos recorridos E2E de estrellas,
  auditoría axe real en navegador, comparación/regeneración de capturas y Docker builds.
  Las otras integraciones PostgreSQL/SMTP del proyecto no forman parte de los 56 casos de TASK-071.
- CI backend-ci/frontend-ci, revisión de PR e integración siguen pendientes. La evidencia local
  no sustituye las condiciones de CONTRIBUTING.md ni permite afirmar que el DoD remoto está cumplido.
- Despliegue requiere aplicar la migración antes de utilizar este backend y frontend compatibles;
  clientes anteriores sin puntuacion no podrán publicar y lecturas antiguas sin valoracion se rechazan.
- Los campos nuevos se almacenan en la auditoría existente; la proyección visual del detalle
  administrativo distinto de las tarjetas públicas no se amplió en esta tarea.
- TASK-072 permanece separada: podrá consumir puntuacion nullable y reutilizar las tarjetas,
  pero este cambio no implementa Inicio/feed, likes, respuestas ni scroll infinito.
- La revisión anterior dejó pendiente el cierre documental por falta de autorización para
  CHANGELOG.md, traslado y enlace de TASK-072. La autorización posterior habilita ese cierre:
  entrada en CHANGELOG.md y traslado a docs/tasks/finished/, conservando toda la evidencia.
- La usuaria autorizó seis commits por funcionalidad y el hunk de paridad de validación en el
  segundo. El enlace local de TASK-072 se corrige, pero su documento queda sin seguimiento y
  fuera de todos los commits. No incluir secretos, .env, credenciales, datos de ejecución,
  capturas ni archivos generados. No realizar push, merge ni PR en este cierre.
- La aceptación manual satisfactoria queda registrada; CI, Playwright general, axe y Docker
  builds continúan pendientes. El cierre documental local no afirma aprobación de esos checks
  ni cumplimiento de la integración remota exigida por CONTRIBUTING.md.

## 1. Objetivo y contexto

Permitir que estudiantes autenticados valoren una materia al publicar un comentario y consulten
su promedio global. Cada comentario conserva sus propias estrellas; el promedio cuenta una sola
valoración vigente por usuario y materia, independientemente de sus carreras o comisiones.

Antecedentes, sin duplicar su implementación:

- [TASK-057: comentarios por comisión](../finished/TASK-057-feedback-por-comision.md):
  creación, edición, historial y unicidad de experiencia por usuario y comisión.
- [TASK-061: experiencias generales](../finished/TASK-061-acceso-directo-comisiones-y-experiencias.md)
  y [TASK-065: filtros y lectura](../finished/TASK-065-experiencias-filtros.md):
  proyección pública, anonimato y contexto académico.
- [Eliminación por autor o administrador](../TASK-feedback-removal-permissions.md):
  baja lógica, actor real y auditoría; prevalece sobre permisos históricos más restrictivos.
- [TASK-013: Inicio](../finished/TASK-013-home-interno.md) y
  [TASK-072: feed principal](../pendient/TASK-072-feed-principal-comentarios.md): contexto de integración futura.

## 2. Alcance funcional

- Exigir texto válido conforme a las reglas actuales y puntuación entera de 1 a 5 en comentarios
  nuevos. Rechazar ausencia de estrellas, decimales, valores fuera de rango y tipos inválidos.
- Guardar comentario, puntuación propia, valoración global y auditoría atómicamente. Un fallo
  debe revertir toda la operación, informar el error y permitir reintentar conservando el formulario.
- Mantener una única valoración vigente por `(usuarioId, materiaId)`. Publicar en otra comisión
  de la misma materia actualiza ese voto; compartir materia entre carreras no multiplica votos.
- Permitir editar texto y estrellas. La puntuación de cada comentario corresponde a su última
  edición de estrellas; editar solo texto no constituye una nueva valoración global.
- La última puntuación registrada en un comentario de esa materia actualiza la valoración global
  del usuario, sin aumentar la cantidad de votos. No permitir quitar estrellas a un participante.
- Calcular el promedio usando votos vigentes, mostrar un decimal y cantidad de valoraciones;
  mostrar exactamente «Sin valoraciones» si la cantidad es cero.
- Al eliminar el último comentario participante vigente del usuario en esa materia, retirar su
  valoración del cómputo. Aplicar también cuando elimina un administrador autorizado.
- Si quedan otros participantes vigentes, conservar la última puntuación global registrada,
  incluso cuando provenía del comentario eliminado; no restaurar automáticamente estrellas anteriores.
- Conservar comentarios históricos sin estrellas y excluirlos del promedio hasta que se valoren.
  Editar únicamente su texto no obliga a incorporar estrellas ni los convierte en participantes.
- Mantener anonimato, permisos, historial, auditoría y reglas académicas actuales.

## 3. Decisiones de persistencia aprobadas y diseño posterior pendiente

El alcance funcional fue aprobado. El 2026-11-12 se autorizó exclusivamente preparar el schema
y una migración incremental sin ejecutarla. Las decisiones 1 a 4 y 9 quedan definidas para
esta etapa; las operaciones de negocio de los puntos 5 a 8 siguen pendientes de revisión e implementación.

1. **Valoración global:** `ValoracionMateria` relacionada con User y Materia mediante UUID,
   PK compuesta `(usuarioId, materiaId)`, puntuación Int obligatoria y CHECK de 1 a 5 en SQL.
   `createdAt` y `updatedAt` usan `@default(now())` y `Timestamptz(3)`, siguiendo Feedback;
   las futuras operaciones actualizarán `updatedAt` explícitamente. `deletedAt` nullable respeta
   [soft-delete](../../standards/soft-delete.md). FK con ON DELETE RESTRICT y ON UPDATE CASCADE,
   relaciones inversas en User/Materia e índice `(materiaId, deletedAt)` para lectura vigente.
   La identidad del par se conserva también tras la baja: la futura reactivación reutilizará
   la fila con nuevas estrellas y `deletedAt = NULL`, sin duplicar votos. No se implementa aún.
2. **Estrellas propias:** agregar `puntuacion Int?` en Feedback, sin default, con CHECK de NULL
   o entero entre 1 y 5. NULL representa histórico sin valoración; no asignar votos retroactivos.
   La obligatoriedad en altas nuevas y la prohibición de retirar estrellas son validaciones de
   negocio futuras; el schema aditivo no impide que el backend actual siga insertando NULL.
3. **Participación:** se deriva de `puntuacion IS NOT NULL AND deletedAt IS NULL` en Feedback.
   No agregar `participaEnValoracion`. Índice `(autorId, materiaId, deletedAt)` para las futuras
   consultas de participantes; no cambiar la unicidad vigente por autor y comisión.
4. **Historial:** agregar `puntuacion Int?` en FeedbackHistorial, sin default, con CHECK de NULL
   o entero entre 1 y 5. Los snapshots existentes conservan su ausencia de estrellas; no cambiar
   eventos, texto, identidades ni fechas. La escritura de nuevos snapshots y los cambios en
   AdministracionHistorial corresponden a una etapa posterior, sin modificar ahora la auditoría.
5. **Transacción y concurrencia:** coordinar creación, edición y eliminación por usuario/materia,
   incluyendo comisiones diferentes. Un upsert aislado no garantiza la regla del último participante.
   Definir bloqueo u otra serialización, orden de adquisición compatible con bloqueos actuales,
   revalidación de permisos y existencia, y reintentos seguros frente a conflictos.
6. **Última puntuación:** acordar un orden transaccional inequívoco para escrituras concurrentes;
   no inferirlo de `updatedAt` del comentario, porque una edición de texto no es un voto.
   Revisar reintentos de puntuación idéntica: distinguir una intención de valorar de un reenvío
   técnico para no generar votos, eventos o reordenamientos involuntarios.
7. **API y lectura:** extender los contratos actuales con validaciones Zod en ambos lados y
   proyecciones públicas seguras. Exponer estrellas propias en comentarios y resumen agregado
   por materia; no exponer claves de usuario ni autores anónimos al calcularlo.
8. **Promedio:** agregar solo valoraciones vigentes, sin join que multiplique filas por carreras
   o comentarios. Revisar redondeo a un decimal, consistencia entre promedio y cantidad y
   actualización tras escritura; evitar contadores redundantes sin justificación.
9. **Migración de esta etapa:** preparar exclusivamente
   `back/prisma/migrations/20261112000000_valoracion_materias_estrellas/migration.sql`, aditiva,
   con las columnas nullable, tabla, PK, CHECK, FK e índices anteriores. Sin DML, backfill,
   modificación de migraciones previas ni acceso a bases. Ejecución y pruebas PostgreSQL pendientes
   de autorización separada. Los CHECK viven en SQL porque no se representan en este schema Prisma.

**Idempotencia excluida:** no crear FeedbackOperacion ni otro mecanismo nuevo en esta etapa.
Antes de diseñarlo se revisará si existe infraestructura reutilizable y se justificará su necesidad.
La propuesta anterior de ese modelo no forma parte de las decisiones aprobadas.

Las decisiones anteriores deben cerrarse dentro de esta tarea antes de escribir código del tramo
afectado, conforme al gate de [.agents/OVERVIEW.md](../../../.agents/OVERVIEW.md).

### Integración de creación autorizada (2026-11-12)

- El input de creación ya transporta puntuación obligatoria mediante el tipo inferido de Zod.
  No cambiar controller, servicio, puerto, permisos ni reglas académicas.
- Una sola transacción ReadCommitted guarda Feedback, snapshot de creación con sus estrellas,
  upsert de ValoracionMateria y evento de AdministracionHistorial correlacionado por UUID.
- Orden de bloqueo: comisión FOR UPDATE, snapshot y validaciones actuales, advisory transaccional
  usuario/materia, lectura del voto previo y escrituras. Namespace 2026071 y hash del par UUID
  normalizado a minúsculas; una colisión solo serializa pares adicionales. No tomar bloqueos
  adicionales de User/Materia ni reutilizar el namespace administrativo 2026070. Las transacciones
  revisadas no toman el nuevo advisory ni adquieren comisiones después de él; no introducir
  ciclos entre creaciones de distintas comisiones. Concurrencia real pendiente de PostgreSQL.
- El upsert usa la PK permanente, conserva createdAt y actualiza puntuación/updatedAt/deletedAt
  para actualizar o reactivar el mismo voto. Una nueva publicación no modifica estrellas de otras.
- Añadir puntuación nullable a los contratos de salida y la lectura de historial. Edición de texto
  y baja solo copian la puntuación existente al snapshot; no actualizan ni retiran el voto global.
- Ledger conserva entidad feedback, actor y formato campo/anterior/nuevo, con puntuación individual
  y cambios globales. La proyección administrativa aún filtra los campos nuevos; no ampliarla aquí.
- Traducir P2002 únicamente cuando identifica la unicidad autor/comisión; propagar otros conflictos.
  No hay replay de solicitudes: duplicado vigente devuelve 409 sin volver a escribir el voto.
- Sin mecanismo nuevo de idempotencia, migraciones, conexiones, frontend ni otros módulos.
  Se autoriza generar Prisma Client con el script existente, solo en src/generated/prisma,
  usando DATABASE_URL ficticia temporal; generación no implica validación de migraciones.
- TDD unitario sobre creación con dobles de transacción; los mocks no demuestran rollback real
  ni exclusión mutua de PostgreSQL. Añadir pruebas de integración pero no ejecutarlas en esta etapa.

## 4. Exclusiones y restricciones

### Estrellas individuales de lectura autorizadas (2026-11-12)

- Los tipos y schemas existentes ya incluyen puntuacion nullable en Feedback y FeedbackHistorial;
  no ampliarlos ni cambiar servicios. Usar exclusivamente el dato individual de cada registro.
- Exportar EstrellasFeedback desde FeedbackCard.tsx, dentro del alcance autorizado, y reutilizar
  su presentación en ExperienceCard y FeedbackHistorial. Sin nuevo archivo de producción.
- Cinco Star decorativas, rellenas hasta la puntuación individual, con un único texto visible
  «N de 5 estrellas». Sin radios, botones ni interacción. NULL no renderiza puntuación ni ceros.
  CSS local en feedback.module.css con tokens y ajuste de línea, sin estilos globales.
- Conservar texto, docente, fechas, anonimato, enlaces, acciones, permisos, paginación y carga
  diferida del historial. No realizar solicitudes adicionales ni usar el promedio de materia.
- ExperienceCard propaga el cambio a Experiencias y comisiones, incluidos sus listados
  administrativos; AdminExperienceCard del detalle/auditoría es distinto y queda fuera de alcance.
- TDD de puntuaciones 1..5/NULL, anonimato y snapshots distintos de la puntuación actual;
  regresión focalizada, typecheck, ESLint y git diff --check. No tocar formulario, promedios,
  backend, Prisma, bases, rutas, autenticación ni TASK-072.

#### Resultado de estrellas individuales (2026-11-12)

- RED: 13 fallidas y dos aprobadas en los 15 casos nuevos; 36 pruebas existentes excluidas
  por filtro. Fallaban las puntuaciones ausentes; NULL ya conservaba ausencia de estrellas.
- GREEN/regresión final: 149 aprobadas, cero fallidas y cero omitidas en diez archivos.
  Desde front/: `node ../node_modules/vitest/vitest.mjs run --config tests/vitest.config.mjs
  tests/feedback-estrellas-presentacion.spec.tsx tests/feedback-components.spec.tsx
  tests/feedback-comision.spec.tsx tests/experiencias-list.spec.tsx
  tests/admin-experience-audit.spec.tsx tests/admin-experience-removal.spec.tsx
  tests/feedback-service.spec.ts tests/feedback-validation.spec.ts
  tests/selector-estrellas.spec.tsx tests/comision-detalle.spec.tsx --cache=false`.
- Casos 1..5/NULL en tarjeta propia y pública, iconos decorativos, cinco estrellas con relleno
  individual, descripción única y ausencia de controles. Preservación de texto/docente/fecha y
  anonimato. Fixture con promedio de materia distinto confirma que no se utiliza como sustituto.
- Snapshot NULL y versiones de edición/eliminación con puntuaciones distintas de la actual;
  historial sigue sin solicitudes antes de abrir y conserva paginación y permisos existentes.
- Typecheck aplicación/tests aprobado con --noEmit --incremental false (tsconfig.json y
  tsconfig.test.json). ESLint de cinco archivos TS/TSX afectados aprobado sin advertencias;
  git diff --check aprobado. Sin conexiones a bases ni modificaciones fuera del alcance.
- Pendiente revisión visual manual en móvil/escritorio y navegador. Sin incompatibilidades
  nuevas detectadas con los contratos actuales; detalle administrativo AdminExperienceCard no
  modificado. Sin backend/Prisma, migraciones, formulario/selector, promedios, dependencias,
  rutas/permisos, commits ni pushes. TASK-071 sigue abierta; detenerse antes de otras funcionalidades.

### Resumen visual de materias autorizado (2026-11-12)

- Mantener Materia y materiaSchema para escrituras administrativas. Añadir MateriaConValoracion
  y schema enriquecido exclusivamente para listarMaterias/obtenerMateria; useMateria conserva
  el dato en su estado. No añadir peticiones, cache ni cálculos de promedio en frontend.
- Validar cantidad entera no negativa y segura; promedio NULL solo con cantidad cero, o número
  finito entre 1 y 5 con cantidad positiva. Rechazar respuestas incompletas/incoherentes con el
  error de contrato existente; no sustituirlas por cero votos.
- ValoracionMateria local a academic, sin interacción: Star decorativa y texto accesible,
  Intl.NumberFormat es-AR con un decimal, singular/plural y «Sin valoraciones». Reutilizarlo en
  filas de listado y encabezado del detalle, CSS Module con tokens existentes y ajuste de línea.
- Mantener filtros, agrupación por carrera/año, paginación, enlaces, permisos y escrituras.
  Adaptar únicamente fixtures de lecturas afectadas; no exigir valoracion en altas/PATCH.
- TDD de contratos HTTP y presentación, regresión académica/administrativa y typecheck/lint.
  Sin backend, Prisma, bases, formulario de comentarios, tarjetas, historial visual ni TASK-072.

#### Resultado del resumen visual (2026-11-12)

- RED inicial: 21 fallidas y una aprobada en dos archivos; faltaban conservación/validación del
  resumen y presentación. La escritura administrativa sin valoracion ya funcionaba.
- GREEN inicial: 22 aprobadas; se añadieron después cobertura de privacidad del schema y
  proyección de una materia compartida entre carreras/años. Última ejecución específica:
  24 aprobadas en materia-valoracion-service.spec.ts y materia-valoracion-components.spec.tsx.
- Regresión académica/administrativa: 235 aprobadas, cero fallidas y cero omitidas en 21 archivos.
  Incluye servicios y componentes académicos, bajas, detalles administrativos, precarga,
  asignaciones, carreras de comisión, altas, presentación/tablas administrativas, detalle de
  comisión, modal de cursadas, fixtures de consultas de Experiencias, HU11, listados, detalle,
  filtros y opciones de materias. Vitest con tests/vitest.config.mjs y --cache=false, sin bases.
- Adaptaciones de fixtures limitadas a lecturas: resumen explícito NULL/0. Los fixtures de
  creación/actualización administrativa siguen sin exigirlo. El fixture estático de listado
  también se actualizó tras detectar su omisión en la primera regresión.
- Typecheck de aplicación y tests aprobado con --noEmit --incremental false; ESLint de los
  25 archivos TypeScript afectados aprobado sin advertencias; git diff --check aprobado.
- Formato es-AR de un decimal y cantidad, singular/plural, «Sin valoraciones», Star decorativa
  y CSS Module con tokens/flex-wrap. No recalcular promedios ni hacer peticiones adicionales.
- Pendiente revisión visual manual responsive y en navegador. Las lecturas requieren backend
  actualizado: valoracion ausente o incoherente produce el HttpError 502 existente, nunca NULL/0
  silencioso. Sin cambios de backend, Prisma, bases, dependencias, rutas, permisos ni formulario.
  TASK-071 permanece en progreso. No avanzar a tarjetas públicas, historial visual ni TASK-072.

### Formulario frontend autorizado (2026-11-12)

- Ampliar Feedback y FeedbackHistorial con puntuacion nullable validada en schemas de respuesta;
  FeedbackInput exige número 1 a 5 y FeedbackEdicion lo permite opcionalmente, nunca NULL.
- SelectorEstrellas local al módulo: cinco radios nativos, fieldset/legend, Star de Lucide
  decorativo, nombre puntuacion y etiquetas 1 estrella/2..5 estrellas. Sin valor inicial en
  creación, con valor original en edición; sin acción para quitar estrellas. Foco visible,
  radios enfocables, error asociado y deshabilitados al enviar. CSS solo del módulo actual.
- FeedbackEditor incluye puntuación en FormData, estado y dirty/cancelación. Validar cadena
  exacta 1..5 antes de convertir a número; vacío permitido solo para original histórico NULL.
  POST siempre incluye puntuacion; diferenciasFeedback añade estrellas al PATCH solo si cambian
  y no son NULL. Texto/anonimato y puntuación idéntica no reenvían estrellas.
- Conservar selección y demás campos ante errores; reutilizar useFormSubmission sin cambiarlo,
  protección contra doble envío, foco del error y navegación actual. No tocar docentes/permisos.
- Solo archivos de tipos/schema/validación Feedback, formulario, CSS local, selector nuevo,
  tests/fixtures Feedback y esta tarea. Sin backend, rutas, hooks/globales, materias, tarjetas,
  historial visual, TASK-072, dependencias ni bases. Las ampliaciones de fixtures preservan
  objetivos anteriores; la paridad de texto aporta estrellas válidas para aislar su validación.

#### Resultado del formulario (2026-11-12)

- RED: siete pruebas nuevas del formulario fallaron por ausencia del selector antes de implementar;
  las otras 29 quedaron fuera del filtro. GREEN focalizado inicial: 36 aprobadas.
- Regresión final sin filtros de casos: 134 aprobadas, cero fallidas y cero omitidas en nueve
  archivos. Comando desde front/: `node ../node_modules/vitest/vitest.mjs run --config
  tests/vitest.config.mjs tests/selector-estrellas.spec.tsx tests/feedback-components.spec.tsx
  tests/feedback-validation.spec.ts tests/feedback-service.spec.ts tests/feedback-comision.spec.tsx
  tests/experiencias-list.spec.tsx tests/comision-detalle.spec.tsx
  tests/admin-experience-audit.spec.tsx tests/admin-experience-removal.spec.tsx --cache=false`.
- Cobertura: creación obligatoria sin preselección; PATCH diferencial, puntuación idéntica,
  históricos NULL, incorporación de estrellas, cancelación, reintentos y doble envío. Selector
  probado con Tab/Espacio/flechas, errores asociados y bloqueo durante envío; servicios validan
  NULL y enteros 1..5 y rechazan respuestas incompatibles sin convertirlas silenciosamente.
- Typecheck de aplicación y tests aprobado (`--noEmit --incremental false`, tsconfig.json y
  tsconfig.test.json). ESLint de los doce archivos TypeScript afectados aprobado sin advertencias;
  aria-invalid se aplica al fieldset y aria-describedby vincula ayuda/error en cada radio.
  `git diff --check` aprobado.
- Pendiente aceptación visual manual en navegador, móvil y escritorio, incluido foco visible.
  El contrato requiere que el backend entregue puntuacion explícita (NULL para históricos);
  respuestas antiguas que omitan el campo se rechazan como incompatibles.
- Sin cambios de backend, Prisma, migraciones, dependencias, rutas, autenticación/permisos,
  tarjetas públicas, historial visual ni promedios visuales. Sin bases, commits o pushes.
  TASK-071 permanece en progreso; detenerse antes de ampliar el alcance.

### Resumen por materia autorizado (2026-11-12)

- Añadir ResumenValoracionMateria y MateriaConValoracion solo como tipos de lectura. Listado
  y detalle GET incluyen valoracion {promedio:number|null,cantidad:number}; escrituras conservan
  Materia base y no devuelven resumen ficticio. No cambiar autenticación, permisos ni rutas.
- Una agregación SQL parametrizada por lote sobre IDs ya paginados, desde ValoracionMateria,
  deletedAt NULL, GROUP BY materiaId, ROUND(AVG(puntuacion),1) convertido a double precision y
  COUNT(*) bigint convertido a number seguro. No joins con carreras, usuarios o comentarios.
- Mantener selección de IDs, filtros/EXISTS, búsqueda normalizada, total y orden actuales.
  Agregación e hidratación usan el tx RepeatableRead del listado. Página vacía omite agregación.
  Grupo ausente implica null/0; errores de consulta o conteos no seguros se propagan.
- Conservar findById() sin cambios y sin votos en recorridos internos/administrativos.
  Nuevo findByIdConValoracion() obtiene materia vigente y resumen en tx RepeatableRead.
  ObtenerMateria.execute cambia exclusivamente su delegación, manteniendo UUID y 404 existentes.
- API numérica redondeada; el frontend futuro debe dar formato de un decimal (JSON no conserva
  ceros finales). El schema frontend actual descarta el campo nuevo; no modificarlo en este bloque.
- Archivos autorizados: dominio/puerto/repositorio de Materia, ListarMaterias, ObtenerMateria,
  AcademicController, academic-fixture, academic.use-cases, nuevos tests específicos y esta tarea.
  Sin cambios de Prisma/migraciones, otros módulos, dependencias, frontend o configuración.
- TDD unitario y regresión sin conexiones. Integración PostgreSQL solo preparada, no ejecutada
  sin autorización nueva. Las 19 migraciones y 45 pruebas Feedback aprobadas corresponden al
  bloque previo autorizado en la base aislada; no repetirlas ni acceder ahora a esa base.

### Eliminación y baja del voto autorizadas (2026-11-12)

- Ampliar solo remove() (nombre real del método de eliminación), pruebas de eliminación y esta
  tarea. Mantener prevalidación y revalidación de permisos/baja después del bloqueo de comisión.
  Un comentario eliminado sigue devolviendo 404 sin repetir escrituras ni eventos.
- Orden compatible: comisión FOR UPDATE, relectura autorizada del comentario, advisory del par
  autorId/materiaId real del comentario (namespace 2026071, UUID en minúsculas), baja de Feedback,
  consulta de participantes y eventual baja del voto, auditoría y commit ReadCommitted.
  ADMIN usa su identidad como actor pero coordina y modifica el voto del autor del comentario.
- No obtener snapshot académico ni exigir comisión activa para retirar comentarios; conservar
  la capacidad de eliminación en contextos históricos/inactivos. No introducir bloqueos inversos.
- Participantes restantes: Feedback con autorId/materiaId del comentario, deletedAt NULL y
  puntuacion no nula, consultados después de su baja y dentro del bloqueo compartido con
  creación/edición. No filtrar por comisión ni carrera, ni inferir vigencia por historial.
- Si quedan participantes, no leer ni modificar el voto. No recalcular/restaurar puntuaciones.
  Si no quedan, dar de baja solo la valoración vigente existente, sin crear filas. Conservar PK,
  puntuacion y createdAt; actualizar únicamente deletedAt/updatedAt. Una fila ausente o ya dada
  de baja no requiere escrituras. Usar actualización condicional y auditar solo si afectó una fila.
- Eliminar un histórico sin estrellas no cambia participación ni voto; preservar snapshot NULL.
  Su bloqueo del par mantiene orden uniforme, sin consultas adicionales al voto global.
- Toda escritura comparte transacción. El evento de eliminación conserva UUID correlacionado,
  actor real, snapshot con estrellas y cambios existentes; agregar valoracionMateria.deletedAt
  solo ante baja global efectiva. La vista administrativa sigue fuera del alcance.
- Sin promedios, frontend, migraciones, conexiones, nuevos permisos, tablas o idempotencia.
  Las unitarias prueban protocolo/propagación; rollback y carreras reales quedan para PostgreSQL.

### Edición de estrellas autorizada (2026-11-12)

- Ampliar exclusivamente update() del repositorio, pruebas de edición y esta tarea. Los contratos
  nullable de salida existentes ya alcanzan; no cambiar dominio, validadores, servicio ni controller.
- Conservar prevalidación de autoría, bloqueo de comisión, relectura del comentario, snapshot
  académico y exigencia de comisión activa. Cambios efectivos de estrellas adquieren después
  el mismo advisory usuario/materia de creación (namespace 2026071, hash del par en minúsculas).
  El comentario queda protegido por la comisión mientras se espera el par; no adquirir bloqueos
  adicionales después del par que inviertan el orden de creación. Usar ReadCommitted explícito.
- Es cambio efectivo cuando puntuacion está presente y difiere de la puntuación actual del
  comentario, incluyendo NULL a entero. Omitirla conserva estrellas; NULL sigue rechazado por API.
- Puntuación idéntica no reescribe ni reactiva el voto, incluso si otro comentario dejó una
  puntuación global distinta. Si tampoco cambian texto/anonimato, no escribir ni auditar.
  Esta regla específica aprobada prevalece sobre la interpretación anterior de intención explícita.
- Cambio efectivo: una transacción actualiza comentario, snapshot de edición, upsert del voto
  único y auditoría anterior/nueva. Históricos pueden entrar a participar creando/actualizando/
  reactivando el voto; preservar identidad y createdAt global. Nunca tocar snapshots anteriores.
- Texto/anonimato sin cambio efectivo de estrellas no lee ni escribe el voto global. El snapshot
  conserva la puntuación individual. Si las estrellas individuales cambian pero el voto ya coincide,
  registrar el cambio individual sin inventar una diferencia global de puntuación.
- No implementar aún eliminación del voto global ni idempotencia general. Pruebas PostgreSQL
  solo preparadas; unitarias, tipos y lint sin conexiones. No modificar otros archivos.

- Sin valoración independiente: no puntuar sin publicar o editar un comentario.
- No cambiar la regla de una experiencia vigente por usuario y comisión, catálogo, autenticación,
  roles, permisos, navegación global, layout, hooks compartidos, estilos base ni primitivas globales.
- Feed, likes y respuestas pertenecen a TASK-072; no introducirlos en esta tarea.
- Stack oficial y dependencias actuales. No incorporar tecnología ni configuración global nueva.
- Etapa de persistencia anterior: schema y migración preparados; no volver a modificarlos.
- Autorización vigente: solo `feat/feed-principal`, repositorio Prisma de Feedback, contratos
  de dominio Feedback de bloques anteriores, `back/tests/feedback.integration.spec.ts`, tests de creación, edición y eliminación en
  `back/tests/` y esta tarea para decisiones/resultados. No modificar TASK-072 ni otros archivos.
- Sin ejecutar migraciones, acceder a bases, modificar datos, instalar dependencias, realizar
  refactorizaciones, cambios de rama, commits, pushes o merges. Se autoriza generar únicamente
  Prisma Client en la ruta configurada, pruebas unitarias sin base y comprobaciones estáticas.
- No implementar endpoints, servicios, controladores, idempotencia, formulario, promedios ni
  frontend. La eliminación del voto solo está autorizada dentro de remove() según las reglas
  anteriores. Continuar con otras funcionalidades requiere autorización explícita.
- La tarea permanece en `in-progress/`. El cierre completo requiere evidencia, aceptación manual,
  documentación de entrega y CHANGELOG; no se cierra ni modifica CHANGELOG con esta autorización.

## 5. Criterios de aceptación

1. Crear con texto válido y estrellas 1 o 5 tiene éxito; omitir texto/estrellas o enviar puntuación
   0, 6, 2.5, texto o NULL falla sin escrituras parciales.
2. Un mismo usuario con comentarios de 2 y 5 estrellas en dos comisiones de la misma materia
   conserva esas estrellas individuales y aporta un solo voto global de 5, aun en carreras distintas.
3. Editar las estrellas del primero a 4 deja el segundo en 5 y el voto global en 4. Editar solo
   texto no modifica ese voto ni su orden temporal.
4. Otro usuario aporta 3: el promedio es 3.5 y la cantidad 2. La presentación usa un decimal,
   respetando el formato local acordado. Sin votos se muestra «Sin valoraciones», nunca un cero ficticio.
5. Eliminar el comentario de 4 del ejemplo conserva el voto global de 4 si queda el de 5.
   Eliminar el último participante retira ese voto; un comentario histórico restante no lo mantiene.
6. Un comentario histórico conserva texto e historial sin estrellas; editar solo texto mantiene
   esa condición. Agregarle estrellas lo incorpora sin duplicar el voto global existente.
7. Fallos en comentario, voto o auditoría revierten toda la escritura. Reintentar no duplica
   comentarios, votos ni eventos; entradas del formulario se conservan ante errores.
8. Concurrencia entre creación, edición y eliminación no produce votos duplicados, votos activos
   sin participantes ni pérdida de la última puntuación según el orden acordado.
9. Autor y administrador conservan exactamente sus permisos actuales; anonimato público y
   auditoría autorizada siguen funcionando. La regresión de comentarios existentes permanece verde.

## 6. Validaciones requeridas para la implementación futura

- TDD: test define escenarios RED antes del código; back/front implementan y registran GREEN.
- Unitarias de validación, participación, agregación, retiro de voto y errores; paridad de
  validaciones frontend/backend según [validación con Zod](../../standards/validacion-con-zod.md).
- HTTP/PostgreSQL aislado: restricciones reales, unicidad compartida entre carreras, rollback
  provocado en cada escritura, permisos, CSRF, auditoría, históricos y reintentos.
- Concurrencia real entre distintas comisiones de una materia: crear/editar/eliminar con última
  puntuación inequívoca, último participante y reactivación de valoración retirada.
- Migraciones en base efímera autorizada: preservar comentarios/historiales, comprobar CHECK,
  FK, índices y deriva. Nunca usar datos de desarrollo o producción como fixtures.
- UI con herramientas existentes: selección y edición por teclado, etiquetas accesibles,
  errores recuperables, envío pendiente, históricos opcionales y resumen actualizado sin recargar.
- Regresión de anonimato, edición, eliminación del autor/ADMIN, historial y unicidad por comisión.
- Typecheck, lint, tests y builds pertinentes; ambos checks CI exigidos por CONTRIBUTING antes
  del cierre. Navegador/visual según [frontend-tests](../../standards/frontend-tests.md), con
  aceptación manual de escritorio/móvil. En el bloque actual se permiten unitarias sin base y
  validaciones estáticas sin generación de archivos; las pruebas PostgreSQL quedan pendientes.

## 7. Dependencias, riesgos y secuencia incremental

Dependencias: comentarios actuales y su auditoría; ninguna modificación a tareas ajenas.
TASK-072 depende parcialmente de esta tarea para mostrar estrellas propias, no para likes/respuestas.

Secuencia propuesta, cada tramo sujeto a revisión y autorización:

1. Persistencia y backend de estrellas, cerrando primero las propuestas de la sección 3.
2. Formulario de creación y edición con estrellas y tratamiento de históricos.
3. Resumen de valoraciones por materia.
4. Integración del feed en Inicio (TASK-072).
5. Likes (TASK-072).
6. Respuestas (TASK-072).
7. Scroll infinito y pruebas de integración de ambos recorridos (TASK-072).

Riesgos: reutilizar el esquema anterior perdería estrellas individuales; un flag redundante
puede divergir; concurrencia y bloqueos por comisión no cubren varias comisiones de una materia;
recalcular desde comentarios supervivientes violaría la conservación del último voto; agregaciones
por carrera pueden duplicar votos; ampliar auditoría puede revelar identidades si no se separan
las proyecciones privadas y públicas. Mitigar con las decisiones y pruebas anteriores.

## 8. Resultado y evidencia

Planificación documental preparada el 2026-11-11. Primera etapa de persistencia autorizada el
2026-11-12: schema y SQL preparados, sin ejecutar migración, generar cliente ni pruebas funcionales.
Verificaciones estáticas: contenido previo del schema preservado fuera de las adiciones aprobadas;
SQL con tres CHECK, dos FK y dos índices, sin DML ni operaciones destructivas; migraciones
anteriores sin cambios; enlaces locales de TASK-071/TASK-072 y espacios finales correctos;
`git diff --check` correcto. Rama conservada: `feat/feed-principal`.
No se ejecutó `prisma validate`: Prisma no está instalado en `node_modules`; no se instalaron
dependencias. El SQL no fue validado por PostgreSQL ni se comprobó deriva con una base shadow.
Pendientes: ejecución autorizada en base aislada, restricciones reales, deriva de migraciones e
integración de lógica, auditoría y concurrencia. No se declara TASK-071 terminada ni validada.

### Resultado del bloque de creación (2026-11-12)

- Prisma Client 6.19.3 generado con `npm.cmd run db:generate --workspace=back`: 24 archivos
  TypeScript únicamente en `back/src/generated/prisma/`, ignorados por Git. URL ficticia
  `127.0.0.1:1` en variable temporal restaurada/retirada con finally; sin migraciones ni conexiones.
- RED: `feedback-create.spec.ts`, 10 fallidas y 7 aprobadas antes de implementar.
- GREEN: 17 pruebas de creación aprobadas; junto con feedback-input y feedback-removal-policy,
  72 pruebas aprobadas en tres archivos, sin base ni caché de Vitest.
- Comando unitario: `node ../node_modules/vitest/vitest.mjs run tests/feedback-create.spec.ts
  tests/feedback-input.spec.ts tests/feedback-removal-policy.spec.ts --cache=false` desde `back/`.
- TypeScript de aplicación y tests correcto con `--noEmit --incremental false`; ESLint de los
  cuatro archivos TS del bloque correcto con cero advertencias. Sin generar builds ni tsbuildinfo.
- Preparados cinco casos de integración: creación/actualización entre comisiones de carreras
  compartidas, reactivación, concurrencia y dos fallos de rollback (voto y auditoría). No ejecutados.
  Fixtures HTTP existentes incluyen puntuación válida y limpieza de valoraciones propias.
- Comando pendiente: `npm run test --workspace=back -- tests/feedback.integration.spec.ts --cache=false`,
  solo con TEST_DATABASE_URL apuntando a una base aislada y migraciones previamente autorizadas/aplicadas.
- Límite deliberado: el backend todavía ignora cambios de estrellas en PATCH y no retira votos
  al eliminar comentarios. Solo conserva estrellas en sus snapshots. No habilitar como TASK-071
  completa; frontend sin estrellas aún no puede publicar. La vista administrativa filtra campos
  nuevos de auditoría, aunque el ledger los conserva. No hay replay idempotente de solicitudes.
- No se han probado rollback real, bloqueos reales, FK/CHECK ni deriva de migraciones. Se mantienen
  pendientes de autorización PostgreSQL y revisión funcional. Sin commits, pushes ni merges.

### Resultado del bloque de edición (2026-11-12)

- Implementada edición de puntuación individual y upsert global atómico, incluyendo históricos
  y reactivación. Sin cambios de dominio, creación, eliminación, validadores, frontend ni permisos
  en este bloque. El límite anterior de PATCH ignorado queda resuelto; retiro del voto sigue pendiente.
- RED: `feedback-update.spec.ts`, 12 fallidas y 9 aprobadas antes de implementar.
- GREEN: las 21 pruebas nuevas de edición pasan. Regresión focalizada con creación, validaciones
  y permisos: 93 pruebas aprobadas en cuatro archivos, ejecutadas sin conexiones ni caché.
- Comando: `node ../node_modules/vitest/vitest.mjs run tests/feedback-update.spec.ts
  tests/feedback-create.spec.ts tests/feedback-input.spec.ts tests/feedback-removal-policy.spec.ts
  --cache=false` desde `back/`.
- Typecheck de aplicación y tests aprobado con `--noEmit --incremental false`. ESLint del
  repositorio y ambos archivos de pruebas afectados aprobado con cero advertencias.
  `git diff --check` aprobado. No generar de nuevo Prisma Client ni modificar schema o migraciones.
- Diez casos de integración nuevos preparados, no ejecutados: edición entre comisiones,
  estrellas idénticas/texto/anonimato, histórico sin estrellas y posterior incorporación,
  actualización/reactivación de voto previo, permisos/NULL/comisión inactiva, rollback en tres
  puntos de escritura y concurrencia creación/edición. Mantener el comando PostgreSQL pendiente
  indicado en el bloque anterior y usar exclusivamente una base aislada autorizada.
- Las unitarias comprueban coordinación, escrituras y propagación de errores mediante dobles;
  no demuestran rollback ni bloqueos reales. La migración sigue sin ejecutarse. Continúan pendientes
  retiro del voto global, frontend y visibilidad administrativa de los nuevos campos de auditoría.
- Sin bases de datos, dependencias nuevas, cambios de rama, commits, pushes ni merges.

### Resultado del bloque de eliminación (2026-11-12)

- remove() mantiene baja lógica, autoría/ADMIN, posibilidad de retirar en comisión inactiva,
  snapshot de eliminación y UUID compartido con auditoría. Añade advisory del autor/materia
  después de comisión, usando el mismo protocolo de creación/edición y ReadCommitted explícito.
- Tras dar de baja un comentario puntuado, consulta participantes vigentes y puntuados en toda
  la materia. Si queda alguno, el voto queda intacto, incluso si su puntuación provenía del
  comentario eliminado. Sin participantes, retira solo el voto vigente existente y conserva
  PK, puntuación y createdAt. Histórico sin estrellas no modifica voto ni cuenta como participante.
- Baja global y auditoría comparten transacción con Feedback/historial. No crea votos ni repite
  bajas de valoraciones ya retiradas. Reintento sobre comentario eliminado sigue devolviendo 404.
- RED: `feedback-remove.spec.ts`, 9 fallidas y 8 aprobadas antes de implementar.
- GREEN/regresión: 110 pruebas aprobadas en cinco archivos (17 nuevas de eliminación, 21 edición,
  17 creación, 51 validación y 4 permisos). Comando desde `back/`:
  `node ../node_modules/vitest/vitest.mjs run tests/feedback-remove.spec.ts tests/feedback-update.spec.ts
  tests/feedback-create.spec.ts tests/feedback-input.spec.ts tests/feedback-removal-policy.spec.ts --cache=false`.
- Typecheck de aplicación/tests aprobado sin emisión ni incremental; ESLint de repositorio y
  pruebas afectadas aprobado con cero advertencias; `git diff --check` aprobado.
- Diez casos de integración nuevos preparados, sin ejecutar: último participante con histórico
  restante, conservación de última puntuación y actor ADMIN, dos variantes de baja histórica,
  dos últimas eliminaciones concurrentes, baja concurrente con creación/edición histórica y
  tres fallos de rollback. Comando pendiente: `npm run test --workspace=back --
  tests/feedback.integration.spec.ts --cache=false`, solo con base aislada y migraciones autorizadas.
- Las unitarias no prueban rollback ni bloqueos PostgreSQL reales. Continúan pendientes las
  pruebas de base, promedios y frontend; la proyección administrativa aún filtra campos nuevos.
  No reparar automáticamente datos inconsistentes previos ni crear votos ausentes al eliminar.
- Sin migraciones, conexiones, cambios de schema/dependencias/configuración, commits, pushes
  o merges. No modificar creación/edición ni otros archivos en este bloque. TASK-071 sigue abierta.

### Resultado del resumen backend (2026-11-12)

- GET /materias y GET /materias/:id incorporan valoracion con promedio numérico redondeado y
  cantidad, o null/0 sin votos. MateriaConValoracion extiende la lectura sin alterar Materia base.
- Consulta SQL por lote de IDs de página, exclusivamente sobre valoraciones vigentes. Misma
  transacción RepeatableRead que filtros/total/hidratación; el detalle usa la misma agregación
  dentro de su propia transacción. No cargar usuarios/comentarios ni filtrar votos por carrera.
- findById interno y mapper base permanecen intactos. ObtenerMateria solo cambia la delegación
  a findByIdConValoracion; UUID y errores existentes conservados. Contratos POST/PATCH siguen
  sin resumen. Los errores de agregación no se sustituyen por null/0.
- RED: 11 fallidas y 2 aprobadas en materia-valoracion.spec.ts antes de implementar.
- GREEN inicial: 13 pruebas nuevas y regresión académica focalizada, 152 aprobadas en 5 archivos.
- Regresión final: 383 pruebas aprobadas en 15 archivos, incluyendo todos los consumidores del
  fixture académico y las 110 unitarias de Feedback. Sin ejecutar suites de integración ni bases.
- Typecheck de aplicación/tests correcto con --noEmit --incremental false; ESLint de los diez
  archivos TypeScript afectados correcto, sin advertencias; git diff --check correcto.
- Nueva materia-valoracion.integration.spec.ts: 11 casos preparados, sin ejecutar. Cubren null/0,
  extremos 1/5, redondeo 3.25 a 3.3, conteos, baja/reactivación, carreras compartidas, páginas,
  ciclo real de comentarios y voto único, privacidad, sesión/UUID/404 y contratos administrativos.
- Ejecución futura pendiente de autorización: `npm run test --workspace=back --
  tests/materia-valoracion.integration.spec.ts --cache=false --no-file-parallelism`, únicamente
  contra PostgreSQL aislado verificado, con variables temporales y restauración mediante finally.
- Checkpoint previo confirmado por el desarrollador: 19 migraciones aplicadas y 45 pruebas
  Feedback aprobadas en base aislada. No se ejecutaron de nuevo ni se accedió a esa base en este bloque.
- Limitaciones: SQL/decimales reales y consistencia bajo concurrencia requieren integración;
  el frontend actual descarta valoracion hasta ampliar su schema y debe formatear un decimal.
  La respuesta JSON numérica no conserva ceros finales. No introducir cache, ranking ni endpoints.
- Sin cambios de frontend, Prisma/migraciones, configuración/dependencias, autenticación/permisos,
  operaciones administrativas de escritura, rama, commits, pushes o merges. TASK-071 sigue abierta.
