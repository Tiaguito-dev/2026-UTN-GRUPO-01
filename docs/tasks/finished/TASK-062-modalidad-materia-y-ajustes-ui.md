# TASK-062: Modalidad de materia y ajustes visuales

## Alcance autorizado

Restaurar las tarjetas compactas de comisiones, estilizar el selector de cursada, mantener
breadcrumbs coherentes al entrar en comisión y mejorar la jerarquía del formulario de
experiencias. Separar modalidad de la materia del año de cursada en todo el flujo académico.

## Decisiones previas

- Materia posee modalidad `ANUAL`, `PRIMERO` o `SEGUNDO` (los últimos dos son cuatrimestrales),
  sin restricciones según carrera/año/electiva. Nuevas materias requieren modalidad; cambios
  se auditan y editan enviando diferencias reales. Registros previos sin evidencia fiable
  conservan modalidad nula y se presentan como sin definir, sin inventar datos.
- Cursada identifica materia + año y su etiqueta es solo el año. Contratos de alta/lectura,
  unicidad, selectores, datos administrativos, seed y documentación se ajustan juntos.
- Migración sin borrar filas ni cambiar IDs: conservar el cuatrimestre antiguo de Cursada
  como columna nullable interna para no perder información histórica, pero retirarlo del
  contrato público y de nuevas altas. Unicidad por materia/año. Si hay colisiones, la migración
  debe abortar con explicación, nunca fusionar ni eliminar datos silenciosamente.
- Modalidad existente se deduce únicamente cuando todas las cursadas registradas de esa
  materia tienen un cuatrimestre consistente. Con datos contradictorios o ausentes, null.
  Auditoría local inicial: cero grupos activos duplicados materia/año y cero materias con
  cuatrimestres contradictorios. La migración verifica también registros eliminados.
- Feedback mantiene snapshot histórico: conservar cuatrimestre antiguo nullable y agregar
  snapshot de modalidad de materia. Nuevas experiencias capturan modalidad, incluso ANUAL;
  datos anteriores se completan desde su propio snapshot, nunca desde la materia actual.
- En UI, año y modalidad se presentan como datos separados. Ajustar tipos, esquemas de
  respuesta, formularios administrativos y vistas afectadas, sin nuevos endpoints.
- Recuperar la grilla de tarjetas del módulo existente con radios moderados; selector nativo
  accesible con apariencia controlada, fondo/borde/tipografía y chevron Lucide. Mantener
  enlaces nativos, paginación de nueve y contexto de retorno.
- El breadcrumb de comisión adoptará el estilo compartido existente quitando overrides
  locales, sin tocar primitivas globales ni estilos base.
- Spec adicional del usuario para comentarios: ancho máximo 880 px, contexto sin tarjeta,
  una superficie blanca, destinatario antes del texto (radios hasta tres opciones, selector
  para más), identidad en dos radios, contador de puntos de código del texto recortado
  igual al backend, acciones con envío/progreso y confirmación accesible al cancelar cambios.
  Preservar anonimato, asociación automática con docente único (solo su opción está permitida
  en ese caso), referencia inmutable en edición, errores, estados y navegación actual.
  Contexto muestra año y modalidad reales; selector de cursada sigue mostrando solo año.

## Restricciones

Trabajar en feature/comentarios; sin commits, dependencias nuevas, scripts auxiliares ni
pruebas de navegador. No modificar auth, router, layout global, hooks compartidos o primitivas
UI globales. Aplicar migración local al servir los nuevos servicios, conservando todos los
datos. Eliminar bases efímeras después de cada ronda. Reconstruir frontend al terminar.

## Aceptación y verificación

- Materia anual, primer y segundo cuatrimestre, incluidas electivas, altas/edición/historial.
- Cursada solo año, rechazo de duplicado anual; migración preserva IDs, comentarios y legado.
- Snapshot de modalidad no cambia al editar materia, publicación anual válida.
- Tarjetas compactas responsive, selector con estilo y foco, breadcrumb consistente.
- Formulario legible con etiquetas/ayudas/privacidad agrupadas y flujo principal preservado.
- RED/GREEN con pruebas enfocadas, PostgreSQL aislado para migración y contratos, typecheck,
  lint y build de ambos workspaces; comprobación HTTP. Revisión visual a cargo del usuario.
- Actualizar OVERVIEW por módulo, infra si corresponde, CHANGELOG y evidencia de tarea.

## Resultado y evidencia

- Migración `20261103000000_modalidad_materia_cursada_anual`: columnas de modalidad en
  materia/snapshot, unicidad materia/año y legado de cuatrimestre nullable. Transacción aborta
  ante colisiones, incluidas bajas. No borra filas ni cambia identificadores.
- Modalidad se valida, edita por diferencias y consume en historial, catálogo, detalle y
  formularios; incluye electivas. Alta de cursada envía solo materiaId y anio. Seed actualizado.
- Grilla compacta reutiliza tarjetas existentes; selectores estilizados conservan semántica
  nativa y foco. Breadcrumb de comisión vuelve al estilo compartido de materia.
- Formulario real según spec ampliado: contexto, una superficie de máximo 880 px, referencia
  antes del texto, radios/selector según opciones, nombre público o anonimato con radios,
  contador de puntos de código del texto recortado, errores vinculados y progreso accesible.
  Cancelar preserva el contexto y pide confirmación si hay cambios; no limpia el formulario.
- Envíos siguen las reglas existentes: un vigente por comisión, docente único automático,
  referencia inmutable al editar y detalle privado del autor. Selecciones y texto sobreviven
  al error; se verificó reintento exitoso. No se introdujeron reglas de moderación.
- RED confirmado antes de cambios de contratos/modalidad y jerarquía del formulario.
  GREEN backend: 297 pruebas (211 unitarias y 86 de integración/migración PostgreSQL).
  Frontend académico: 103 pruebas; feedback: 37 pruebas en cinco archivos, incluidas
  16 del formulario/detalle. Cobertura de electivas anuales, diferencias de modalidad,
  preservación de asociaciones, snapshot histórico, rollback ante duplicados, radios con
  teclado, listas extensas, contador Unicode, límite, espacios, doble envío y cancelación.
- Typecheck y lint de ambos workspaces aprobados; builds Docker backend/frontend/proxy
  aprobados con Node 22.22.3. Sin pruebas de navegador o capturas por preferencia del usuario.
  CSS revisado en escritorio/móvil, controles apilados, texto largo y foco; revisión visual
  manual pendiente.
- Migración aplicada localmente por el job existente de Compose; antes/después: 17 materias,
  17 cursadas, 17 comisiones y 3 filas de feedback (incluye eliminados). La huella de sus IDs
  coincide exactamente. Modalidades deducidas de evidencia previa: 2 PRIMERO y 15 SEGUNDO.
- Verificación HTTP real autenticada: materia con modalidad, cursada sin cuatrimestre público,
  comisión con materia/modalidad y feedback con snapshot y anonimato correcto. Páginas de
  materia, comisión, nueva experiencia y Experiencias responden 200 con título fijo. Sesión
  de prueba cerrada con 204. No se publicaron comentarios ni se alteraron datos para probar.
- Servicios saludables y frontend reconstruido. Bases efímeras eliminadas al terminar cada
  ronda, ninguna persistente de pruebas. Sin nuevas dependencias, scripts auxiliares ni commits.
