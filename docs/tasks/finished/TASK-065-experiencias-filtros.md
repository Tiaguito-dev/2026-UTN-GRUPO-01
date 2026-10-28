# TASK-065 — Experiencias: filtros y lectura

## Alcance
Refinar el listado general y su tarjeta compartida; filtros combinados de carrera de la
comisión y materia antes de paginar, nueve comentarios por página. Mantener anonimato,
autoría, orden reciente estable, permisos y navegación de regreso. Sin commits.

## Decisiones
- Extender GET /feedback con carrera y materiaId opcionales, validados. Carrera se consulta
  en Comision, nunca en las asociaciones de Materia. Total y página comparten where y snapshot.
- Exponer carrera real de la comisión en el contexto público, sin migración.
- Selector de materia con búsqueda remota paginada existente, sin descargar el catálogo;
  búsqueda con debounce, estados recuperables y navegación accesible. Al cambiar carrera se
  verifica la asociación completa de la materia elegida antes de conservarla o limpiarla.
- URL del listado: carrera, materiaId, page. Origen en detalles: origen=experiencias,
  experienciasCarrera, experienciasMateriaId, experienciasPage, para no confundir los
  filtros del feed con los de la navegación académica. Solo rutas internas construidas.
- Ajustes limitados al módulo feedback y regreso desde comisión; reutilizar tokens,
  biblioteca Lucide, breadcrumb, servicios y hooks existentes. Sin dependencias nuevas.

## Exclusiones y restricciones
Sin votos, estadísticas, cambios de publicación/moderación o nuevos permisos. No iniciar
servicios, pruebas de navegador ni aceptación visual. No tocar datos locales. Cualquier
contenedor de PostgreSQL para integración será efímero y eliminado al terminar.

## Aceptación y validación
Pruebas RED/GREEN enfocadas en carrera real con materias compartidas, combinación de
filtros, paginación/total/orden, compatibilidad de materia, URL de regreso, anonimato y
acciones privadas. Estados carga/error/vacío, teclado y estructura adaptable sin desbordes.
Ejecutar tests afectados, typecheck, lint y build. Documentar evidencia al cerrar;
aceptación visual de escritorio/móvil a cargo del usuario.

## Resultado y evidencia
- Implementado en feature/comentarios. Sin nuevas dependencias, scripts, migraciones ni commits.
- RED: una prueba de contrato backend y cuatro casos frontend fallaron por filtros ausentes
  antes de implementar. GREEN: 30 pruebas backend (16 de entrada y 14 HTTP/PostgreSQL) y
  69 frontend en seis archivos, incluyendo selector, tarjetas, contexto y flujo académico.
  El último caso de teclado se ajustó porque jsdom no activa summary con Enter: se abre
  con clic nativo y se verifican Tab, Escape y restitución del foco sin emular el navegador.
- Typecheck y lint completos de ambos workspaces: correctos. Build backend y frontend
  correcto con `docker compose -f docker-compose.dev.yml build backend frontend`.
  El compose de producción no se usó: requiere variables SMTP/TLS que no están configuradas
  en este entorno; no se modificó configuración para eludirlas.
- PostgreSQL 17 efímero con las trece migraciones existentes. Las pruebas verifican una
  misma materia con comisiones S/I, combinación con materia, páginas 9+1, total correcto,
  exclusión de eliminados, desempate estable y 400 ante filtros inválidos. Contenedor
  butchery-task065-test-db eliminado en finally al concluir. Base local sin cambios.
- En frontend se verifican cambio compatible/incompatible de carrera, búsqueda sin carrera,
  opciones remotas filtradas/paginadas y error/reintento; filtros/página en URL, regreso
  de comisión y edición, anonimato propio, permisos, vacío y contenido largo multilínea.
- Revisión de CSS responsive y estructura semántica: controles apilados en móvil, ancho
  flexible, nombres/palabras largas adaptables, texto 17 px (16 px móvil), interlineado 1.75,
  botones/enlaces nativos y foco visible. Aceptación visual real pendiente, sin navegador.

## Aceptación del usuario (2026-10-28)
Filtros de Experiencias verificados por el usuario. Se autoriza el commit local de este bloque; sin push.
