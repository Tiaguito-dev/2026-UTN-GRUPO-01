# TASK-060: Catálogo de materias y menú

## Alcance y autorización

Rediseñar el listado de Materias con filtros compactos e independientes, grupos por año y enlaces nativos. Ajustar mínimamente el listado backend para filtrar antes de paginar, sobre una misma asociación y con búsqueda sin tildes. Reemplazar símbolos del menú compartido por iconos coherentes; autorización explícita del usuario para ese componente compartido y sus estilos locales. Mantener rutas, permisos, alta administrativa y tamaño de página de nueve materias.

## Decisiones previas a la implementación

- Paginar materias únicas en el servidor, con orden alfabético estable por nombre e id. Proyectar las asociaciones relevantes de cada página en todos los grupos correspondientes: una materia puede aparecer en varios grupos, pero cuenta una vez en total y rango. Explicar esta semántica discretamente en el listado. No ordenar por el menor año ni descargar el catálogo completo.
- Carrera y año se aplican juntos sobre la misma asociación; año funciona sin carrera. Conservar el contrato de respuesta y asociaciones completas para detalle. Mostrar en cada grupo las asociaciones relevantes de ese grupo.
- Conservar búsqueda por envío explícito del formulario, sin peticiones por pulsación.
- Backend: normalizar ambos lados a NFD y eliminar marcas combinantes U+0300–036F con funciones PostgreSQL `normalize`/`translate`, sin extensión ni migración. Usar `EXISTS` para que carrera/año/nivel coincidan en una asociación; obtener IDs paginados y total, e hidratar únicamente esa página con asociaciones completas en transacción RepeatableRead. Orden por nombre normalizado, nombre e id. Conservar máximo de página existente para consumidores administrativos. El nivel exige Electivas pero no carrera.
- No había biblioteca de iconos instalada. Tras el pedido adicional explícito del usuario, incorporar `lucide-react` como dependencia frontend y usar House, Users, BookOpen, MessageSquare, UsersRound y LayoutGrid en navegación; Search/ChevronRight en el catálogo. Importaciones nominales, 18 px y trazo uniforme, sin cambiar otros módulos.
- No se adjuntó un HTML accesible en la conversación: implementar la composición descrita y la continuidad con TASK-059.
- `MateriasResults` compone los existentes `usePaginatedFetch`, `Notice` y `Pagination` directamente, sin modificar primitivas: permite informar el total real también cuando una página se agota, sin confundirla con catálogo vacío.
- El usuario pidió además actualizar Node local: instalar mediante el gestor Windows la versión 22.22.3 ya fijada en `.nvmrc`, engines y Docker; no cambiar el contrato de runtime del repositorio.

## Exclusiones y restricciones

Sin cambios en autenticación, router, layout global, hooks compartidos o primitivas globales; sin endpoints nuevos ni cambios en datos locales. Sin commits, dependencias adicionales a `lucide-react`, scripts auxiliares persistentes ni pruebas de navegador por indicación previa del usuario. El frontend se reconstruye al finalizar. Los contenedores de pruebas se eliminan al concluir cada prueba.

## Criterios de aceptación

- Tres filtros visibles y combinables, etiquetas, búsqueda con icono y limpieza; distribución responsive.
- Resumen con total único y filtros, grupos por año incluidos Electivas/nivel, filas blancas enlazables con metadatos relevantes y chevron.
- Paginación de nueve materias únicas, estable, filtros previos y reinicio al cambiar; estados vacío, carga y error.
- Menú conserva rutas, permisos y aria-current, con iconos decorativos ocultos y estado activo azul.
- Pruebas enfocadas en asociación conjunta, búsqueda, electivas, totales, paginación y navegación nativa.

## Validación prevista

Registrar RED antes de implementar y GREEN después; suites focalizadas backend/frontend, typecheck y lint de ambos workspaces, build Docker y comprobación HTTP sin navegador. Revisión de CSS responsive y semántica accesible; validación visual manual a cargo del usuario. Actualizar OVERVIEW por módulo y CHANGELOG.

## Implementación y evidencia

- Frontend: MateriasList y su CSS, service/URLs con año independiente, SidebarNav y
  NavigationIcon con Lucide. Respeta el alta administrativa existente. Encabezados
  Primer a Quinto año y Electivas, orden alfabético local en cada grupo, metadatos
  de cada asociación y resumen/rango de materias únicas. Estados vacío, carga, error
  y página agotada con acción apropiada.
- Backend: validador permite año sin carrera; repositorio filtra y pagina materias
  únicas con asociaciones conjuntas, búsqueda normalizada y transacción consistente.
  Sin cambios de esquema ni nuevos endpoints.
- RED: menú siete fallos por símbolos antiguos y ausencia de SVG; backend cuatro
  fallos de integración por año independiente, tildes y orden. Se registraron fallos
  de contrato y presentación antes de su implementación.
- GREEN: backend 59 pruebas (20 integración PostgreSQL + 39 filtros); frontend 58
  (15 materias-filtros, 14 academic-service, 15 listados, 14 navegación). Typecheck y
  lint aprobados en ambos workspaces. Bases efímeras eliminadas al finalizar cada
  ronda; sin alterar los datos locales del usuario.
- Revisión responsive del CSS (desktop una fila, móvil dos columnas y búsqueda
  completa), foco visible sin recorte, etiquetas visibles, enlaces nativos e iconos
  decorativos ocultos. Sin navegador ni capturas por preferencia explícita del usuario.
  Validación visual manual pendiente.
- Node local actualizado mediante Winget y MSI oficial: `node --version` confirma
  v22.22.3; npm incluido 10.9.8. Sin cambios en `.nvmrc` ni engines (ya fijados).
  Las 58 pruebas frontend se repitieron con la nueva versión y aprobaron.
- Docker: builds backend/frontend aprobados con Node 22.22.3 y servicios reconstruidos
  saludables; proxy reiniciado tras la recreación para renovar upstreams. Sin commits.
- Comprobación HTTP: Materias (con y sin año), Profesores y Experiencias devuelven
  HTTP 200 y el título fijo Profesor Butchery. No equivale a revisión visual de navegador.
- Implementación finalizada; revisión visual manual pendiente a cargo del usuario.
