# TASK-012: Menú de cuenta y perfil

Estado: Terminada; validación manual confirmada por el desarrollador el 2026-10-09
Fecha: 2026-10-09
Diseño: [TDD-UX-H2](../../tdd/TDD-UX-H2.md)

Reemplazar enlaces públicos de navbar por botón con icono de cuenta y opciones contextuales.
Autenticado: Mi perfil, Cambiar contraseña y Cerrar sesión. Visitante: acceso/registro dentro
del desplegable. Mejorar presentación de datos de perfil y separar opciones debajo de la tarjeta;
no mostrar cambio de contraseña inicialmente ni logout dentro de datos. Reutilizar auth y forms.
Landing, backend y Compose quedan fuera de alcance salvo rebuild frontend en stack local.
Validar tipos/tests frontend, navegador real teclado/Escape/clic exterior/mobile, selección cambio,
logout confirmado y fallo recuperable. Documentar resultados, sin commit automático.

## Implementación y controles

- Icono de cuenta con desplegable contextual, teclado, Escape, clic exterior y estados de sesión.
- Perfil con iniciales, nombre, email y rol; acciones debajo de la tarjeta. Formulario de cambio
  exclusivo de `/account/change-password`, protegido y admitido como retorno interno seguro.
- Logout compartido con prevención de envío duplicado y mensaje de fallo enfocado. Se conserva
  el foco mientras se envía para evitar desmontar el desplegable y ocultar errores de conexión.
- `npm run test --workspace=front`: 43/43 pruebas aprobadas.
- `npm run typecheck --workspace=front`: aprobado.
- `docker compose -f docker-compose.dev.yml build frontend`: aprobado con Node 22.22.3.
- Chromium contra HTTP local, backend y PostgreSQL reales: menú visitante/autenticado, Tab,
  Escape, clic exterior, ruta protegida/retorno, tarjeta sin formulario ni logout, selección y
  cambio real de contraseña, login posterior, móvil 320/390 sin desbordamiento, fallo de red
  en logout sin perder sesión, reintento exitoso y `/auth/me` rechazado después del cierre.
- Stack actualizado en http://localhost:8080; cinco servicios saludables.
- Lint no disponible como script del frontend. Backend sin cambios, sus controles no se
  repitieron en esta tarea. Esto no sustituye la matriz completa pendiente de etapa 5.
- README y front/OVERVIEW actualizados. Pendiente validación manual del desarrollador;
  tarea permanece en progreso hasta esa aprobación. No se creó un commit.

## Cierre vigente

El desarrollador confirmó que los cambios realizados quedaron comprobados el 2026-10-09.
Esta aprobación cierra la validación manual indicada como pendiente en la evidencia histórica
de esta tarea. Los controles anteriores conservan sus resultados y límites: no se afirma
una nueva ejecución de la matriz automatizada completa de navegador ni entrega SMTP real.
La configuración y navegación vigentes se describen en README y los OVERVIEW de cada módulo.
