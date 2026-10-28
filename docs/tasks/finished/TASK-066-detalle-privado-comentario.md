# TASK-066 — Administración del comentario propio

## Alcance
Rediseñar el detalle privado con título Tu comentario, breadcrumb compartido contextual,
una tarjeta de contenido/metadatos y acciones integradas; historial desplegable cerrado.
Conservar edición, cancelación, eliminación confirmada y regreso con filtros. Sin commits.

## Decisiones
- Reutilizar FeedbackCard para la presentación privada: materia enlazada, contexto real,
  destinatario, texto completo, fechas e identidad pública. Acciones provistas por el detalle.
- Quitar solo la tarjeta visible Auditoría; no modificar datos, permisos, registros ni API.
- Historial con details/summary nativos y carga al abrir, paginación existente de tres
  versiones, fechas y texto reales. Cerrado no repite ni consulta versiones. Conservar
  la página mientras permanece abierto; al cerrar y abrir se reinicia a la primera.
- Editar sigue condicionado por comisión activa; eliminar mantiene Dialog, protección de
  duplicados, mensajes y rutas existentes. El servidor sigue autorizando todas las consultas.
- Usar tokens vigentes (primary/text/background/border), que difieren de algunos hex del
  pedido. Sin modificar estilos base ni UI global, dependencias, endpoints o modelos.

## Exclusiones y restricciones
Sin cambios públicos de identidad, moderación o reglas de negocio. No iniciar servicios,
pruebas de navegador, scripts nuevos ni modificación de datos locales. Si se usa PostgreSQL
para regresión backend, será efímero y se eliminará al terminar cada prueba.

## Aceptación y validación
Pruebas enfocadas RED/GREEN para tarjeta única, texto/fechas/identidad, historial cerrado y
apertura real, paginación, comentario con/sin edición, error/vacío, permisos, eliminación y
cancelación, navegación de edición y regreso filtrado. Typecheck, lint y build frontend;
regresión de permisos backend. Revisión de CSS móvil/teclado sin navegador; aceptación
visual posterior a cargo del usuario. Registrar evidencia y CHANGELOG al finalizar.

## Resultado y evidencia
- Implementado en feature/comentarios. FeedbackDetail, FeedbackCard, FeedbackForm, estilos
  locales y helper de navegación ajustados; sin cambios de backend o componentes UI globales.
- RED: tres pruebas del nuevo detalle fallaron antes de implementar por título/tarjeta
  anteriores y consulta inicial del historial. GREEN: 52 pruebas frontend en
  feedback-components, feedback-service, experiencias-list y ui-breadcrumb.
- Se verificaron identidad pública con nombre/Anónimo, tarjeta única sin Auditoría,
  fechas sin falsa edición, texto largo multilínea, historial cerrado sin consulta,
  apertura con versiones reales, paginación de tres, cierre/reapertura, vacío/error/reintento,
  comisión inactiva, cancelación de edición y de eliminación, foco, reintento al eliminar,
  enlaces contextualizados y regreso a Experiencias con sus filtros y página.
- Catorce pruebas HTTP/PostgreSQL existentes pasaron contra PostgreSQL 17 efímero, incluidas
  autorización exclusiva del autor para detalle/edición/eliminación/historial, rechazo a
  otros usuarios y ADMIN, anonimato, cambios e historial reales. Trece migraciones aplicadas
  solo en esa base temporal. Contenedor butchery-task066-test-db eliminado en finally.
- Typecheck y lint frontend completos correctos. Compilación Docker correcta con
  `docker compose -f docker-compose.dev.yml build frontend`. git diff --check correcto.
- Revisión responsive del CSS: tarjeta flexible, nombres/palabras adaptables, 26/24 px
  en materia, texto 19/16 px, acciones en otra línea en móvil y sin alturas artificiales.
  Teclado comprobado con jsdom (Tab, enlaces/acciones y foco tras cancelar Dialog).
  Desplegable details/summary nativo; aceptación real visual y de navegador pendiente.
- Documentación frontend y CHANGELOG actualizados. Servicios apagados, datos locales
  intactos, sin dependencias, scripts nuevos, migraciones ni commits.

## Aceptación del usuario (2026-10-28)
La vista Tu comentario fue verificada por el usuario. Se autoriza el commit local de este bloque; sin push.
