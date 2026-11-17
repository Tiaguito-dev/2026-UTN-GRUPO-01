# Moderación humana y reportes: plan incremental

Fecha: 2026-11-17. Autorizado ejecutar únicamente T1 y sus pruebas. Sin commits.

## Objetivo, alcance y contradicciones comprobadas

Completar en seis etapas el flujo humano y reportes dentro de ReviewsModule, reutilizando
FeedbackService/repositorio, FeedbackHistorial, AdministracionHistorial y las vistas existentes.
El objetivo temporal es terminar antes del miércoles 18; esta autorización se detiene tras T1.

El código actual publica por deletedAt, carece de estados y reportes, y actualiza valoraciones
al crear/editar. Experiencias es comunitario, no un listado propio. ADMIN solo puede retirar.
El clasificador es experimental offline: no está conectado al backend. La baja lógica libera
el índice autor/comisión; un rechazo debe conservar antecedente incluso tras retirar/recrear.
Estas diferencias impiden desplegar T1 aisladamente como moderación funcional: T2 debe cerrar
todas las lecturas y agregados antes de habilitar cualquier transición por API en T3.

El nuevo umbral reemplaza la propuesta anterior de que reportar nunca modifica visibilidad:
tres denunciantes únicos con reportes ABIERTO ocultan preventivamente, sin cambiar APROBADO.
RECHAZADO no representa ocultamiento temporal. Resolver un reporte no equivale a rechazar texto.

## Decisiones de datos y transiciones

- Estado: PENDIENTE/APROBADO/RECHAZADO; deletedAt independiente y prioritario.
- Causas independientes: ocultoAutor, ocultoAdministracion, ocultoReportes. No se restablecen
  implícitamente al aprobar o levantar otra causa. Visibilidad futura: aprobado, vigente y sin causas.
- Versión monotónica para decisiones concurrentes. RevisionHumana obligatoria después de rechazo.
- Motivo obligatorio, normalizado, máximo 1000 caracteres y sin controles para aprobar, rechazar,
  ocultar/restaurar administrativamente y, en T5, resolver/desestimar reportes. Se aplica también
  a aprobación para cumplir la regla de resoluciones administrativas justificadas del pedido.
- Autor oculta solo su aprobado. Mostrar de nuevo exige aprobado y ausencia de otras causas.
- ADMIN puede aprobar pendientes ajenos; rechazar pendientes/aprobados; ocultar aprobados y
  levantar exclusivamente su causa. No puede aprobar su propia experiencia.
- Rechazado corregido permanece rechazado hasta solicitud explícita. Reenvío requiere texto
  realmente distinto del snapshot de rechazo. Corrección/reenvío conserva referencias históricas
  y no depende de que el contexto académico permanezca activo (conexión de edición en T3).
- T1 conserva experiencias existentes como APROBADO sin inventar aprobación humana; nuevos
  registros tienen default PENDIENTE. Historial antiguo tiene metadatos nuevos nulos, no inferidos.
- Historial de estado/causas y auditoría con actor comparten UUID y transacción. No duplicar ledger.
- T1 agrega persistencia interna de decisiones en el repositorio existente, sin endpoints ni wiring
  nuevo del servicio HTTP. Los escritores públicos actuales se conectan a esta política en T2/T3;
  hasta entonces no desplegar esta etapa. No se afirma que T1 proteja visibilidad pública.

## T1 — Persistencia y transiciones (única etapa autorizada)

Archivos: back/prisma/schema.prisma y migración nueva; reviews/domain/feedback-moderation.ts;
reviews/application/errors.ts y ports/feedback.repository.ts; repositorio Prisma existente;
tipos históricos internos; back/tests/feedback-moderation*.spec.ts; back/OVERVIEW.md y CHANGELOG.md.

Cambios mínimos: enums, campos y restricciones de estado/causas/motivo/versión; snapshots
opcionales para compatibilidad; función pura de transiciones autorizadas; operación interna
transaccional en el repositorio con versión esperada y snapshots correlacionados.

Dependencias: ninguna. No crear reportes, endpoints, UI, clasificador ni recalcular agregados.
Aceptación: backfill conserva datos/bajas; default pendiente; motivos y autoría comprobados;
causas independientes; autorrevisión prohibida; versión obsoleta falla; evento y cambio atómicos;
transiciones sobre bajas fallan; no-op no duplica auditoría. API existente conserva contrato.

Pruebas: primero RED de dominio y repositorio; integración SQL real en esquema aislado,
restricciones, rollback y decisiones concurrentes. Regresión backend, typecheck y lint.
No declarar integraciones ejecutadas si falta TEST_DATABASE_URL. No aplicar a base productiva.

## T2 — Visibilidad, autorizaciones y estadísticas (requiere autorización posterior)

Archivos/módulos: repositorios reviews (feedback/feed/likes/respuestas/ranking), política de
visibilidad, prisma-materia.repository y mantenimiento de ValoracionMateria, tests asociados.
Depende de T1. Centralizar predicado visible Prisma/SQL, aplicar también en conteos y accesos
directos. Las nuevas altas quedan pendientes sin efectos públicos. Un voto por autor/materia,
tomado de su última experiencia visible puntuada (último evento de contenido, desempate estable).
Sin elegibles, baja de valoración. No dar acceso público al historial ni identidad anónima.
Aceptación/pruebas: matriz estados x causas x roles x superficies; likes/respuestas ocultos con
padre; concurrencia y rollback de votos; conservar cursores, snapshots y consultas paginadas.

## T3 — Acciones de autor y administración

Archivos/módulos: FeedbackService, ReviewsController/controlador ADMIN dentro de ReviewsModule,
validaciones/puertos y detalle administrativo existente; tests HTTP y repositorios.
Depende de T2. Exponer propias, moderación, ocultar/restaurar y solicitud de revisión con versión.
Conectar edición parcial real e historial con estado; cualquier edición de aprobado pasa pendiente;
rechazado no se autopublica. Corregir rechazados aun con contexto cerrado usando snapshot.
Mantener antecedente tras retiro/recreación. Mantener normas, CSRF, permisos y orden de bloqueos.
Aceptación/pruebas: autor/ADMIN/tercero, motivo obligatorio, no autorrevisión, conflictos 409,
no-op sin escritura y contexto eliminado. Reutilizar detalle privado y administrativo separados.

## T4 — Persistencia, API y reglas de reportes

Archivos/módulos: Prisma/migración, servicio/repositorio de reportes dentro de reviews,
controladores existentes/ADMIN del mismo módulo, validaciones y pruebas.
Depende de T3. Estados ABIERTO/RESUELTO/DESESTIMADO. Registrar versión y snapshot reportado,
denunciante de sesión, motivo obligatorio y descripción opcional <=1000. Motivos: insultos/acoso,
amenazas/intimidación, discriminación, datos personales, spam, otro. Solo publicados ajenos.
Un reporte por usuario/comentario/versión, reintento idempotente. Límite cinco nuevos reportes
por usuario cada diez minutos, transaccional en PostgreSQL para varios procesos, 429 al exceder.
Aceptación/pruebas: identidad privada, unicidad concurrente, rate limit, CSRF y permisos,
versiones históricas consultables por ADMIN, auditoría de creación y resoluciones.

## T5 — Umbral preventivo y resolución administrativa

Archivos/módulos: servicio/repositorio reportes y transiciones, bandeja/query ADMIN, auditoría
y sincronización de valoraciones; pruebas integración concurrentes.
Depende de T4. Contar denunciantes únicos con ABIERTO del comentario (no sumar dos versiones
del mismo usuario). Al tercero activar solo ocultoReportes y generar evento/entrada de revisión
en la misma transacción, sin cambiar moderación ni crear otra cola física. El actor del evento
es el usuario cuyo reporte disparó la regla; registrar origen automático, no una persona ficticia.
Resolver/desestimar con motivo; reportes cerrados no cuentan ni se reabren. Restitución preventiva
explícita ADMIN exige menos de tres denunciantes abiertos y deja intactas otras causas. No quitar
automáticamente la causa por cerrar un reporte. Nuevos reportes válidos pueden disparar otro ciclo.
La bandeja deriva revisión pendiente de ocultoReportes y reportes abiertos, sin nuevo estado
de publicación. Aceptación/pruebas: 2/3, duplicados, varios usuarios/versiones, carrera con
restitución, preservación de causas, nuevos ciclos, auditoría y agregados atómicos.

## T6 — Interfaz, E2E y documentación

Archivos/módulos: feedback/admin existentes, services/tipos/schemas/validaciones, CSS de dominio,
tests front, Playwright y OVERVIEW de front/back. Depende de T3–T5.
Reutilizar Form/Detail/ExperienceCard, Dialog/Notice/confirmaciones; pestañas propias y bandeja
en páginas existentes, sin layout/router/auth/hooks/primitivas globales. Historial 3, listados 9.
Mostrar estado, causas y motivo seguro; ocultar/restaurar, corrección/reenvío y reportar. Filtros
ADMIN por estado/causa/motivo y denunciantes válidos; resolución siempre justificada.
Alta a home con mensaje pendiente; edición a detalle; conservar borradores ante error.
Aceptación: recorrido autor -> revisión -> publicación -> tres reportes -> ocultamiento ->
resolución -> restitución; rechazo/corrección/reenvío; móvil/desktop, teclado/foco y anonimato.
Pruebas: contratos, componentes, E2E real multisesión, axe, typecheck/lint/tests/build ambos
workspaces. Mantener likes/respuestas, borradores, cursores, snapshots y puntuaciones históricas.

## Exclusiones y entrega

Sin dependencias nuevas, Gemini, clasificadores, cambios M1.3/experimentos, commits ni refactor
general. T1 no constituye flujo funcional de navegador ni habilita despliegue aislado.
Al terminar T1: registrar archivos, migración generada/aplicación solo aislada, comandos y resultados,
riesgos y preparación para T2. Detenerse y esperar autorización; no avanzar si hay fallos.

## Estado de ejecución al 2026-11-17

T1 implementada y validada; [archivos, migración y evidencia](../finished/TASK-moderacion-T1-persistencia.md).
53 pruebas específicas aprobadas con PostgreSQL real; tipos, lint y build aprobados. La regresión
global y sus fallos transitorios/reintentos se documentan sin afirmar una ejecución global verde.
T2–T6 no ejecutadas y requieren autorización posterior. No se desplegó a datos del usuario.
