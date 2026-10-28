# TASK-069: Unificación de tablas administrativas

## Alcance

Unificar Materias, Profesores, Usuarios, Cursadas (períodos) y Comisiones administrativas. Barra compacta de filtros y alta, superficie de ancho completo, acciones Lucide accesibles, nueve filas por página y filtros persistidos en URL antes de paginar. Inspeccionar y reutilizar componentes existentes.

## Exclusiones y restricciones

Experiencias conserva sus tarjetas y filtros existentes de carrera/materia. No modificar layout, router, auth, hooks compartidos, estilos base ni primitivas globales. No crear operaciones ni endpoints. No hacer commit. Preservar los cambios previos del workspace.

## Decisiones previas a implementación

- Reutilizar PageHeader, Notice, Pagination, Dialog y useAllPages; la superficie y controles tabulares se comparten solo dentro de admin. Card panel tiene máximo 50rem y padding amplio: se reemplaza su uso en tablas por una superficie propia del módulo sin alterar Card global.
- Materias utiliza filtros y paginación del servidor. Profesores, Usuarios y catálogos dependientes no exponen búsqueda: reutilizar carga completa acotada de useAllPages (máximo 2000 registros, error ante catálogo incompleto), filtrar antes de dividir en páginas y reutilizar la carga al cambiar filtros/página. Una búsqueda backend para catálogos mayores requiere otra tarea.
- Usuarios solo expone id, nombre, email, rol y fecha. No se puede inferir estado ni activar/desactivar. No mostrar filtros de estado ni acciones ficticias. No hay eliminación disponible en los clientes académicos actuales.
- Comisiones conserva selección de materia y cursada (período) y agrega carrera. Materias agrega año y nivel de electiva. Retornos de detalle/edición deben preservar filtros con validación de parámetros permitidos.
- Tooltips visibles por hover y foco, descartables con Escape; iconos con nombres accesibles y controles de 40px.

## Criterios de aceptación

- Los cinco listados usan superficie y densidad coherentes sin truncar nombres largos; acciones reales alineadas a la derecha.
- Filtros antes de paginar, total filtrado, carga/error con reintento, vacío y recuperación de página fuera de rango.
- URL conserva contexto al paginar, abrir detalle/edición y volver; filtros reinician página.
- Móvil apila controles y contiene scroll horizontal en la tabla.
- Experiencias permanece intacta. Limitaciones reales se informan.

## Validación prevista

Tests de interacción de listados (filtro fuera de primera página, URL, acciones y estados), validadores de retorno, suite frontend, lint y typecheck; build y pruebas backend si el entorno lo permite. Inspección responsive en navegador si hay herramientas disponibles. Registrar evidencia real y limitaciones al cerrar.

## Resultado y evidencia

- Inspeccionados Card, PageHeader, Dialog, FormField, Pagination, PaginatedListView, useAllPages y useUrlPagination antes de modificar las pantallas. No se modificaron esas primitivas ni hooks.
- Se implementó AdminTable y controles compartidos dentro del módulo administrativo. Materias mantiene filtros remotos; Profesores, Usuarios y catálogos dependientes filtran el conjunto completo acotado. Estado de usuario y eliminación de entidades no están expuestos por los controllers y no tienen controles ficticios.
- TDD: las cinco pruebas iniciales de filtros, retornos y contratos fallaron antes de implementar. Luego pasaron, junto con un sexto test de carrera/período y reutilización de catálogo en Comisiones.
- Suite frontend: 51 archivos y 495 pruebas aprobadas con `npm run test --workspace=front -- --maxWorkers=2`. Después se agregó la prueba de Comisiones: las seis pruebas del archivo `admin-tables.spec.tsx` pasaron. Los tests de caracterización de listados se actualizaron por cambios intencionales en textos, tooltips y paginación de catálogos.
- Backend: 639 pruebas aprobadas, 187 omitidas por condiciones de entorno; no se modificó código backend de esta tarea ni se ejecutaron escrituras en base de datos.
- `typecheck`, `lint` y `build` frontend aprobados. La excepción ESLint en la región de tabla habilita scroll con teclado; está comentada localmente.
- Chrome con HTTP simulado: los diez escenarios de los cinco listados a 390/1280px completaron comprobaciones de tabla, enlaces reales a detalle/edición, navegación de regreso, controles, tooltips por foco/Escape y axe sin hallazgos serious/critical. El proceso Playwright quedó esperando al finalizar en Windows y se detuvo; no se presenta como ejecución end-to-end contra backend real.
- Instrucción posterior del usuario: no analizar más imágenes; la revisión visual queda exclusivamente a su cargo. Se detuvo la nueva ejecución y se retiró la generación de capturas del spec añadido. No se continúa con pruebas visuales.
- `front/OVERVIEW.md`, `back/OVERVIEW.md` y CHANGELOG documentan flujo, contratos y límites. Cambios previos del workspace conservados. Sin commit.

## Pendientes conocidos

- Aceptación visual manual a cargo del usuario.
- Búsqueda remota en catálogos distintos de Materias para superar 2000 registros sin carga completa inicial.
- Estado, activación/reactivación de usuarios y eliminación académica requieren contratos y operaciones backend nuevos, fuera del alcance de esta unificación.
