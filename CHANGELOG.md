# Historial de Cambios

## [Sin publicar]

### Validado

- El desarrollador confirmó el 2026-10-09 los cambios de autenticación, Docker y UX de
  TASK-005 a TASK-013; las tareas se cerraron en `finished/`.
- Guía del equipo actualizada con arranque local, configuración privada y el flujo de
  una única PR de `feature/auth` hacia `desarrollo` protegido.

### Agregado

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
