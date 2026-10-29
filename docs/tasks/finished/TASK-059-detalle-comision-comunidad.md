# TASK-059: Detalle de comisión centrado en experiencias

Estado: Finalizada. Fecha: 2026-10-27. Rama: feature/comentarios.

## Objetivo y alcance

Rediseñar solo el contenido del detalle de comisión: materia como título, carrera/año
discretos cuando se conozcan, comisión/período con calendario, navegación simple y selector
de comisiones del mismo período. Experiencias en columna amplia y equipo docente compacto
en lateral de aproximadamente 260 px, apilados en pantallas pequeñas.

Experiencias usa fondo de página y tarjetas blancas con identidad, fecha, destinatario y texto
completo. Cantidad real desde total del endpoint existente. Ayuda colapsable secundaria.
Una sola acción propia Administrar mi comentario con icono de edición, sin duplicarla en
encabezado. Sin acciones nuevas para comentarios ajenos. Publicar solo cuando corresponda.

## Contratos, permisos y decisiones

- No nuevos endpoints, dependencias, filtros, valoraciones ni modal de edición.
- Reutilizar PageHeader, Breadcrumb, Notice, Pagination, hooks existentes y CSS Modules.
  Modificar presentación de breadcrumbs solo mediante estilos locales de esta página.
  Ningún cambio a layout, sidebar, auth, hooks compartidos ni UI global.
- No hay biblioteca de iconos instalada: conservar patrón SVG actual y reutilizar iniciales.
  Los iconos decorativos usan aria-hidden y las acciones llevan texto.
- Carrera proviene de la comisión; año puede recuperarse mediante obtenerMateria existente,
  cruzando su clasificación con la carrera de la comisión. No deducirlo del número ni período.
- La consulta de otras comisiones conserva contexto de navegación y representa carga/error/
  resultado único sin confundir fallo con ausencia de alternativas.
- Se conservan las acciones ADMIN de asignación, cargo y desvinculación de docentes.
- GET /feedback/:id hoy permite lectura ajena. Para cumplir la exigencia explícita de detalle
  privado, restringirlo a su autor con 403, sin alterar el listado público autenticado ni su
  identidad/anonimato. No cambiar endpoints de escritura ni historial.
- Sin scripts/archivos temporales versionados, instalaciones ni pruebas visuales guardadas.
  Conservar la restricción previa de no ejecutar pruebas de navegador; verificar componentes,
  teclado en jsdom y reglas responsive mediante revisión CSS. La inspección visual manual
  final corresponde al desarrollador.
- Al terminar, reconstruir/recrear frontend para consumo. Actualizar backend si cambió permiso.

## Criterios y validación

Título materia, contexto real, breadcrumb simple y regreso funcional. Selector navega sin
perder contexto. Experiencias muestra total real; estados cargando/error/vacío, texto largo,
anonimato, comentario propio y ajeno. Un único botón propio Administrar mi comentario, ninguna
entrada al detalle ajeno. Ayuda desplegable operable por teclado, acciones accesibles.
Equipo docente en lista compacta, sin tarjetas por persona; preservar gestión administrativa.
CSS con tokens existentes: azul #1240C9, texto 16 px, radios 8 px, sin sombras innecesarias.

Actualizar tests existentes pertinentes antes de implementar; probar privacidad en backend,
interacciones y teclado en frontend; typecheck, lint y build. Contenedores efímeros de prueba
deben eliminarse al finalizar. Sin commit. Documentar front/back y CHANGELOG.

## Resultado

Implementación terminada; revisión visual/manual pendiente del desarrollador.

- Frontend: 29 tests aprobados en feedback-comision, feedback-components, comision-detalle
  y materia-detalle. Verifican total real, texto largo, anonimato, gestión propia única,
  desplegable, estados de consulta, selector/contexto y gestión docente ADMIN.
- Backend: 11 tests HTTP/PostgreSQL aprobados; detalle ajeno 403 incluso ADMIN y listado
  autenticado público conservado. El fallo esperado se comprobó antes de corregir el permiso.
- Typecheck y lint de ambos workspaces aprobados. Builds Docker backend y frontend aprobados
  con Node oficial 22.22.3. Ambos servicios recreados y saludables.
- Reinicio del proxy después de la recreación para resolver las nuevas direcciones internas.
  HTTP 200 y un único title Profesor Butchery en siete rutas, estáticas y dinámicas.
- Revisión de CSS responsive: columnas hasta 1000 px apiladas, minmax(0,1fr), controles que
  ajustan ancho y overflow-wrap para texto largo. Pruebas de foco/teclado en jsdom y markup
  nativo de summary; jsdom no simula su activación por Enter, por lo que no se afirma una
  prueba visual o de teclado de navegador. Se mantiene la restricción previa del usuario.
- Se eliminó el contenedor PostgreSQL de pruebas con su volumen al terminar la integración.
  No se instalaron dependencias ni generaron scripts o capturas. Sin commit.

Archivos funcionales: ComisionDetail.tsx y su CSS Module; ComisionFeedback.tsx y feedback.module.css;
layout.tsx para metadata fija; MateriaDetail.tsx y ComisionesList.tsx sin document.title;
prisma-feedback.repository.ts para propiedad del detalle. Se actualizaron pruebas y documentación.

## Ampliación explícita: título fijo de la pestaña

El desarrollador pidió que el título del navegador siempre sea Profesor Butchery. Se autoriza
el ajuste acotado de metadata en el layout raíz, sin cambiar su estructura visual ni auth.
Usar default y template constantes y eliminar las asignaciones document.title por materia,
período o comisión. Los títulos visibles de PageHeader y breadcrumbs no se alteran por esta
regla. Comprobar los títulos HTML producidos para rutas estáticas y resolución de metadata
de páginas dinámicas durante el build. No cambiar las reglas compartidas de encabezados.
