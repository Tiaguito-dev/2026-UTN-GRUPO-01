# TASK-068 — Separación del recorrido administrativo

## Alcance y autorización
Separar inicio, menú y destinos por rol, reutilizando panel, formularios, consultas y permisos existentes. El pedido autoriza modificar shell, header y resolución de destino de autenticación. No se agregan operaciones, estadísticas, dependencias ni permisos backend. No hacer commit ni pruebas visuales de navegador; servicios apagados.

## Decisiones
- Centralizar destinos por rol y traducción de rutas en `front/src/lib/navigation.ts`. Resolver tras confirmar sesión y antes de montar contenido estudiantil, preservando identificadores y contexto interno seguro.
- ADMIN dispone de inicio, Materias, Profesores, Usuarios y Experiencias. Cursadas y comisiones siguen accesibles desde el panel y los listados académicos.
- Agregar rutas administrativas de detalle sobre consultas existentes. Los comentarios se consultan con el contrato público y su anonimato; no habilitar acceso al detalle privado ajeno ni inventar moderación.
- Mantener cuenta/perfil y logout. El rol USER conserva el recorrido y el guard administrativo existente. Backend sigue autorizando cada operación.
- Breadcrumb administrativo compartido comienza en Administración. Orígenes internos validados conservan filtros y página.

## Criterios de aceptación
Login, recarga y acceso directo ADMIN resuelven destinos administrativos sin bucles; enlaces de listados y contexto de comentarios quedan en administración. Menú responsive reutilizado sin participación estudiantil. USER sin acceso a administración. Estados de carga/error y enlaces nativos conservados.

## Validación
Tests enfocados RED/GREEN de navegación por rol, rutas directas, permisos y enlaces; typecheck, lint y suite frontend. Sin navegador ni cambios a base local. Documentar resultados y limitaciones al cierre; preservar ajustes pendientes anteriores.

## Implementación
- Menú específico por rol y marca enlazada al inicio correspondiente. Login utiliza el rol devuelto por servidor, sin depender del estado anterior de React; RequireGuest y recarga usan el mismo destino.
- RoleRouteBoundary evita montar participación estudiantil para ADMIN y traduce rutas preservando IDs. Los orígenes de Experiencias se traducen a la consulta administrativa. Cuenta y contraseña permanecen disponibles.
- Listados académicos enlazan a nuevos detalles administrativos. Reutilización de historial de materia, servicios académicos, editores y gestión de equipo. Breadcrumb compartido se mantiene con Administración como primer enlace real al panel.
- Experiencias administrativa conserva búsqueda, filtros, página, lectura pública y anonimato; suprime publicación, comentario propio y acciones privadas. El backend sigue restringiendo operaciones ADMIN y detalle/historial del comentario a su autor.
- Ampliación acotada del retorno seguro del editor para aceptar Experiencias administrativa con carrera, materia y página validadas. Sin APIs nuevas ni cambios de autorización.

## Evidencia de validación
- RED inicial: tests de navegación fallaron por ausencia del módulo central antes de implementarlo. Pruebas de UI detectaron pérdida de filtros en el regreso a login y se corrigió.
- `npm run typecheck --workspace=front`: aprobado, incluye tests.
- `npm run lint --workspace=front`: aprobado.
- `npm run build --workspace=front`: aprobado; incluye las cinco rutas administrativas nuevas.
- `npm run test --workspace=front -- --maxWorkers=2`: 50 archivos, 490 pruebas aprobadas. La corrida sin límite tuvo un timeout al esperar el enlace de edición en una prueba existente; la corrida completa con menos procesos pasó sin cambiar ese comportamiento ni ampliar timeouts.
- `npm run test --workspace=back -- tests/auth.use-cases.spec.ts tests/auth-session.use-cases.spec.ts tests/feedback-input.spec.ts`: 70 pruebas aprobadas.
- `git diff --check`: aprobado. Sin commit, push, dependencias, contenedores efímeros ni modificación a base local. Ajustes previos sin commit conservados.

## Aceptación pendiente
Revisión manual en escritorio/móvil y contra servicios reales: login ADMIN/USER, recarga, rutas directas, navegación por teclado, perfil/logout y regreso desde detalles a filtros. No se realizaron pruebas visuales de navegador ni se iniciaron servicios, según indicación del usuario. Las pruebas automatizadas ejercitan componentes con servicios simulados; no reemplazan la aceptación visual ni una prueba HTTP con base real.

## Separación del commit
Se prepara exclusivamente TASK-068, conservando sin commit los ajustes anteriores de TASK-064 y documentación de TASK-067. Los fragmentos compartidos se separan en el índice sin cambiar los archivos de trabajo. El snapshot aislado pasa typecheck y se comprueban las pruebas del recorrido administrativo y formularios afectados.

La comprobación aislada del archivo completo `materias-filtros.spec.tsx` detecta una expectativa previa del catálogo sobre el texto «se cuenta una sola vez». Tanto ese bloque de prueba como `MateriasList.tsx` son idénticos a HEAD en el snapshot preparado: no forman parte de TASK-068. El árbol de trabajo completo, que conserva los ajustes pendientes del catálogo, pasó las 490 pruebas documentadas arriba. Se conserva esa separación y no se incluye una corrección ajena para ocultar el fallo anterior.
