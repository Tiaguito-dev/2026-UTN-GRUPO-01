# Historial de Cambios

## [Sin publicar]

### Buscador de materias y niveles de electivas (TASK-025)

- Cambios de materias (TASK-024 y TASK-025) validados manualmente por el usuario el 2026-10-22.
- Búsqueda parcial por nombre combinable con año y nivel, aplicada antes de paginar.
- Selector de nivel 3, 4 o 5 al filtrar Electivas; texto, año, nivel y página se conservan
  al navegar al detalle y regresar.
- Nivel obligatorio para crear o editar electivas, visible en sus datos y trazado en
  historial. Al convertir una electiva en obligatoria se limpia su nivel.
- Casos probados y resultados documentados en la
  [matriz TASK-025](docs/tasks/finished/TASK-025-busqueda-materias-niveles-electivas.md#matriz-de-trazabilidad-de-casos-probados).

### Filtros de materias por año de carrera (TASK-024)

- Consulta de materias filtrada y ordenada por año de carrera y nombre, con páginas de
  hasta 9 elementos y conservación del filtro al regresar desde el detalle.
- Clasificación obligatoria de nuevas materias: primero a quinto año o Electiva;
  las materias heredadas permanecen sin clasificación hasta su actualización administrativa.
- Alta y edición administrativa con validación, auditoría e historial de cambios de
  campos paginado de a 3 elementos. Controles funcionales sin rediseño general de la UI.
- Matriz de trazabilidad de criterios, pruebas y recorrido en navegador en
  [TASK-024](docs/tasks/finished/TASK-024-filtros-materias-anio-carrera.md#trazabilidad-de-casos-probados).

### Verificación institucional (TASK-022)

- Registro de estudiantes pendiente hasta confirmar su correo `@alu.frlp.utn.edu.ar`.
- Enlaces SMTP de verificación con vencimiento de 24 horas, confirmación y reenvío.
- Bloqueo de login, sesiones y refresh de estudiantes sin verificar; ADMIN provisionados
  explícitamente conservan acceso.
- Pantallas de confirmación y reenvío, y protección de tokens y cabeceras de privacidad.
- Validación automatizada y manual aprobada, incluido el envío SMTP real desde el entorno local.

### Validado

- El desarrollador confirmó el 2026-10-09 los cambios de autenticación, Docker y UX de
  TASK-005 a TASK-013; las tareas se cerraron en `finished/`.
- Guía del equipo actualizada con arranque local, configuración privada y el flujo de
  una única PR de `feature/auth` hacia `desarrollo` protegido.

### Agregado

- Red de seguridad de calidad del front: ESLint (Next `core-web-vitals`, `react-hooks`,
  `jsx-a11y`, en advertencias), workflow de CI de verificación, tests de caracterización de
  interacción con jsdom y Testing Library, y spec de línea base visual con axe. (TASK-023)
- Panel de administración del catálogo académico: alta de materias, profesores, cursadas y
  comisiones y listado de cuentas registradas, bajo `/home/admin` y visible solo para cuentas
  ADMIN. (TASK-020)
- Separación de entrada pública y navegación autenticada: landing sin icono de cuenta,
  `/home` protegido con menú lateral y estados vacíos informativos de próximos módulos.
  (TASK-013)
- Menú de cuenta por icono con Mi perfil, Cambiar contraseña y Cerrar sesión; perfil con
  tarjeta de datos separada de las acciones. (TASK-012)
- Landing de Profesor Butchery con propósito, CTA y carrusel 3D accesible de
  funcionalidades futuras. (TASK-011)
- Política de contraseña unificada (8–128 caracteres) en frontend/backend y paso a HTTP
  local en desarrollo, preservando HTTPS en producción. (TASK-011)
- Instructivo Docker aclarado por entorno, con recorrido de navegador y recuperación vía
  Mailpit comprobados.
- Stack Docker completo: Compose separados para desarrollo y producción, builds por
  etapas, migraciones Prisma como job y Nginx no-root. (TASK-010)
- Endurecimiento de contenedores: healthchecks, usuarios no-root, límites de recursos y
  filesystems de solo lectura. Mailpit y TLS local exclusivos de desarrollo. (TASK-010)
- Etapa 4 de autenticación: recuperación y cambio de contraseña por SMTP, con tokens de
  un solo uso y revocación de sesiones al cambiar. (TASK-008)
- Etapa 3: refresh opaco con rotación atómica y logout; reutilización de un token
  revoca la sesión. (TASK-007)
- Etapa 2: login, sesión persistida, roles ADMIN/USER y protección CSRF/CORS. (TASK-006)
- Etapa 1: registro público con rol USER fijo, hash Argon2id y provisión de ADMIN
  explícita e idempotente. (TASK-005)
- Monorepo inicial con NestJS, Next.js, Prisma y PostgreSQL; flujo y tareas documentados
  en `AGENTS.md`.

### Seguridad

- Prisma usa el adapter JavaScript `pg` sin motor binario nativo.
- `deepmerge-ts` se fija en 8.0.2 mediante `overrides`.
