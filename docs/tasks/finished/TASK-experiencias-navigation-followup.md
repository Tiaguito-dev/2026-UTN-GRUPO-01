# Correcciones posteriores a la validación de Experiencias

## Alcance autorizado

- Botón del detalle propio: Ocultar comentario, sin cambiar presentación aprobada.
- Investigar aviso tras desestimar un reporte; aclarar la restitución explícita existente.
- Corregir destino tras login de USER con returnTo administrativo y salida explícita.
- Breadcrumb visible y coherente con origen Inicio, Experiencias/Mis experiencias y
  recorrido académico, incluyendo detalle y edición. Conservar filtros y página.

## Exclusiones

Sin backend, cambios de transiciones, permisos, datos de usuarios, dependencias, commits,
push ni despliegue externo. Navegador y validación manual reservados al usuario. No rediseñar.

## Decisiones previas y evidencia

- Corrección de auth autorizada por el pedido explícito de reparar cambio de cuenta: se
  limita a lib/navigation y, si corresponde, retorno durante logout; no cambia autenticación.
- roleDestination devuelve cualquier ruta segura para USER, incluso /home/admin. Corregir
  para que una cuenta normal use su home cuando el destino requiere ADMIN; conservar guard.
- feedbackNavigation fabrica Materias > materia > comisión independientemente del origen.
  ExperienciasList omite breadcrumb en las dos secciones estudiantiles. Usar el origen
  explícito validado; no inventar historial de visitas ni usar document.referrer/history.
- Desestimar cierra FeedbackReporte y conserva ocultoReportes deliberadamente (T4/T5).
  La restitución preventiva usa acción versionada existente y exige menos de dos denunciantes
  abiertos. No restituir automáticamente ni modificar el comentario de Benjamin.

## Aceptación y validación

Pruebas de destinos por rol, logout/login, breadcrumbs según entrada y URLs preservadas;
estados/reportes y acciones del autor; regresiones de Inicio y feedback. Typecheck, lint,
build y diff check. Actualizar documentación y CHANGELOG. Sin ejecución de navegador.

## Evidencia de cierre

- `roleDestination` envía a `/home` cualquier retorno seguro `/home/admin...` cuando el rol
  no es ADMIN. Logout marca el fin explícito y `RequireAuth` navega a `/login?notice=logout`
  sin `returnTo` que permita reusar la última pantalla administrativa.
- “Ocultar comentario” en el estado visible; quitar el ocultamiento propio conserva su etiqueta
  específica solo cuando hay restricciones externas.
- El listado USER siempre ofrece breadcrumb Inicio/Experiencias y añade Mis experiencias
  donde corresponde. El detalle y editor propio usan el origen permitido. `feedbackPaso`
  distingue los pasos académicos y permite volver con los mismos filtros, materia y página.
- Al cerrar un reporte sin restitución, la experiencia continúa en `ocultoReportes` como
  exige el flujo T4/T5. El panel ahora indica la acción existente de restitución cuando hay
  menos de dos denunciantes abiertos; sobre el umbral pide cerrar más reportes antes.
- Pruebas focalizadas iniciales: 133/134. Falló solo una expectativa antigua de URL porque
  ahora incluye `feedbackPaso=comision`; actualizada al contrato de navegación presentado.
- Pruebas de experiencias/auth: 134/134 aprobadas. Regresión panel ADMIN y destinos por rol:
  58/58. Typecheck, lint y build de producción front exit 0. Build compiló 31 páginas.
  `git diff --check` sin errores; solo aviso Git de normalización LF/CRLF para el spec nuevo.
- No hubo pruebas manuales ni navegador por pedido del usuario. No hubo cambios backend,
  base de datos, endpoints, permisos, commits, push ni despliegue.
