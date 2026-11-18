# Reportes administrativos y validación previa al merge

## Alcance

Retirar la bandeja y selector de Moderación de `/home/admin/experiencias`.
Mostrar directamente Reportes, conservando filtros, paginación de nueve,
detalle, retorno y decisiones administrativas asociadas a reportes.
Ejecutar los checks de CI de frontend y backend para preparar el merge.
Corregir regresiones de navegación detectadas en esa pasada: conservar filtros y
página en el enlace de origen de Experiencias, y actualizar expectativas antiguas
de breadcrumb y de la etiqueta autorizada Ocultar comentario.
Actualizar fixtures de integración de likes, respuestas y valoraciones que todavía
exigen aprobar un alta ya publicada. Sin cambios de código de aplicación backend.

## Exclusiones y restricciones

Sin cambios de aplicación backend, permisos, endpoints, transiciones, layout global,
autenticación ni otros módulos. Sin commits, push, merge ni despliegue.
La revisión manual y de navegador corresponde al usuario.

## Decisiones

La ruta existente y las URLs con `seccion=reportes` siguen siendo válidas.
El listado de moderación deja de renderizarse y de consultar su servicio;
los servicios y decisiones existentes se conservan para los detalles autorizados.

## Aceptación y validación

- Entrada directa y URLs antiguas abren Reportes sin consultar la bandeja de moderación.
- Sin selector Moderación ni filtro de estado de moderación.
- Los filtros de reportes, paginación y navegación al detalle siguen funcionando.
- Prueba de regresión previa al cambio; suites completas, typecheck, lint y build.
- Registrar resultados y limitaciones de entorno; sin navegador.

## Evidencia

- Prueba previa del panel: tres casos fallaron con la bandeja anterior. Tras el cambio,
  panel, navegación, validaciones, detalle y selector: 146/146 aprobadas.
- La suite frontend encontró pérdida de filtros en feedbackEntryBreadcrumb. Corregida
  la URL de Experiencias sin modificar la jerarquía de Mis experiencias. También se
  actualizaron expectativas antiguas de comisión fabricada y Ocultar experiencia.
- Suite frontend completa: 98 archivos, 1180/1180. Después se agregó la prueba del
  modal de Inicio; su spec completo pasó 25/25.
- Typecheck y lint de ambos workspaces, builds de ambos y build Docker frontend: exit 0.
- Migraciones: 28 aplicadas a base nueva exclusiva; migrate diff de CI sin diferencias.
- La primera base aislada tenía datos previos: invalidaba los supuestos de vacío del
  feed y del listado. Se repitió en una base nueva, sin borrar datos existentes.
- Actualizados fixtures e historial esperado de likes/respuestas y valoración conforme
  a publicación directa, sin cambiar código de aplicación backend.
- Backend en base vacía: 71 archivos, 1638 aprobadas y tres expectativas de historial
  antiguas fallidas. Corregidas de dos eventos a uno (la creación); reejecución de los
  tres specs modificados: 52/52 aprobadas. No se repitió la suite general después de
  esa corrección exclusivamente de pruebas. No quedaron integraciones omitidas.
- Advertencia no bloqueante de pg por consultas concurrentes sobre un mismo Client
  durante pruebas de concurrencia. Los escenarios correspondientes pasaron en la
  base vacía sin los timeouts de la primera pasada bajo carga.
- Stack dev actualizado y saludable. GET /health responde ok y /login devuelve HTTP 200.
- La revisión de navegador y aceptación final pertenecen al usuario. Sin commits ni push.
