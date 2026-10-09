# TDD-UX-H2: Navegación de cuenta

El menú se implementa como disclosure accesible con botón SVG local, aria-expanded/controls,
opciones nativas link/button, cierre por Escape y clic externo, foco de retorno apropiado.
No añadir librerías. Visitantes ven acceso/registro dentro del panel; sesión en comprobación
y error temporal tienen feedback sin inventar un estado autenticado.

Perfil muestra avatar de iniciales, nombre, email y rol en tarjeta exclusiva de datos. Acciones
debajo, fuera de la tarjeta. Cambio de contraseña se abre desde acción explícita en página
protegida `/account/change-password`, reutilizando AccountForm. Logout reutiliza un componente
con estado de envío y error seguro, conservando confirmación backend y sincronización de pestañas.
Solo se permite retorno a rutas internas enumeradas. No modificar landing, política ni backend.
