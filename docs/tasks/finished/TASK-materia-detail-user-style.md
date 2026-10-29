# Detalle administrativo de Materias con auditoría compartida

## Alcance autorizado

Refinar únicamente el detalle administrativo de Materias según los criterios del pedido del 2026-10-29, reutilizando y completando la presentación de auditoría del detalle de usuarios. No hay HTML de referencia. Conservar operaciones, permisos, confirmaciones, navegación contextual y selección de Materias en el menú. Sin commit.

## Restricciones

- No modificar los cambios de TASK-057: gestión inmediata de docentes, comisiones, edición o pruebas integradas. Si surge una interferencia, señalarla y esperar instrucciones antes de ejecutar el ajuste dependiente.
- Profesores, Cursadas, Comisiones y comentarios conservan su presentación. La ampliación de la auditoría compartida debe conservar el comportamiento de usuarios y ser reutilizable por cualquier entidad; no crear una auditoría exclusiva para Materias.
- Sin cambios al layout, router, auth, hooks compartidos, estilos base o primitivas globales. El pedido autoriza completar la auditoría compartida del módulo administrativo.
- Sin dependencias nuevas, operaciones nuevas, migraciones, datos de maqueta ni consultas adicionales para intentar resolver actores en frontend. Nombre autorizado si existe; referencia sin nombre: Usuario no identificado; ausente: No registrado. Contrato backend actual intacto.
- No navegador, Playwright, capturas ni imágenes. Dejar stack Docker de desarrollo levantado para validación manual del desarrollador; conservar los datos existentes.

## Decisiones previas

- Inspeccionados AdminAcademicDetail, AdminRecordDetail, UserAudit, UserDetail.module.css, AdminAudit, AcademicDeleteAction, PageHeader, tipos, contratos y pruebas existentes.
- Adaptar solo AdminMateriaDetail mediante presentación local. Reutilizar PageHeader sin modificarlo para mantener foco, Volver y breadcrumb. Usar CSS Modules locales y paleta solicitada, sin alterar estilos globales.
- Modalidad proviene del enum real: ANUAL se presenta Anual sin Cuatrimestre; PRIMERO/SEGUNDO se presenta Cuatrimestral con el cuatrimestre correspondiente; null/ausente: No registrado. No inventar un campo independiente.
- Mantener todas las asociaciones carrera/año/nivel de electiva como filas independientes con denominaciones formales. Navegar al listado administrativo existente de cursadas.
- Generalizar UserAudit con contexto de entidad opcional (por defecto users). Aplicarlo a Materias mediante un contenedor local que use useAdminDetail o una opción explícita de presentación en AdminAudit; los consumidores existentes conservan su presentación.
- Interpretar solo códigos/formatos de historial conocidos, sin inferir operaciones desde valores nulos ni exponer UUID. Cadena vacía: Vacío; null: No registrado. Mantener orden y página de tres.

## Criterios de aceptación

- Máximo 1200px; encabezado con Detalle de materia, nombre real, descripción, acciones secundarias azul/rojo; responsive con acciones debajo. BookOpen e Información académica en tarjeta principal, columnas semánticas dl/dt/dd, estado explícito, carreras/años completos y pie con acceso real a cursadas.
- Auditoría compartida con ShieldCheck/Lock, tres columnas (dos intermedias/una móvil), icono Trash2 y etiquetas Baja para entidades académicas; usuarios conserva Desactivación. Fechas y hora locales legibles, actores seguros, aclaración única.
- Historial accesible cerrado, contador real, operaciones y valores traducidos, tabla Campo/Antes/Después, paginación existente y estados de carga/error/reintento.
- Edición y baja solo para ADMIN activo, conservando las confirmaciones y refresco de datos e historial. Sin alterar sidebar ni navbar.

## Validación y TDD

Perfil test: agregar primero pruebas de Materias y de la ampliación compartida de auditoría; ejecutar RED antes de implementación. Cubrir una/múltiples carreras y años, anual/cuatrimestral, electiva, ausencias, activos/inactivos, historial y paginación, teclado/foco accesibles en jsdom, navegación y regresiones de usuarios. CSS responsive inspeccionado por código; validación visual/teclado real corresponde al desarrollador.

Ejecutar suites pertinentes, typecheck y lint frontend y build. Ejecutar prueba backend administrativa pertinente por regla del proyecto aunque no se modifique backend. Levantar/reconstruir el frontend del stack dev y comprobar servicios/healthchecks por CLI, sin navegador ni imágenes. Documentar resultados, actualizar OVERVIEW por aplicación y CHANGELOG.

## Resultado

El desarrollador confirmó la validación de estos ajustes de UI antes de solicitar el refinamiento posterior del texto de confirmación de baja, documentado en TASK-academic-delete-copy.

- Implementación limitada a AdminMateriaDetail y su CSS Module local. AdminSharedAudit reutiliza el hook administrativo existente y UserAudit con contexto opcional de entidad; el valor por defecto conserva Desactivación de usuarios. Profesores, Cursadas y Comisiones siguen usando su presentación anterior.
- La baja de Materia usa AcademicDeleteDialog existente desde el botón local. No se modificaron AcademicDeleteAction, AdminAudit, DocentesComision, ComisionDetail, EditarAcademico, router, sidebar, navbar ni hooks compartidos. No se detectaron interferencias con los cambios integrados de la compañera.
- Modalidad, cuatrimestre condicional, estado y todas las asociaciones provienen del contrato actual. Historial interpreta carreras compactas, códigos, fechas, null y cadena vacía con etiquetas legibles. No se amplió el contrato backend ni se consultaron actores adicionales.
- RED antes de producción: 10 fallos y 10 aprobadas; un fallo correspondía al stub showModal ausente en jsdom y se corrigió en la prueba. Las otras nueve diferencias correspondían a presentación/comportamiento solicitado. Se añadieron después casos de años regulares distintos y reintento de auditoría.
- GREEN focal final: 48/48 pruebas en seis suites (admin-materia-presentation, user-audit, admin-academic-detail, user-access-state, academic-bajas, admin-audit). Son 14 casos nuevos de Materia y cinco de auditoría; los tres casos originales de UserAudit se conservaron.
- academic-bajas solo ajusta los rótulos Resultado/Motivo en el caso Materia bloqueada; conserva bloqueo, error, confirmación abierta y edición. No se modificaron pruebas integradas de docentes ni comisiones.
- Typecheck de código y pruebas, lint frontend con cero advertencias y build Docker frontend aprobados. Revisión React de hooks, estado, permisos, iconos decorativos y foco realizada. CSS responsive inspeccionado para 3/2/1 columnas y separadores; sin afirmar validación visual.
- Backend: tests/admin-detail.spec.ts, 9/9 aprobadas. Backend de aplicación sin cambios.
- Suite frontend completa: 68 archivos y 607/607 pruebas aprobadas, incluidas las regresiones de usuarios, navegación y gestión docente. No se deshabilitó ni eliminó ninguna prueba.
- Stack dev arrancado conservando volúmenes; paso migrate confirmó No pending migrations to apply. Imagen frontend reconstruida incluyendo el último ajuste CSS. PostgreSQL, Mailpit, backend, frontend y proxy healthy. GET /proxy-health, /health, /health/ready y /login devolvieron HTTP 200 en http://localhost:8080 mediante consola. Stack dejado levantado.
- Sin navegador, Playwright, capturas ni imágenes por indicación expresa. Revisión manual a cargo del desarrollador. Sin staging, commit ni push. Documento previo TASK-academic-detail-refinement.md conservado intacto.
- Ajuste de código y validación automática terminados. `git diff --check` aprobado; archivos integrados de la compañera comparados con HEAD sin diferencias.
- Mensaje sugerido: `feat(materias): refinar detalle administrativo y auditoría compartida`.
