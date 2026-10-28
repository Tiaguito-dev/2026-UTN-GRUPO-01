# TASK-061: Acceso directo a comisiones y experiencias

## Alcance y autorización

Aplicar la organización propuesta y aceptada con «aplicalo»: Materias como catálogo y acceso
directo a comisiones; cursada como filtro de período; Experiencias como lectura transversal de
los mismos comentarios; equipo docente debajo de las experiencias en detalle de comisión.

## Decisiones antes de implementar

- Conservar el modelo: cada comisión pertenece a una cursada específica. Cambiar el recorrido
  visible a Materia > Comisión > Experiencias, sin invertir claves ni mezclar comentarios de
  períodos distintos. Mantener URLs existentes como enlaces compatibles, sin cambiar router,
  layout global, autenticación, hooks compartidos ni primitivas UI.
- Detalle de materia muestra comisiones del período seleccionado, inicialmente el más reciente
  (año descendente, segundo antes de primero). Cursada se elige en un selector, sin página
  intermedia obligatoria. Reutilizar endpoints paginados existentes; cargar períodos para las
  opciones, pero paginar comisiones de nueve. No descargar todas las comisiones de todos los
  años ni filtrar solo la página actual. Carrera de catálogo sigue siendo contexto de retorno;
  no introducir un filtro parcial incorrecto por carrera en comisiones.
- Guardar período elegido y página de comisiones en URL para restaurar al volver del detalle;
  conservar contexto del catálogo (carrera, año de carrera, búsqueda, listadoPage y nivel).
  El detalle de comisión vuelve a la materia con ese período; breadcrumbs sin paso obligatorio
  por cursada. Mantener gestión administrativa de cursadas y alta de comisiones disponibles.
- Experiencias generales: agregar GET /feedback autenticado, nueve comentarios no eliminados
  por página, orden createdAt/id descendente. Reutilizar presentación pública y snapshot del
  repositorio: anonimato, propio, destinatario y contexto académico; nunca historial ni autorId
  ni email. Detalle privado sigue restringido al autor. Sin nuevas reglas de publicación.
- Reutilizar o extraer la tarjeta de experiencias existente para dar el mismo aspecto al listado
  general. Cada comentario identifica materia, comisión y período y permite ir a esa comisión;
  únicamente el propio muestra Administrar mi comentario hacia el detalle privado. No habilitar
  acciones sobre comentarios ajenos. Usar Lucide para iconos nuevos, sin dependencias nuevas.
- Equipo docente después de experiencias tanto en DOM como en pantalla, con una sola columna.
- Ajustar proxy para GET /feedback si requiere ruta exacta, manteniendo las rutas existentes.

## Exclusiones y restricciones

Sin valoraciones, votos, moderación, filtros globales nuevos, búsqueda de docentes ni nuevas
migraciones. Sin commits, scripts auxiliares persistentes ni pruebas de navegador; validación
visual manual a cargo del usuario. No tocar datos locales. Eliminar contenedores de pruebas
al finalizar cada ronda y reconstruir servicios modificados para poder consumirlos.

## Aceptación y validación

- Desde materia se ven las comisiones del período más reciente y se entra directamente a
  comentarios. Se puede cambiar período y paginar; al volver se restaura selección y contexto.
- Admin conserva nueva cursada y nueva comisión; usuarios comunes no obtienen esas acciones.
- Carga/error/reintento/sin cursadas/sin comisiones y respuestas tardías al cambiar período.
- Equipo docente debajo de experiencias; gestión administrativa preservada.
- Experiencias general consume comentarios reales, total y paginación coherentes; anonimato,
  datos históricos, ausencia de eliminados y protección de detalle privado verificadas.
- RED antes de implementar; GREEN con tests focalizados frontend y backend (PostgreSQL aislado),
  typecheck y lint, builds Docker y comprobaciones HTTP. Actualizar OVERVIEW y CHANGELOG.

## Implementación y evidencia

- `ComisionesMateria` integra el selector de cursada en `MateriaDetail`, pagina comisiones
  en el servidor y preserva retorno y contexto. Las herramientas administrativas de períodos
  se montan al abrir su desplegable, evitando consultas ocultas; el alta refresca las opciones.
- `ComisionDetail` usa una columna y orden Experiencias > Equipo docente. Vuelve a la materia
  con período real y página de origen; las rutas antiguas siguen disponibles.
- `ExperienciasList` consume GET /feedback; `ExperienceCard` se comparte con la comisión,
  mostrando el snapshot contextual en la vista general. No publica datos ni comentarios extra.
- Backend reutiliza la transacción paginada y la proyección pública: no-store, autenticación,
  exclusión de eliminados, identidad anónima oculta, propio calculado para la sesión y detalle
  privado únicamente del autor. Proxy adapta la ruta exacta sin cambiar autenticación.
- RED: 404 en GET /feedback antes de implementarlo; detalle aún lateral y service general
  inexistente; componente de comisiones directas faltante. Las fallas se confirmaron antes
  de sus cambios correspondientes.
- GREEN: 27 pruebas backend (12 integración con PostgreSQL + 15 validación/reglas) y 48
  frontend (comisiones directas, detalle de materia/comisión, listado general, comentarios y
  service). Incluye respuestas tardías al cambiar período, paginación, historial privado,
  anonimato, comisiones históricas y ausencia de eliminados. Bases efímeras eliminadas al
  terminar cada ronda; no se modificaron los datos de la base local.
- Typecheck y lint aprobados en ambos workspaces. CSS revisado para una columna, nombres
  largos, selector móvil y foco visible; pruebas DOM para enlaces y permisos. No se hicieron
  pruebas de navegador ni capturas por preferencia expresa del usuario. Revisión visual
  manual pendiente.
- Builds frontend/backend/proxy aprobados con Node 22.22.3; servicios reconstruidos y
  saludables. El job existente de migración finalizó correctamente, sin migraciones nuevas.
- HTTP local: Materias y Experiencias responden 200 con título fijo Profesor Butchery;
  GET /feedback sin sesión devuelve 401 y autenticado devuelve 200, página de nueve y el
  comentario local existente. Recorrido de lectura real de materia > períodos > comisiones
  devuelve 200 en cada API y en la página de materia con cursadaId. La sesión de prueba se
  cerró con 204. No se crearon ni editaron materias, comisiones o comentarios locales.
- Implementación finalizada; revisión visual manual pendiente del usuario. Sin commits ni
  dependencias nuevas.
