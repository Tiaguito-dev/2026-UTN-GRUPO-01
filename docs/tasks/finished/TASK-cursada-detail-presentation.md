# Presentación del detalle administrativo de cursadas

## Alcance y restricciones

Refinar únicamente AdminCursadaDetail: encabezado, información semántica, acciones y acceso a comisiones. Reutilizar PageHeader, el CSS del detalle de materias, AdminSharedAudit y AcademicDeleteDialog. Mantener modelos, operaciones, permisos, navegación contextual y consultas. Sin cambios al shell, router, auth, hooks, estilos base ni componentes UI globales. Sin dependencias, commits ni pruebas visuales en navegador.

## Decisiones previas

- El título usa el período registrado con periodoLabel, independiente de la modalidad de materia. El nombre de materia es contexto y enlace administrativo.
- Reutilizar directamente los estilos existentes de materias evita otra variante visual local. La auditoría compartida ya presenta actores, fechas y cambios de período legibles.
- La confirmación conserva el diálogo de materias y sus restricciones, con la etiqueta cursada. No expone referencias técnicas.
- Conservar los constructores de URL actuales y su contexto de regreso. La selección de Materias ya está resuelta en SidebarNav.

## Criterios de aceptación

Encabezado responsive con período y materia reales, acciones solo ADMIN activo; tarjeta dl/dt/dd con período, estado y materia; pie con enlace directo a comisiones; auditoría compartida e historial inicialmente cerrado, sin UUID y paginado de tres. Conservar cancelación, confirmación, restricciones de baja y actualización de consultas.

## Validación

Pruebas jsdom de períodos, estados, ausencias, actores, historial, enlaces, permisos y bajas; suites de navegación/edición; typecheck, lint y pruebas backend pertinentes. Sin navegador: aspecto responsive y validación manual a cargo del usuario. Reconstruir frontend y reiniciar stack Docker existente al finalizar el código; verificar salud sin borrar volúmenes.

## Resultado

- Presentación implementada con los estilos existentes de materias; sin CSS nuevo ni modificación de componentes UI globales. Header y datos semánticos, footer de comisiones y auditoría compartida de usuarios. Etiqueta cursada en el diálogo existente. Datos ausentes usan No registrado, conservando el año disponible.
- Frontend: 122 pruebas aprobadas entre admin-cursada-presentation/admin-academic-detail (19), navegación/auditoría/bajas/materias/creación (44) y edición/contexto/menú (59). Incluyen períodos anuales/cuatrimestrales independientes de modalidad, ausencia null/undefined, nombres largos, actores sin nombre, historial traducido y paginado, permisos, confirmación y cancelación por teclado, restricciones y contexto de regreso.
- Backend sin cambios: 72 pruebas aprobadas de admin-detail, academic-administration.use-cases y academic-admin.use-cases.
- Typecheck y lint frontend completos aprobados. Build Docker final compilado y stack actualizado con healthchecks correctos después del ajuste de texto de ausencia.
- Inspección de CSS reutilizado: máximo 1200px, título 32/28px, datos apilados a 600px, acciones debajo a 800px, auditoría tres/dos/una columnas y tablas con overflow interno. No se ejecutaron pruebas visuales ni navegador. Aspecto, móvil y activación nativa del historial por teclado quedan para revisión manual del usuario.
- Sin commits. El documento preexistente no versionado TASK-academic-detail-refinement.md se conserva sin modificaciones.
