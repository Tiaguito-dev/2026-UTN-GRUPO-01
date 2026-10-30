# TASK-064: Identidad académica y selección de comisiones

Estado: Implementación y verificaciones técnicas finalizadas. Aceptación visual pendiente.

## Alcance autorizado

Refinar el detalle de materia y sus comisiones con asociaciones reales, identificación formal
de carreras y filtros previos a paginación. Conservar breadcrumb compartido, permisos, autoría,
destinatarios de comentarios y contexto de cursada. Sin commits, dependencias ni migraciones.

## Decisiones previas

- Centralizar nombres formales en lib/format/carrera y conservar exports de validaciones.
  Identidad Básica se calcula con carreras distintas de las asociaciones completas, nunca
  con el nombre ni con las asociaciones visibles del catálogo. No se persiste clasificación.
- Año académico corresponde a carrera seleccionada; sin selección se informa un año común
  o Año según carrera. Electivas conservan nivel; si difiere, Nivel según carrera.
- Reutilizar carrera, cursadaId y comisionesPage de la URL. Carrera válida del catálogo se
  conserva; carrera única fija; compartida sin selección válida no consulta comisiones.
  Año por defecto más reciente solo cuando no existe cursadaId explícito; ID inexistente
  no cambia automáticamente a otro período. Cambiar carrera/año reinicia comisionesPage.
- El contrato actual identifica cursadas por materia+año; modalidad anual/cuatrimestral
  permanece en materia. Se mantienen IDs reales de cursada y no se mezclan sus comentarios.
- Extender GET /cursadas/:id/comisiones con carrera opcional validada. Filtro en findMany y
  count, antes de skip/take, orden estable, respuesta paginada existente. Sin filtro mantiene
  compatibilidad para administración y otros consumidores. No descargar todas las comisiones.
- Tarjeta completa como enlace nativo, código unido, denominación formal, docentes/cargos
  existentes y grilla de aproximadamente 300 px sin altura mínima artificial. Tokens actuales.

## Aceptación y exclusiones

Materias específicas/básicas, carrera no asociada en URL, años distintos por carrera,
electivas/nivel, selección fija y combinaciones vacías sin cambio automático. Estado carga,
error y reintento. Contador real, nueve comisiones por página y regreso conservado.
Sin cambios auth/router/layout global/hooks compartidos ni reglas del comentario.

## Validación

RED/GREEN de filtros backend y frontend, identidad académica y enlaces de regreso.
Pruebas HTTP/PostgreSQL en base efímera aislada, eliminada al finalizar la ronda. No tocar
datos locales ni levantar el conjunto de servicios apagados. Typecheck/lint/build pertinentes.
Revisión CSS móvil y teclado DOM; sin navegador, aceptación visual pendiente del desarrollador.
Actualizar OVERVIEW frontend/backend y CHANGELOG al terminar.

## Resultado y evidencia

- Nombres formales en lib/format/carrera, reutilizados mediante los exports existentes.
  MateriaDetail recibe asociaciones completas y deriva Básica y año/nivel sin guardar
  clasificación ni escoger arbitrariamente la primera carrera. Metadatos del catálogo
  usan denominaciones formales; su nota aclara el conteo único de materias entre grupos.
- Carrera única fija; compartida sin selección válida no pide comisiones. Selector solo
  ofrece asociaciones de materia. Año explícito inexistente conserva el valor solicitado
  y ofrece cambiarlo. Combinación vacía conserva carrera y cursada; contador real.
- URL conserva búsqueda, contexto del catálogo, carrera, cursadaId y comisionesPage.
  Cambiar carrera/año reinicia página de comisiones. Regreso desde comisión y breadcrumb
  compartido conservados. Respuestas tardías no reemplazan resultados de otra selección.
- GET existente acepta carrera validada y la aplica antes de skip/take y count en una
  transacción RepeatableRead. Orden estable y contratos administrativos sin filtro intactos.
- Tarjeta completa es enlace nativo; código unido, carrera formal, docentes y cargos
  reales, foco visible y ChevronRight decorativo. CSS con tokens, mínimo adaptable de
  300 px por columna, controles que se apilan y nombres largos que ajustan su ancho.
- RED: un caso backend y once frontend fallaron antes de los cambios correspondientes.
  GREEN backend: 168 pruebas unitarias de cuatro archivos y 21 HTTP/PostgreSQL reales.
  HTTP comprueba doce comisiones en dos páginas, separación por carrera/cursada, bajas
  excluidas, total consistente, combinación vacía y carrera inválida. Base aislada con
  las trece migraciones existentes; no hubo nuevas migraciones ni modificaciones locales.
- GREEN frontend: 80 pruebas distintas en siete archivos: selección directa, identidad,
  materia, service, filtros del catálogo, comisión y formulario de comentarios. Cobertura
  de materias compartidas, año por carrera, electivas/nivel, filtros combinados, reinicio
  de página, URL/restauración, teclado, enlaces nativos, nombre largo y estados vacíos.
  La última ronda focalizada de catálogo aprobó sus quince pruebas tras adaptar las
  expectativas de denominación formal y corregir la nota de conteo de materias únicas.
- Typecheck y lint de ambos workspaces aprobados; frontend se comprobó nuevamente tras
  los últimos ajustes. Builds Docker de backend y frontend aprobados con Node 22.22.3.
- Revisión React siguiendo la skill react-best-practices ya leída en la sesión: cálculo
  derivado de URL/asociaciones, sin efectos adicionales para sincronizar filtros, y clave
  de recursos por carrera/cursada. Sin consultas ocultas de todas las comisiones.
- Contenedor PostgreSQL efímero eliminado en finally; comprobado que no quedó. Servicios
  locales apagados al terminar; imágenes nuevas listas para el siguiente arranque. No se
  inició el conjunto para aceptación. Sin navegador; revisión visual pendiente del usuario.
- Sin dependencias, scripts auxiliares persistentes ni commits. Actualizados ambos OVERVIEW
  y CHANGELOG. Mensaje sugerido: feat(academic): refinar identidad y filtros de comisiones.
