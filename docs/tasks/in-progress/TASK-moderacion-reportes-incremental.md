# Moderación humana y reportes: plan incremental

Fecha: 2026-11-17. T1–T5 completadas y validadas. Detenerse antes de T6.
T1 registrada por pedido explícito en commit local `2f619db`, sin push. El cierre local de T2
en cuatro commits fue autorizado posteriormente; no incluye push ni autorización para T3.
T3 fue autorizada después, mediante el pedido específico de acciones HTTP y pruebas; sin commits.

## Objetivo, alcance y contradicciones comprobadas

Completar en seis etapas el flujo humano y reportes dentro de ReviewsModule, reutilizando
FeedbackService/repositorio, FeedbackHistorial, AdministracionHistorial y las vistas existentes.
El objetivo temporal es terminar antes del miércoles 18; la autorización actual se detiene tras T5. M1.3 queda estacionada por decisión del usuario.

El diagnóstico inicial encontró publicación por deletedAt, ausencia de estados y reportes,
y actualización de valoraciones al crear/editar. T1 y T2 corrigen persistencia y visibilidad.
Experiencias sigue siendo comunitario, no un listado propio. Las nuevas acciones HTTP de ADMIN
quedan para T3.
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
  ocultar/restaurar administrativamente y, en T4 por pedido explícito, resolver/desestimar reportes. Se aplica también
  a aprobación para cumplir la regla de resoluciones administrativas justificadas del pedido.
- Autor oculta solo su aprobado. T3 permite levantar solo su causa sobre un aprobado aun con
  otras causas activas; estas siguen impidiendo visibilidad pública. Reemplaza la restricción T1.
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

## T1 — Persistencia y transiciones (completada)

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

## T2 — Visibilidad, autorizaciones y estadísticas (completada)

Archivos/módulos: repositorios reviews (feedback/feed/likes/respuestas/ranking), política de
visibilidad, prisma-materia.repository y mantenimiento de ValoracionMateria, tests asociados.
Depende de T1. Centralizar predicado visible Prisma/SQL, aplicar también en conteos y accesos
directos. Las nuevas altas quedan pendientes sin efectos públicos. Un voto por autor/materia,
tomado de su última experiencia visible puntuada (último evento de contenido, desempate estable).
Sin elegibles, baja de valoración. No dar acceso público al historial ni identidad anónima.
Aceptación/pruebas: matriz estados x causas x roles x superficies; likes/respuestas ocultos con
padre; concurrencia y rollback de votos; conservar cursores, snapshots y consultas paginadas.
Decisiones y ejecución: [ficha T2](../finished/TASK-moderacion-T2-visibilidad.md). Conectar escrituras actuales
con sincronización de votos y edición aprobado -> pendiente es parte de cerrar los bypass de T2;
no se adelantan endpoints de T3. No modificar frontend ni la migración T1.

## T3 — Acciones de autor y administración (completada)

Autorizada después del cierre limpio de T2 en `461f9c5`. Decisiones de contrato y evidencia:
[ficha T3](../finished/TASK-moderacion-T3-acciones.md). No autoriza T4–T6.

Archivos/módulos: FeedbackService, ReviewsController/controlador ADMIN dentro de ReviewsModule,
validaciones/puertos y detalle administrativo existente; tests HTTP y repositorios.
Depende de T2. Exponer propias, moderación, ocultar/restaurar y solicitud de revisión con versión.
Conectar edición parcial real e historial con estado; cualquier edición de aprobado pasa pendiente;
rechazado no se autopublica. Corregir rechazados aun con contexto cerrado usando snapshot.
Mantener antecedente tras retiro/recreación. Mantener normas, CSRF, permisos y orden de bloqueos.
Aceptación/pruebas: autor/ADMIN/tercero, motivo obligatorio, no autorrevisión, conflictos 409,
no-op sin escritura y contexto eliminado. Reutilizar detalle privado y administrativo separados.

## T4 — Persistencia, API y reglas de reportes

Autorizada después del cierre local T3 en `2835d55`, con árbol limpio. El pedido de T4
adelanta desde la propuesta T5 la consulta y resolución/desestimación individual:
[ficha T4](../finished/TASK-moderacion-T4-reportes.md). Esto no autoriza el umbral,
ocultamiento, restitución preventiva ni interfaz de T5/T6.

Archivos/módulos: Prisma/migración, servicio/repositorio de reportes dentro de reviews,
controladores existentes/ADMIN del mismo módulo, validaciones y pruebas.
Depende de T3. Estados ABIERTO/RESUELTO/DESESTIMADO. Registrar versión y snapshot reportado,
denunciante de sesión, motivo obligatorio y descripción opcional <=1000. Reutilizar snapshot
exacto por FK, sin copiar textos. Motivos: insultos/acoso,
amenazas/intimidación, discriminación, datos personales, spam, otro. Solo publicados ajenos.
Un reporte por usuario/comentario/versión, reintento idempotente. Límite cinco nuevos reportes
por usuario cada diez minutos, transaccional en PostgreSQL para varios procesos, 429 al exceder.
Aceptación/pruebas: identidad privada, unicidad concurrente, rate limit, CSRF y permisos,
versiones históricas consultables por ADMIN, auditoría de creación y resoluciones.
Consulta ADMIN paginada de nueve, filtros estado/motivo/experiencia, detalle con evidencia,
conteos y resoluciones anteriores de tres. Cierre individual ABIERTO -> RESUELTO/DESESTIMADO
con motivo obligatorio, actor, fecha, auditoría y exclusión mutua; nunca modifica moderación.
Conteo confiable de denunciantes distintos abiertos entre versiones, sin activar umbral.

T4 completada: 86/86 pruebas focalizadas (55 unitarias, 31 HTTP/PostgreSQL), global
1559/1559 en 68 archivos con PostgreSQL/SMTP reales y sin omisiones; regresiones
T1/T2/T3 incluidas. HTTP compilado manual, typecheck, lint, build y diffcheck aprobados.
Migración nueva 20261117020000_feedback_reportes aplicada solo en bases desechables.
Creación y cierres no alteran Feedback ni sus agregados; sin frontend ni umbral.
Evidencia y fallos iniciales corregidos en ficha T4. Sin commits, push o despliegue.

Ajuste T4 autorizado posteriormente: detalle ADMIN con identidad segura del denunciante
`{id,displayName}`, asociada obligatoriamente a la sesión y conservada al cerrar.
Sin exposición al autor/comunidad, sanciones ni reputación. Desestimar no presume
mala fe. Se mantienen los contratos previos y el alcance; decisiones y evidencia
adicional en la sección de ajuste de la ficha T4. No autoriza T5/T6.
Focalizada del ajuste aprobada: 93/93 (55 unitarias y 38 integraciones PostgreSQL),
con siete casos adicionales de identidad, permisos, privacidad y trazabilidad.
Global final del ajuste: 1566/1566 en 68 archivos con PostgreSQL/SMTP reales,
sin omisiones y con regresiones T1/T2/T3. Tipos, lint, build, diffcheck y HTTP
compilado aprobados. Sin migraciones nuevas ni automatismos adicionales.
El usuario autorizó posteriormente registrar T4 y su ajuste de identidad en un
commit local del módulo reviews, sin push. Revisión del diff preparado y 117/117
unitarias de reportes/moderación/acciones aprobadas antes del cierre; integraciones
no repetidas durante el commit. La autorización no permite avanzar a T5/T6.

## T5 — Umbral preventivo y restitución administrativa (completada)

Autorizada tras confirmar T4 e identidad en `983c681`, árbol principal limpio y
operaciones Git sin pendientes. M1.3 de otro worktree queda estacionada por el usuario.
Decisiones, implementación y evidencia: [ficha T5](../finished/TASK-moderacion-T5-ocultamiento.md).

Archivos/módulos: servicio/repositorio reportes y transiciones, bandeja/query ADMIN, auditoría
y sincronización de valoraciones; pruebas integración concurrentes.
Depende de T4. Contar denunciantes únicos con ABIERTO del comentario (no sumar dos versiones
del mismo usuario). Al tercero activar solo ocultoReportes y generar evento/entrada de revisión
en la misma transacción, sin cambiar moderación ni crear otra cola física. El actor del evento
es el usuario cuyo reporte disparó la regla; registrar origen automático, no una persona ficticia.
Resolver/desestimar con motivo se implementa en T4 por pedido explícito; cerrados no cuentan
ni se reabren. T5 reutilizará esos cierres. Restitución preventiva
explícita ADMIN exige menos de tres denunciantes abiertos y deja intactas otras causas. No quitar
automáticamente la causa por cerrar un reporte. Nuevos reportes válidos pueden disparar otro ciclo.
La bandeja deriva revisión pendiente de ocultoReportes y reportes abiertos, sin nuevo estado
de publicación. Aceptación/pruebas: 2/3, duplicados, varios usuarios/versiones, carrera con
restitución, preservación de causas, nuevos ciclos, auditoría y agregados atómicos.

Implementada sin otra cola ni frontend: reporte/conteo/transición/sync atómicos,
origen automático y actor real, acciones históricas aditivas, RESTITUCION_REPORTES
en endpoint ADMIN T3 con motivo/versión y menos de tres ABIERTO distintos, filtro
ocultoReportes y ultimoReporteAt en consultas T4. Cierres nunca restituyen solos.
Las causas independientes y la política pública T2 preservan privacidad y valoraciones.

56 pruebas T5 nuevas; focalizada final 149/149 con PostgreSQL real y regresión T4.
Global final 1622/1622 en 70 archivos con PostgreSQL/SMTP reales, sin omisiones,
309.59 s, exit 0. Typecheck, lint, build, diffcheck y HTTP compilado aprobados.
Primera focalizada 130/132 por dos expectativas T4 previas al umbral, corregidas
con evidencia conservada; no se omiten fallos intermedios de tipos/fixtures.
Migración 20261117030000_feedback_ocultamiento_reportes solo aplicada en bases
desechables; sin cambios M1.3, modelos, frontend, T6, despliegue, commits o push.

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
T2 implementada: política central de visibilidad, protección de relaciones/agregados y sincronización
de un voto por autor/materia desde último contenido visible. Migración adicional de reconciliación;
T1 intacta. 107 pruebas nuevas; global final 1412/1412 en 64 archivos, PostgreSQL real y sin omisiones.
Primera global 1410/1412 y correcciones explícitas registradas en la ficha, sin cambiar timeouts.
Tipos, lint y build aprobados. T2 se cierra en cuatro commits locales por autorización expresa.
T3 completada: seis endpoints privados/protegidos, acciones autor/ADMIN, revisión explícita,
corrección histórica de rechazados y control de versión. 123 pruebas focalizadas y global
1473/1473 en 66 archivos con PostgreSQL/SMTP reales, sin omisiones. Comprobación HTTP sobre
backend compilado, tipos, lint, build y diffcheck aprobados; evidencia original en ficha T3.
Sin cambios frontend/reportes. El commit local de cierre T3 fue autorizado posteriormente,
sin push. T4 autorizada posteriormente; T5/T6 requieren autorización posterior.
T4 completada y validada: 86 focalizadas y global 1559/1559, evidencia en ficha T4.
Reportes con referencia histórica, cuota PostgreSQL, consulta y cierres ADMIN auditados,
privacidad y conteos distintos preparados; sin activar ocultamiento ni modificar estadísticas.
No se desplegó a datos del usuario.

T5 completada y validada: 56 pruebas nuevas, focalizada final 149/149, global
1622/1622 en 70 archivos sin omisiones; tipos, lint, build, diffcheck y manual HTTP
aprobados. La ficha T5 conserva decisiones, contratos, archivos y fallos intermedios.
T6 queda preparada para consumir contratos, pero no implementada ni autorizada.
M1.3 queda estacionada para el final por decisión expresa del usuario.
