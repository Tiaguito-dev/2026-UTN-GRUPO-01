# TASK-057: Publicación, edición y eliminación de comentarios por comisión

Estado: Finalizada; alta, edición y baja aceptadas manualmente por el desarrollador el 2026-10-27.
Fecha: 2026-10-26. Rama: feature/comentarios.

## Objetivo y alcance

Permitir que un usuario publique texto sobre una comisión o uno de sus docentes, edite su
comentario y lo elimine. Se puede publicar anónimamente y mantener un único comentario
vigente por usuario y comisión, aunque haya varios docentes. Al eliminarlo puede publicar otro.

El desarrollador acotó esta entrega expresamente al flujo principal. Se difieren búsqueda
histórica por docente, perfiles docentes, control administrativo de activación, reportes,
moderación, puntuaciones, respuestas, reacciones y archivos adjuntos.
La comisión ya posee activa; esta entrega consume ese estado sin agregar su administración.

## Decisiones de contrato

- ADMIN y USER autenticados y habilitados pueden publicar. La autoría proviene de la sesión.
- Nuevas publicaciones y ediciones requieren comisión activa y jerarquía académica no borrada.
  El retiro propio sigue permitido al desactivarse o darse de baja la comisión.
- Con un docente se asocia automáticamente a él; con varios se permite elegir uno o general;
  sin docentes se admite comentario general. El docente elegido debe pertenecer a la comisión.
- Texto plano recortado de 1 a 3000 puntos de código. Permitir saltos de línea y tabulación;
  rechazar controles restantes. React presenta el texto escapado, sin interpretar HTML.
- Publicación inmediata, sin verificación de inscripción ni moderación en esta etapa.
- Edición de texto y anonimato, solo diferencias reales; no se cambia el docente durante edición.
- Anonimato de presentación: autorId y email no salen en las respuestas, autor visible null
  si es anónimo. Solo el autor ve su historial, incluso después de eliminación lógica.
- El contexto de materia, cursada, comisión y docente/cargo se conserva como instantánea al
  publicar. La reasignación posterior no reatribuye ni modifica comentarios anteriores.
- Borrado lógico y revisiones transaccionales. Índice parcial UNIQUE (autorId,comisionId)
  WHERE deletedAt IS NULL para impedir duplicados incluso ante solicitudes concurrentes.

## API

Todas las rutas requieren sesión; las escrituras usan Origin/CSRF existentes y no se cachean
respuestas dependientes de identidad. No se modifica autenticación.

- GET /comisiones/:id/feedback?page=1&pageSize=9: comentarios vigentes, recientes primero.
- GET /comisiones/:id/feedback/propio: comentario vigente propio o null.
- POST /comisiones/:id/feedback {texto,anonimo,profesorId?}: 201. Omitir profesorId elige al
  único docente; con varios o ninguno null/omisión significa general.
- GET /feedback/:id: detalle vigente.
- PATCH /feedback/:id {texto?,anonimo?}: autor; valores idénticos no escriben ni auditan.
- DELETE /feedback/:id: autor; 204 con baja lógica e historial.
- GET /feedback/:id/historial?page=1&pageSize=3: exclusivo del autor, incluso tras baja;
  eventos {id,accion:CREACION|EDICION|ELIMINACION,texto,anonimo,createdAt}.

Respuesta pública: {id,texto,anonimo,autor:{displayName}|null,propio:boolean,
profesor:{id,nombreCompleto,cargo}|null,
contexto:{comisionId,nombre,materiaId,materiaNombre,cursadaId,anio,cuatrimestre},createdAt,updatedAt}.
Fechas ISO. Listados {items,total,page,pageSize}; máximo 9 y máximo 3 para historial.
400 entrada inválida, 401 sin sesión, 403 autor insuficiente, 404 inexistente,
409 comentario vigente duplicado/comisión cerrada. Mensajes seguros y visibles con reintento.

## Arquitectura y restricciones

- Módulo reviews separado de academic, con dominio puro, puerto y adaptador Prisma.
  FeedbackService reúne las operaciones de un mismo recurso como fachada de aplicación;
  las políticas se separan del adaptador para aplicarlas dentro de la transacción.
- Bloquear la fila de comisión durante mutaciones. Obtener la instantánea de docentes y
  contexto en una lectura SQL consistente; los cambios posteriores no la recalculan.
- Frontend: service/tipos/esquemas/validaciones propios, hook del módulo y CSS Modules;
  componentes existentes sin cambiar UI global, layout, router principal, auth o hooks compartidos.
- Bloque en detalle de comisión y rutas /home/feedback/nuevo?comisionId=...,
  /home/feedback/[feedbackId] y /home/feedback/[feedbackId]/editar.
- Alta regresa al detalle de comisión, home de sus comentarios, con successMessage;
  edición al detalle de feedback. Retiro con confirmación. Historial privado en detalle.
- /feedback/ debe dirigirse al backend en ambos proxies Nginx. /comisiones/ ya está cubierto.
- Migración aditiva compatible con Docker. Sin nuevas dependencias ni variables de entorno.
- No generar scripts auxiliares ni artefactos versionados para validación.

## Criterios de aceptación

1. Publicar comentario general o dirigido al docente válido y verlo inmediatamente.
2. Impedir un segundo comentario vigente por usuario/comisión, incluso anónimo o concurrente.
3. Editar solo diferencias, sin recalcular docente histórico ni auditar operaciones vacías.
4. Impedir edición, eliminación e historial ajenos; anonimato también en payloads.
5. Retirar comentario propio y permitir republicación, conservando revisiones privadas.
6. Impedir altas/ediciones en comisión inactiva; permitir retiro propio.
7. Validar texto y mostrar éxitos/errores; paginar comentarios e historial.

## Validación

Tests automatizados pertinentes a validación, contrato HTTP/PostgreSQL, privacidad,
permisos, duplicados concurrentes y flujo principal de formulario. Tipos, lint y compilación.
TDD: se registró fallo por módulos ausentes antes de implementar los validadores y servicios.

Por instrucción explícita del desarrollador no se realizan pruebas visuales ni de navegador.
Las pruebas manuales y su aceptación quedan a su cargo. Sin instalaciones adicionales.
Actualizar front/OVERVIEW.md, back/OVERVIEW.md y CHANGELOG.md con el alcance real.
No ejecutar commits; entregar mensaje tipo(scope): descripción breve.

## Resultado y evidencia

Implementación terminada; alta, edición y baja aceptadas manualmente por el desarrollador
el 2026-10-27. La consulta histórica por docente se difiere; las instantáneas
de contexto quedan disponibles para una futura tarea.

- Backend: 26 pruebas aprobadas (15 de entrada y 11 HTTP sobre PostgreSQL), incluyendo
  publicación, edición, retiro, republicación, anonimato, permisos y concurrencia.
- Frontend: 30 pruebas aprobadas en los cinco archivos de feedback/detalle de comisión,
  incluida paridad de validación y confirmación de eliminación. Sin navegador.
- Typecheck, lint y build de ambos workspaces aprobados. El runtime local disponible fue
  Node 22.17.0; los archivos de configuración conservan la versión oficial 22.22.3.
- Doce migraciones aplicadas en una base nueva aislada; migrate diff contra schema.prisma
  no detectó diferencias. No se migró la base de desarrollo ni producción.
- El test de retiro detectó una respuesta vacía donde se esperaba JSON null en /propio;
  corregida y verificada en la repetición de la suite completa del módulo.
- Ensayos iniciales de suites generales tuvieron timeouts de workers frontend y dos tests
  de auth bajo carga concurrente. No se modificaron tests ajenos para ocultarlos; conforme
  al alcance reducido se validaron de nuevo los casos pertinentes con ejecución secuencial.
- Sin dependencias nuevas, scripts auxiliares, pruebas visuales ni artefactos versionados.
  Los contenedores y volúmenes de prueba se eliminan tras la validación.

Posteriormente, por pedido explícito del desarrollador, se inició PostgreSQL del Compose de
desarrollo y se ejecutó npm run db:deploy --workspace=back sobre utn_grupo_01 en localhost:55449.
Se aplicaron las ocho migraciones pendientes, incluida 20261102000000_feedback_comisiones.
El contenedor PostgreSQL de desarrollo queda iniciado; no es un recurso efímero de pruebas.

Antes de la prueba manual: iniciar o reconstruir la aplicación actualizada. Desde el detalle de comisión activa,
publicar, abrir el comentario, editar y eliminar; repetir con anonimato y selección docente.

Mensaje de commit sugerido (sin ejecutar):
feat(feedback): permitir publicar editar y eliminar comentarios por comisión
