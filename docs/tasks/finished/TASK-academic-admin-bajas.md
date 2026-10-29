# Completar bajas administrativas académicas

## Alcance
Materias, profesores, comisiones y períodos (Cursada): acciones Trash2 en listados y detalles, confirmación identificable y explicativa, feedback de bloqueos, actualización de datos/contadores/paginación y trazabilidad de resultado. Reutilizar deletedAt, DELETE protegido por ADMIN y AdministracionHistorial. Sin commits. Preservar los cambios locales de tareas anteriores.

## Exclusiones
Usuarios, moderación de comentarios, borrado definitivo, borrado en cascada, reactivación académica y cambios de roles. No modificar layout, auth, router principal, hooks compartidos ni UI global.

## Decisiones previas a implementación
- Baja lógica existente: Materia bloqueada si tiene períodos vigentes; Cursada bloqueada con comisiones vigentes; Profesor bloqueado con asignaciones en comisiones vigentes; Comisión admite baja conservando asignaciones/comentarios/historial y cambia activa=false. No se borran relaciones por dar de baja.
- Las listas y selectores ofrecen registros vigentes; el detalle administrativo permite interpretar bajas e historial. Se mantienen snapshots públicos de experiencias.
- Reutilizar la auditoría existente: ELIMINACION representa baja exitosa y debe registrar resultado explícito; BAJA_BLOQUEADA registra intentos bloqueados por dependencias con motivo, actor, fecha y entidad/ID. El bloqueo debe persistir aunque se devuelva409; no debe falsear fecha/actor de modificación del registro ni marcarlo como eliminado. Falta de permisos/ID inválido no inventa eventos sobre una entidad.
- Las confirmaciones explican baja lógica y restricción de dependencias, con etiqueta e identificador. Quitar asignación docente sigue siendo desvinculación y se distingue de baja del profesor.
- Tras baja desde detalle se conserva el detalle administrativo con estado y auditoría actualizados; el listado se recarga al volver. En listas académicas se ajusta automáticamente a última página válida usando total y pageSize de respuesta, conservando filtros. Evitar cambios en hooks/UI globales.
- No se agregan dependencias ni un segundo modelo de historial. Cualquier restricción de integridad relevante se traduce a error de dominio409 comprensible.

## Criterios de aceptación
Trash2 accesible sólo para ADMIN y registros vigentes; confirmación, cancelar, prevención doble envío y error visible. Sin cascada ni pérdida de referencias. Backend valida permisos, dependencias y relaciones concurrentes. Baja/historial actor/fecha/resultado, bloqueos409 auditados y distinguibles de ediciones reales. Listado9/historial3; última fila ajusta página y contadores. Nuevas operaciones rechazan registros dados de baja. Documentación front/back y CHANGELOG actualizados.

## Validaciones
Pruebas backend unitarias/integración PostgreSQL aislado: dependencias, sin dependencias, permisos, bloqueos y eventos, concurrencia, preservación de asignaciones/experiencias/snapshots. Pruebas frontend de listado/detalles/paginación/errores. Typecheck, lint, suites pertinentes y recorrido real del stack vía proxy. Reconstruir/reiniciar servicios locales afectados según autorización vigente y verificar salud. Limitar workers para evitar saturación.

## Ajuste de validación solicitado por el usuario
El usuario indicó expresamente que no se compruebe el flujo del navegador porque realizará esas pruebas personalmente. No se ejecuta la comprobación Chrome preparada; se retira el script temporal sin ejecutarlo. La validación de cierre se limita a pruebas backend, pruebas focales frontend sin navegador, tipos, lint, builds y salud de servicios. El recorrido manual de UI queda a cargo del usuario.

## Evidencia de validación
- Backend: 4archivos,52/52pruebas aprobadas (admin-limits.integration, academic-administration.use-cases, admin-detail y profesores-comision), con PostgreSQL de pruebas aislado utn_grupo_01_access_final. Cubren ADMIN/USER/anónimo, bloqueos409conmotivoauditado, éxito4tipos, ausenciaencatálogos, rechazo de nuevasoperaciones, referencias/snapshots/asignaciones conservados y concurrencia.
- Backend: typecheck y lint global aprobados. Frontend: typecheck aprobado,36/36pruebas focales aprobadas (29existentes+7nuevas). Tres assertions nuevas requerían esperar la recarga de auditoría; se corrigieron a findByRole. Lint global no encontró errores de producción;4keys faltantes de fixtures JSX se corrigieron y su archivo pasó lint focal.
- Docker: compilaciones backend y frontend aprobadas. Sin migraciones nuevas. git diff --check correcto (sólo advertencias habituales CRLF).
- Por instrucción posterior del usuario, NO se ejecutó navegador ni recorrido UI. Las pruebas manuales del flujo quedan a cargo del usuario.
- Documentación front/back y CHANGELOG actualizados. No se realizaron commits, staging ni push. Se preservaron los cambios locales previos y de otros trabajos presentes en el workspace.

## Mensaje de commit sugerido
feat(academic): completar bajas administrativas con auditoría
- Stack local actualizado con docker compose dev up -d --build backend frontend proxy y reinicio final de proxy para refrescar los upstreams. Backend/frontend saludables, migración sin cambios pendientes, PostgreSQL y volúmenes preservados. Comprobación técnica de disponibilidad (sin navegador): /health y /health/ready devuelven200 en http://localhost:8080.
