# TASK-058: Jerarquía visual de Experiencias de comisión

Estado: Finalizada. Fecha: 2026-10-27. Rama: feature/comentarios.

## Objetivo y alcance

Facilitar la lectura de comentarios desde Experiencias en el detalle de comisión de Materias.
Ordenar encabezado, acciones, aviso informativo y listado. Presentar el texto como contenido
principal y autor/docente/fecha como contexto. Aviso del límite con icono de notificación.
Todas las acciones del bloque serán botones simples; no habrá enlaces en su contenido.

## Exclusiones y restricciones

No modificar detalle individual, formulario, backend, contratos, permisos, paginación 9/3,
layout, autenticación, hooks compartidos, estilos base ni componentes UI globales.
Sin dependencias nuevas, scripts, contenedores ni pruebas de navegador. Prueba manual del usuario.

## Decisiones

Renderizar las tarjetas de lista dentro de ComisionFeedback, conservando FeedbackCard del
detalle sin cambios. Navegar mediante botones y router.push; no repetir enlaces al contexto
de comisión donde ya está el usuario. Usar CSS Module con clases nuevas exclusivas del bloque,
tokens existentes y distribución adaptable. El aviso permanente es informativo (role note),
con icono decorativo; no una alerta urgente anunciada al cargar.

## Aceptación y validaciones

- Encabezado y acción principal identificables; aviso breve con icono.
- Comentarios completos, saltos de línea preservados y texto largo sin desbordes.
- Autor/anónimo, docente o referencia general, fecha y edición visibles en segundo plano.
- Botones con foco visible y nombres claros; se conservan destinos de publicación y detalle.
- Se mantienen carga, reintento, estado vacío, límite por usuario y cierre por inactividad.
- Actualizar únicamente las pruebas existentes afectadas por el cambio de navegación.
- Ejecutar pruebas de comisión pertinentes, typecheck y lint frontend. Sin pruebas backend:
  esta tarea no cambia comportamiento ni contratos del servidor.

## Resultado

Implementado en ComisionFeedback.tsx y clases experience* del CSS Module existente.
FeedbackCard, detalle individual, formulario e historial conservan su presentación.
Los tres tests existentes del bloque se adaptaron a botones y verifican los destinos y
la ausencia de enlaces; no se crearon nuevos archivos de pruebas.

Validación: 18 tests aprobados entre feedback-comision, feedback-components y
comision-detalle. Typecheck y lint frontend aprobados. Sin navegador ni contenedores de prueba.
La revisión visual/manual queda a cargo del desarrollador.

Commit sugerido, sin ejecutar:
style(feedback): mejorar la presentación de experiencias por comisión
