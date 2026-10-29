# TASK-067 — Integrar desarrollo y verificar compatibilidad

## Alcance y autorización
Integrar origin/desarrollo 1be4682, aceptando la última versión administrativa del equipo,
sin perder TASK-063 a TASK-066 ni feedback existente. Resolver conflictos, comprobar ambos
workspaces y entregar revisión manual ordenada: cambios del equipo y ajustes recientes.
Sin push ni commit automático; merge preparado para confirmación posterior.

## Decisiones
- Respaldo completo previo en stash 70960259f5818a62a4df84d8ae7f22f371dfa6bd,
  incluidos archivos nuevos. Se conserva hasta que el usuario valide el resultado.
- Prima el contrato entrante de cursadas por materia/año/período (PRIMERO/SEGUNDO/ANUAL)
  y se conservan listados/editores administrativos, sus rutas y permisos.
- Mantener modalidad opcional de materia y snapshots de feedback; la cursada real define
  el período del comentario. No fusionar cursadas, reemplazar IDs o borrar experiencias.
- Compatibilizar la migración aún no publicada de esta rama con períodos múltiples del
  equipo y agregar corrección posterior para instalaciones locales que ya aplicaron la
  variante anterior. Los períodos desconocidos legados se conservan, nunca se inventan.
- Mantener filtros/URLs y UI reciente, pero distinguir períodos del mismo año con datos
  reales para no mezclar comisiones ni comentarios.

## Restricciones
No aplicar migraciones ni pruebas sobre la base local. Sin navegador; servicios apagados.
Contenedores de prueba efímeros eliminados en finally. Sin dependencias nuevas ni scripts
temporales versionados. Mantener auditoría y autorizaciones del equipo y de feedback.

## Aceptación
Sin marcadores ni entradas Git en conflicto. Tipos/lint y pruebas frontend/backend;
integración HTTP/PostgreSQL con períodos compartidos, administración y permisos de feedback;
compilación Docker. Documentar migraciones y evidencia, junto con riesgos y revisión manual.

## Cambios ajenos a revisar primero
- Administración: nuevas tablas de materias, cursadas y comisiones; editar profesores,
  materias/carreras, año/período de cursadas y carrera/número de comisiones. Rutas y permisos
  de desarrollo preservados. Probar guardar/cancelar y retorno con filtros/paginación.
- Selector múltiple de carreras de materia: alta con varias carreras, precarga al editar
  y conservación de asociaciones; protección al quitar una carrera usada por comisiones.
- Cursadas Anual/Primero/Segundo del mismo año: altas, duplicado exacto rechazado, edición
  de período, cambio de materia compatible y rechazo si las comisiones no corresponden.
- Edición de profesor y comisión: no perder relaciones/docentes/estado ni acceder como USER.
  La corrección de validación de controles de email del equipo también se conserva.

## Ajustes propios a revisar después
- Breadcrumb compartido, nombres largos y regreso con los filtros de Materias/Experiencias.
- Detalle de materia: denominaciones formales, Básica calculada sobre todas las carreras,
  año según carrera, electivas/nivel; carrera y cursada filtradas en servidor, tarjetas
  completas y estados sin comisiones. Docentes debajo de las experiencias.
- Experiencias: carrera real de la comisión + materia, selector buscable, nueve por página,
  total/rango correctos, anonimato incluso para autor y permisos de Administrar mi comentario.
- Compartir experiencia: destinatario general/docente válido, texto/3000 caracteres,
  identidad pública, cancelación con cambios, publicación/error/reintento.
- Tu comentario: acciones dentro de tarjeta, identidad/fechas, historial cerrado y paginado
  de tres, editar/cancelar/eliminar, regreso al listado filtrado y rechazo de acceso ajeno.
- Aceptación visual de escritorio/móvil pendiente; no se ejecutan pruebas de navegador.

## Compatibilizaciones de esta integración
- Año/período real de cursada vuelve a ser parte del contrato según desarrollo. No vuelve
  la pantalla intermedia: se conserva el filtro en materia y se distinguen períodos del
  mismo año. El período real también tiene prioridad en comisión y nuevos comentarios.
- Se preservan las asociaciones y su validación del equipo al agregar el filtro por carrera
  de comisiones. Se conserva retorno administrativo y breadcrumb compartido en edición.
- La migración 20261103000000 aún no publicada se adapta para bases del equipo con varios
  períodos del mismo año. 20261104000000 corrige bases locales con la variante previa.
  Sin pérdidas, fusiones ni períodos inventados; nulls requieren selección manual posterior.
- Si la base local ya aplicó la variante previa de 20261103000000, revisar checksum/historial
  antes de retomar migrate dev y no aceptar reset. No se aplica ni modifica la base local.

## Resultado y evidencia técnica
- Pull de origin/desarrollo hasta 1be4682 con --no-commit --no-ff en feature/comentarios.
  Se recupera el stash completo y se resuelven los conflictos de ambas etapas. No se crea
  commit ni se hace push; merge preparado y respaldo original conservado para revisión.
- Contratos de períodos recuperados en puertos/repositorios/DTOs/services/schemas y formularios.
  Los tests se adaptan a período explícito y al selector múltiple, conservando las pruebas
  de las mejoras propias. No se descartan los casos de modalidad, filtros o feedback.
- Regresión frontend completa: 410 pruebas en 47 archivos. Caso adicional de período legado
  desconocido y regresión de detalle de comisión/formulario: 38 pruebas correctas (411 casos
  distintos cubiertos en total). Navegador y aceptación visual no ejecutados.
- Backend: 639 pruebas unitarias correctas, otras integraciones ajenas al alcance omitidas
  por no tener TEST_DATABASE_URL en esa corrida. Integración focalizada: 99 pruebas correctas
  (21 académicas, 60 administrativas, 15 feedback y 3 de migración). Tras ajustar null legado,
  se repiten las 15 de feedback correctamente; nunca se usa DATABASE_URL local como fallback.
- Quince migraciones aplicadas desde cero en PostgreSQL 17 efímero. También se prueba SQL
  sobre esquemas legados: mismos años/períodos distintos, IDs/texto preservados y corrección
  de la unicidad anual previa sin completar períodos desconocidos.
- Cada contenedor butchery-task067-test-db se elimina en finally al terminar su corrida,
  incluidas las corridas RED. Base local y servicios de desarrollo permanecen intactos.
- Typecheck y lint de ambos workspaces correctos. Build Docker backend/frontend correcto;
  una última compilación verifica el tratamiento de null legado. Sin dependencias nuevas.
- Revisión manual pendiente: listas anteriores (ajenos, propios e integración). La aceptación
  de base local requiere revisar el historial/checksum de la migración previa antes de usar
  herramientas que puedan proponer reset; no se automatiza esa modificación.

## Separación y commit solicitados posteriormente
- Commit local de merge: `d877417 chore(merge): integrar desarrollo y compatibilizar cursadas`,
  padres `07ad055` y `1be4682`. Incluye administración entrante y compatibilidad necesaria;
  no incluye los rediseños/filtros de TASK-063 a TASK-066. Sin push.
- Se separó por contenido en archivos compartidos, usando el stash original como referencia.
  El árbol aislado de merge pasó typecheck backend/frontend, 177 pruebas backend y 59 frontend.
  Se revisó con git diff --cached y su verificación de whitespace antes de commitear.
- Noventa y un archivos cambiaron en el merge; cincuenta y nueve conservan ajustes de la
  sesión sin commit, fuera de stage. Hay archivos compartidos con cambios en ambas categorías.
- Se verificó que todo el contenido de trabajo coincidiera con el árbol completo anterior
  al commit. El worktree temporal y su patch/índice de revisión fueron eliminados. El stash
  inicial se conserva como respaldo; no debe aplicarse sobre el trabajo que ya está recuperado.
- Revisar primero los cambios ajenos (HU-11), luego los propios (TASK-063 a TASK-066), con
  especial atención a la compatibilidad de períodos/migraciones incluida en el merge.
