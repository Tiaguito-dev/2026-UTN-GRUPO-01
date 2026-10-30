# Detalle administrativo de profesores

## Alcance y aceptación

- Refinar únicamente la UI de `AdminProfesorDetail`, reutilizando `PageHeader`, breadcrumb, estilos de materias y `AdminSharedAudit` sin modificar componentes compartidos.
- Encabezado con nombre real, etiqueta, descripción y acciones existentes de edición y baja para ADMIN y registro activo.
- Ficha compacta semántica con iniciales derivadas del nombre, nombre completo, estado explícito y alternativa No registrado. Nombres largos sin truncar; disposición móvil apilada.
- Auditoría e historial compartidos con actores autorizados sin UUID, fechas locales, eventos reales y paginación de tres; no reconstruir eventos.
- Volver y breadcrumb conservan búsqueda y página del listado de profesores; origen inválido o ajeno usa `/home/admin/profesores`.
- Mantener confirmación, cancelación, restricciones de baja, permisos y relaciones actuales.

## Exclusiones y restricciones

Sin backend, campos nuevos, asignaciones, dependencias, cambios globales, nuevas operaciones, pruebas visuales, navegador ni commit. El desarrollador realiza la revisión visual.

## Decisiones previas

- Reutilizar el CSS Module de materias sin cambiarlo y agregar un módulo local solo para la ficha de profesores. No introducir tokens globales ni variantes de auditoría.
- Usar `AcademicDeleteDialog` existente desde acciones superiores, como materias y cursadas; mantener callbacks de actualización de auditoría tras intentos y éxito.
- Validar el origen con `safeAdminReturnTo` y restringir su pathname al listado de profesores en este detalle, sin cambiar navegación compartida.

## Validación

Perfil front para implementación y perfil test para regresiones de interacción sin navegador. Antes de implementar, ejecutar pruebas existentes pertinentes como caracterización; ampliar cobertura de nombres/iniciales, estados, datos ausentes, historial, permisos, navegación y confirmación/cancelación/restricción de baja. Ejecutar Vitest, lint y typecheck. Responsive se comprueba por revisión de CSS; no se afirma verificación visual ni manual en navegador.

## Resultado

- Implementado únicamente el detalle de profesores y un CSS Module local de ficha; reutiliza estilos de materias, componentes existentes de encabezado, diálogo de baja y auditoría/historial. No se modificaron componentes globales, backend ni relaciones.
- Caracterización previa: 19/19 pruebas aprobadas en `admin-academic-detail` y `admin-cursada-presentation`.
- Regresión final: 68/68 pruebas aprobadas en cinco archivos: `admin-profesor-presentation` (17 casos nuevos), `admin-academic-detail`, `admin-cursada-presentation`, `hu11-editar` y `navegacion`. Incluyen nombres largos, iniciales con tildes, nombre ausente, estados, permisos, breadcrumb, retorno de búsqueda/página y orígenes inválidos, cancelación por teclado y foco, baja bloqueada/exitosa, actores resueltos y ausentes sin UUID, historial cerrado/vacío/con eventos, orden y paginación.
- `npm run typecheck --workspace=front` y `npm run lint --workspace=front` aprobados. `git diff --check` sin errores.
- Revisión de CSS: ancho 1200px, título 32/28px, acciones debajo a 800px, ficha apilada a 600px, avatar 48px, padding 24/20px, separación entre tarjetas 20px; auditoría compartida en tres/dos/una columnas con separadores adaptados. Sin alturas fijas de tarjeta ni truncado.
- Documentados presentación y alcance en `front/OVERVIEW.md` y `CHANGELOG.md`. No corresponde modificar documentación backend porque no cambia su funcionalidad ni contrato.
- No se ejecutaron pruebas visuales ni navegador por pedido explícito. Aspecto, responsive real y activación nativa del desplegable por teclado quedan para revisión del desarrollador. Los tests de interacción usan jsdom y servicios simulados; no sustituyen una prueba completa contra backend.
- Sin commit. La última instrucción del usuario reserva su ejecución y solicita títulos y archivos aislados tras los checks completos documentados en TASK-system-audit-actors. Sin staging, push ni merge.
