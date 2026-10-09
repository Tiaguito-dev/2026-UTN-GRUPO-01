# Historial de Cambios

## [Sin publicar]

### Validado

- El desarrollador confirmó el 2026-10-09 los cambios de autenticación, Docker y UX de TASK-005
  a TASK-013. Las tareas se cerraron en finished; las referencias de aprobación pendiente
  de la evidencia histórica de abajo quedan resueltas por esta aceptación.
- Antes de los commits: migraciones aplicadas en PostgreSQL efímero, 277 pruebas backend con
  SMTP/Mailpit aislado y 47 frontend aprobadas; tipos de ambos paquetes y Compose dev válidos.
  No se afirma ejecución de la matriz completa automatizada de navegador ni entrega SMTP real.
- Guía del equipo actualizada con arranque HTTP local, configuración privada, contratos,
  navegación, límites y flujo de una única PR de feature/auth hacia desarrollo protegido,
  sin push del agente.

### Agregado

- Separación de entrada pública y navegación autenticada: landing sin icono de cuenta,
  destino interno `/home` para login/logo, perfil protegido y home con menú lateral
  y estados vacíos informativos de próximos módulos. 47 pruebas frontend, tipos y build Docker
  aprobados, además de recorrido Chromium con backend/PostgreSQL, móvil y errores recuperables.
  Diseño y resultados en TDD-UX-H3/TASK-013; revisión manual pendiente.

- Menú de cuenta mediante icono y opciones contextuales: Mi perfil, Cambiar contraseña y
  Cerrar sesión. Perfil con tarjeta de datos y acciones separadas; cambio de contraseña
  en ruta protegida seleccionada explícitamente. 43 pruebas frontend, tipos y build Docker
  aprobados; recorrido Chromium con backend/PostgreSQL reales, teclado, móvil 320/390 px
  y logout fallido/confirmado. Detalle en TASK-012/TDD-UX-H2; revisión manual pendiente.

- Landing de Profesor Butchery con propósito, CTA y carrusel 3D accesible de funcionalidades
  futuras; navegación contextual y formularios renovados, paleta centralizada y diseño responsive.
- Contraseñas nuevas de 8–128 caracteres en frontend/backend; HTTP local en Compose dev sin
  certificados, preservando HTTPS productivo, CSRF y confianza explícita del proxy. 277 pruebas
  backend y 38 frontend aprobadas, además de tipos/builds y recorrido Chromium con Mailpit.
  Detalle y validación manual pendiente en TASK-011/TDD-UX-H1.

- Instructivo Docker aclarado con comandos por entorno y significado de opciones/perfiles.
  Stack de desarrollo iniciado y recorrido de navegador comprobado, incluida recuperación
  mediante Mailpit. PostgreSQL local publicado en 55449 para evitar el rechazo de 5432 en Windows.

- Stack Docker completo con Compose separados para producción y desarrollo, builds por etapas
  NestJS/Next.js, migraciones Prisma como job y Nginx no root con HTTPS y gzip selectivo.
- Healthchecks, readiness con PostgreSQL, usuarios no root, init, límites de procesos/recursos,
  filesystems de solo lectura, capacidades eliminadas y apagado ordenado. Mailpit y generación
  TLS local exclusivos del entorno de desarrollo; producción exige SMTP TLS y certificados externos.
- Comandos y configuración por entorno en infra/OVERVIEW.md, README e índice; detalle por módulo
  y decisiones en TDD-DOCKER-H1. Validación manual del desarrollador pendiente en TASK-010.
- Validación Docker aislada con HTTPS, gzip, cookies/CSRF y recorrido registro/login/refresh/logout;
  250 pruebas backend con PostgreSQL/SMTP y 32 frontend aprobadas, además de tipos y builds.

- Etapa 4 de autenticación: recuperación por SMTP, restablecimiento y cambio de contraseña,
  con tokens opacos de uso único almacenados como hash y activados tras confirmar entrega.
- Actualización y revocación de todas las sesiones/refresh atómicas; comparación del hash
  vigente en login/cambio para impedir carreras con contraseñas anteriores. Migración aditiva.
- Buzón Mailpit local opcional, configuración TLS, respuestas anti-enumeración, CSRF y límites
  independientes. 233 pruebas aprobadas con PostgreSQL y SMTP reales; contratos y ejemplos en
  back/OVERVIEW.md y TDD-AUTH-H4. Validación del desarrollador pendiente en TASK-008.

- Etapa 3 de autenticación: refresh opaco con hash SHA-256, rotación atómica y logout de una
  sesión, con ambas credenciales exclusivamente en cookies HttpOnly.
- Sesión absoluta configurable de 7 días, reutilización reconocida que revoca la sesión y
  coordinación de refresh/logout mediante bloqueo PostgreSQL. Migración aditiva sin extender
  sesiones anteriores; 166 pruebas aprobadas, incluyendo HTTP, rollback y concurrencia real.
- Contratos, configuración, cookies y política de reutilización documentados en TDD-AUTH-H3
  y back/OVERVIEW.md. Validación manual del desarrollador pendiente en TASK-007.

- Etapa 2 de autenticación: login, sesión persistida, access JWT exclusivo en cookie HttpOnly,
  cuenta actual y guards de roles ADMIN/USER con autoridad en persistencia.
- Protección CSRF incluyendo login, CORS por origen explícito, HTTPS, no-store y límites de intentos.
- Migración de sesiones aditiva, configuración obligatoria y 119 pruebas aprobadas con PostgreSQL
  real, incluida regresión de etapa 1. Contratos y despliegue documentados en TDD-AUTH-H2 y
  back/OVERVIEW.md; validación manual del desarrollador pendiente en TASK-006.

- Etapa 1 de autenticación de Profesor Butchery: usuarios PostgreSQL/Prisma, registro público
  con rol USER fijo y provisión ADMIN explícita e idempotente, sin promoción accidental.
- Hash Argon2id, validación estricta, unicidad concurrente y errores seguros sin secretos.
- Migración aditiva, 40 pruebas backend aprobadas con PostgreSQL real y documentación técnica
  en TDD-AUTH-H1 y back/OVERVIEW.md. Validación manual del desarrollador pendiente en TASK-005.

- Monorepo npm con Node.js 22.22.3 y TypeScript 6.
- Backend NestJS con Prisma ORM, PostgreSQL, endpoint de salud y prueba automatizada.
- Frontend Next.js con App Router y pantalla inicial.
- PostgreSQL local mediante Docker Compose con volumen y healthcheck.
- Flujo SDD, tareas documentadas y reglas operativas en `AGENTS.md`.

### Seguridad

- Prisma usa el adapter JavaScript `pg` sin motor binario nativo.
- `deepmerge-ts` se fija en 8.0.2 mediante `overrides`.
