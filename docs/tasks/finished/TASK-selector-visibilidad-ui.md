# Selector de comentarios y visibilidad de Mis experiencias

## Alcance y aceptación

- Mantener Materia → Cursada → Comisión, búsqueda, selección, validación, paginación y destino existentes.
- Pie del selector con Cancelar selección a izquierda y Anterior/Siguiente a derecha; contenido desplazable y controles visibles, sin desbordar a 360, 600 px o escritorio.
- Estados y causas simultáneas integrados en tarjetas propias, con acciones voluntarias directas y confirmación.
- Reutilizar servicios protegidos de ocultar/restaurar, versión privada, Dialog, Notice y refreshKey del listado. Errores seguros 401/403/404/409 y bloqueo de envíos repetidos.

## Exclusiones y restricciones

Sin backend, endpoints, moderación, reportes, M1.3, panel administrativo, rediseño del detalle, dependencias, commits, push ni despliegues. No cambiar primitivas, hooks compartidos, auth ni estilos base.

El usuario aprobó posteriormente esta etapa y autorizó registrar el commit de los cambios. Se conserva la rama de trabajo existente; no se autorizaron push ni despliegues remotos.

## Decisiones previas

- Git inicialmente limpio; no se encontró el HTML demostrativo en archivos del repositorio.
- Ajustar el diálogo mediante selector CSS local :has del selector; evita cambiar Dialog global y permite un pie de una fila en escritorio.
- Usar variante propia de FeedbackModerationStatus para no cambiar presentación del detalle ni comunidad. Conservar todas las causas; restaurar solo modifica ocultoAutor.
- Centralizar acciones en MisExperiencias y reutilizar los clientes HTTP existentes usados por el detalle. Refrescar la página de datos mediante refreshKey tras éxito o conflicto, sin recarga del documento.
- Perfil test delegado para pruebas de caracterización e interacción; implementación bajo perfil front.
- Excepción ESLint acotada `jsx-a11y/no-noninteractive-tabindex`: región desplazable con nombre accesible y foco para permitir scroll por teclado sin cambiar la opción de radio seleccionada. Sin desactivar reglas globales.

## Validación prevista

Pruebas de componentes, typecheck, lint, build frontend y git diff --check. Navegador a 360/600/escritorio si el entorno lo permite; registrar uso de mocks y no declararlo E2E real.

## Evidencia

- Suite frontend completa: 99 archivos, 1205 pruebas aprobadas. Incluye 85 casos focalizados entre selector, moderación y nuevas acciones propias.
- Typecheck frontend aprobado; lint frontend aprobado; build frontend aprobado; git diff --check aprobado.
- Pruebas de componentes con servicios simulados: no constituyen E2E ni verifican persistencia real.
- Revisión React: estado local, protección contra doble envío mediante ref, componentes existentes y estilos propios acotados, sin hooks/dependencias/primitivas nuevas.
- Chrome real headless con componentes y CSS reales, servicios simulados, a 360/600/1280 px: sin desbordamientos horizontales ni errores JavaScript. Resultados desplazables sin mover el pie; tres botones en una fila en escritorio; navegación, Anterior, cancelación y restauración del foco aprobados. Restauración versionada conserva reportes activos y no muestra visibilidad pública falsa.
- Capturas y harness temporales ignorados en `.tmp/ui-browser/`. No se verificó persistencia contra backend; no se declara E2E satisfactorio.
- Revisión final tras ajustar el pie móvil a grid: Cancelar selección conserva ancho natural (141 px), Anterior/Siguiente alineados a derecha. Chrome a 360/600/1280 px conserva scroll, foco y acciones; axe sin violaciones en modal abierto y tarjetas propias en los tres anchos. Servidores temporales detenidos.
- Pendientes funcionales: ninguno identificado dentro del alcance. Prueba con sesión y backend reales pendiente de entorno integrado.
- A pedido del usuario se reconstruyó la imagen frontend y se reinició el stack de desarrollo conservando volúmenes. Frontend recreado con los cambios actuales y proxy reiniciado para renovar su conexión. `/login`, `/health`, `/health/ready` y `/proxy-health` respondieron HTTP 200 en `http://localhost:8080`. Esto verifica disponibilidad del stack; no acredita un recorrido autenticado de ocultamiento/restauración.
