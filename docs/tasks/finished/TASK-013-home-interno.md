# TASK-013: Separación pública e interna

Estado: Terminada; validación manual confirmada por el desarrollador el 2026-10-09
Diseño: [TDD-UX-H3](../../tdd/TDD-UX-H3.md).

Landing exclusiva previa al login, sin icono de cuenta. Usuario autenticado accede a `/home`
desde el logo y como destino por defecto del login. Perfil/cambio protegidos. Home básico
con menú lateral fijo de funcionalidades previstas y estados vacíos informativos seleccionables.
No implementar módulos académicos, endpoints ni dependencias. Conservar auth/refresh/CSRF.
Validar tipos, pruebas, build Docker y navegador real público/autenticado, recarga, móvil,
navegación y logout. Actualizar documentación y changelog; sin commit automático.

## Resultado y evidencia

Implementados RequireGuest, SystemHome y `/home` protegido. Logo/retorno predeterminado
apuntan al home interno; icono solo con sesión comprobada. Menú lateral fijo en escritorio
y adaptado a móvil, con selección y foco del encabezado; módulos futuros sin operaciones.
Se conserva login explícito con advertencia ante sesión incierta, para recuperar una
renovación ambigua sin repetir refresh ni afirmar que la sesión terminó.

- Frontend unitario: 47/47 aprobadas (`npm run test --workspace=front`).
- Tipos aprobados (`npm run typecheck --workspace=front`).
- Build Docker frontend aprobado, Node 22.22.3 y Next 16.3.8.
- Chromium contra stack HTTP y PostgreSQL reales: landing visitante sin icono, home/perfil/
  cambio protegidos, login al home y recarga, cuatro estados vacíos, menú fijo y foco,
  redirecciones de landing/login/registro autenticados, perfil/logo, móvil 320/390 sin
  desbordamiento, logout, error 503 y recuperación explícita, retorno al cambio de contraseña.
- Stack desplegado en http://localhost:8080: cinco servicios saludables.
- Sin lint configurado; backend sin cambios, no se repitieron sus controles. No se ejecutó
  la matriz completa de etapa 5; recorrido automatizado acotado a esta tarea.
- README, front/OVERVIEW y CHANGELOG actualizados. Pendiente revisión manual del desarrollador.
  Sin commit automático.

## Cierre vigente

El desarrollador confirmó que los cambios realizados quedaron comprobados el 2026-10-09.
Esta aprobación cierra la validación manual indicada como pendiente en la evidencia histórica
de esta tarea. Los controles anteriores conservan sus resultados y límites: no se afirma
una nueva ejecución de la matriz automatizada completa de navegador ni entrega SMTP real.
La configuración y navegación vigentes se describen en README y los OVERVIEW de cada módulo.
