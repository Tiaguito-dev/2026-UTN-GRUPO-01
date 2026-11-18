# Selección de comisión al publicar desde Inicio

## Alcance y aceptación

Investigar el bloqueo reportado al elegir comisión en el modal Agregar comentario.
Conservar selección explícita, paginación de nueve y validación de disponibilidad
antes de abrir el formulario existente. Mostrar equipo docente y cargo en la tarjeta
de comisión usando los datos del listado existente, y un vacío cuando no haya docentes.
La tarjeta completa permite seleccionar con mouse y teclado y conserva foco visible.
Dejar el stack local actualizado y levantado para la validación manual del usuario.

## Restricciones y decisiones

Sin dependencias nuevas ni cambios de permisos, endpoints, publicación o modelo de datos.
Sin navegador, commits, push ni despliegue externo. No descargar todo el catálogo ni
hacer una solicitud por docente. Los nombres y cargos ya pertenecen al contrato Comision.

## Validación

Pruebas del selector con datos del contrato, selección por tarjeta y teclado,
docentes, vacío, estado de carga, errores, disponibilidad y navegación al formulario.
Typecheck, lint, suite frontend y build. Estado de servicios locales al cerrar.

## Evidencia

- Pruebas nuevas de docentes y vacío fallaron antes del cambio y pasaron después.
- Nombres/cargos provienen del listado de comisiones existente, sin solicitudes extra.
- Radios con tamaño y padding locales; conservan selección nativa y descripción del
  equipo docente. El clic sobre el texto del equipo selecciona la misma tarjeta.
- El spec completo de Inicio pasó 25/25, incluyendo selección dentro del diálogo real
  del feed, navegación al formulario y selección con teclado. No se reprodujo el bloqueo
  exacto informado con las pruebas automatizadas; queda corroboración manual del usuario.
- Typecheck, lint, build local y build Docker frontend aprobados. Stack dev actualizado
  mediante Compose con backend, frontend, proxy, Postgres y Mailpit saludables.
- Sin navegador ni pruebas manuales por decisión del usuario.
