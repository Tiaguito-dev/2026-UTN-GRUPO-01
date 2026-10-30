# Mensajes de confirmación de baja académica

## Alcance

Quitar el identificador visible y simplificar únicamente el texto de los modales de confirmación de baja académica (Materias, Profesores, Cursadas y Comisiones). Mantener identidad por nombre, conservación del historial y aclaración de las asociaciones vigentes que bloquean la baja según las reglas reales del backend. Reconstruir frontend y dejar stack disponible; sin commit ni navegador.

## Restricciones y decisiones

No cambiar operaciones, handlers, permisos, confirmaciones, gestión docente, backend ni estilos. La solicitud autoriza ajustar el texto del modal reutilizado por las entidades académicas; no interfiere con la funcionalidad integrada por la compañera. No afirmar que toda relación bloquea la baja: Comisiones conserva relaciones/experiencias existentes y no tiene ese bloqueo. Para Profesor mantener la instrucción de desvincular asignaciones vigentes. Conservar los cambios UI ya verificados y sin commit.

## Criterios y validaciones

- Nombre legible, sin Identificador ni UUID en el cuerpo del modal.
- Mensaje breve: deja de estar disponible, se conserva información/historial y dependencias que bloquean según entidad.
- Pruebas existentes de confirmación, cancelación, bloqueo y permisos siguen aprobadas. Perfil test adapta primero expectativas de texto y ejecuta RED; luego cambio de copy y GREEN.
- Typecheck/lint frontend pertinentes y build Docker; reconstruir/recrear solo frontend y comprobar healthchecks por consola. Backend administrativo pertinente según regla de proyecto. Sin navegador ni capturas.
- Actualizar OVERVIEW y CHANGELOG con resultado y proporcionar mensaje de commit sin ejecutarlo.

## Resultado

- Único componente de producción modificado en este ajuste: AcademicDeleteAction.tsx, solo cadenas visibles y eliminación del párrafo Identificador. El ID se conserva internamente para la operación HTTP; handlers, permisos y confirmaciones permanecen intactos.
- Texto común: El registro quedará inactivo. Se conservarán sus datos y el historial. Advertencias de bloqueo específicas de Materias, Profesores y Cursadas con paso a seguir; Comisiones conserva aclaración de restricciones y relaciones sin inventar un bloqueo.
- Perfil test adaptó las expectativas existentes, sin añadir pruebas nuevas: RED 5 fallos/2 aprobadas antes del cambio fuente; GREEN 21/21 en academic-bajas y admin-materia-presentation. Se conservan cancelación, confirmación, bloqueo, permisos, refresco y nombre visible.
- Typecheck de código y pruebas, lint frontend con cero advertencias y build Docker frontend aprobados. Backend administrativo 9/9 pruebas aprobadas. git diff --check aprobado.
- Frontend reconstruido/recreado con docker compose dev up -d --build --no-deps frontend. Cinco servicios healthy, /health/ready y /login HTTP 200 desde consola en http://localhost:8080. Stack dejado levantado, volúmenes y resto de contenedores conservados.
- Ajustes UI anteriores respetados y su verificación manual confirmada por el desarrollador. Sin navegador, imágenes, staging, commit ni push. Pendiente únicamente verificación manual del nuevo mensaje por el desarrollador.
- Mensaje sugerido: fix(admin): simplificar confirmaciones de baja sin mostrar identificadores.
