# TASK-006: Login, sesiones y autorización

Estado: Terminada; validación manual confirmada por el desarrollador el 2026-10-09
Fecha: 2026-10-08
Diseño: [TDD-AUTH-H2](../../tdd/TDD-AUTH-H2.md)

## Alcance y aceptación

Etapa 2 solicitada: sesión PostgreSQL, Login, JWT, cookie HttpOnly, CSRF y CORS explícitos,
GET /auth/me, guards de autenticación/roles, limitación de login y pruebas reales HTTP/Prisma.
Reutilizar User, Argon2id, normalización y puertos de etapa 1. Solo ADMIN/USER.
Migración aditiva. Validar configuración al iniciar. Ningún secreto en respuesta JSON o logs.
Login rechazado/emisión fallida no dejan sesiones utilizables. Sesión y JWT vencen juntos.
Autorización se prueba con controlador de tests, sin endpoints administrativos ficticios.

## Exclusiones y restricciones

Sin frontend, refresh, rotación, logout, recuperación/cambio de contraseña ni gestión académica.
Cambios de auth, composición y bootstrap HTTP autorizados explícitamente por esta tarea.
Sin commits, push ni PR automáticos. Conservar cambios preexistentes y usar DB de pruebas aislada.

## Validación

Build, tipos, pruebas unitarias/JWT y HTTP+PostgreSQL de login, cookie, me, roles, sesiones,
CSRF, rate limiting y regresiones del registro. Lint solo si existe configuración.
Documentar comandos, variables, contratos, resultados y limitaciones de despliegue.

## Implementación y decisiones

- Sesiones PostgreSQL y migración aditiva 20261008010000_auth_sessions con FK/índice.
- Login usa email normalizado y Argon2id, verifica hash señuelo para usuario desconocido.
- Firma antes de persistir evita sesión huérfana ante falla de emisión; fechas DB/JWT iguales.
- Puertos específicos SessionRepository y AccessTokenService; jose HS256 con claims estrictos.
- JWT solo en cookie HttpOnly host-only, Secure en HTTPS, sin token/hash en JSON ni logs.
- Middleware previo al parser: no-store, HTTPS, CSRF en métodos inseguros, CORS exacto y límites.
- AuthenticationGuard delega a AuthenticateRequest; rol vigente y proyección sin hash obtenidos
  de persistencia. RolesGuard/decorador Roles, sin endpoints administrativos ficticios.
- Configuración validada impide iniciar HTTP sin claves/orígenes; provisión ADMIN sigue independiente.
- Política y ejemplos cookie jar fuera del repositorio documentados en back/OVERVIEW.md.

## Evidencia de validación

Entorno: Windows, Node 22.17.0, npm 10.9.2 y PostgreSQL 17 en contenedor efímero exclusivamente
de pruebas. El repositorio fija Node 22.22.3: queda repetir la certificación en esa versión.

| Control | Resultado |
|---|---|
| npm run build --workspace=back | Aprobado, Prisma generado y Nest compilado |
| npm run typecheck --workspace=back | Aprobado, producción y tests |
| npm test --workspace=back con TEST_DATABASE_URL | 119/119 aprobadas, 7 archivos, ninguna omitida |
| db:deploy en DB aislada | Migraciones H1/H2 aplicadas; repetición sin pendientes |
| prisma validate | Esquema válido |
| Servidor compilado real | Registro 201, login 200/cookie privada, me 200, acceso anónimo 401, CSRF 403 |
| Bootstrap compilado sin clave | No inicia, salida 1 y error seguro |
| CLI compilado de etapa 1 | ADMIN repetible sin necesitar claves JWT; sin regresión |
| Logs del smoke compilado | Sin contraseña/cookie/clave configurada |
| git diff --check | Sin errores de whitespace |
| Lint | No ejecutado: no hay configuración/comando en este repositorio |

Cobertura significativa: credenciales válidas/incorrectas/desconocidas, normalización, hash señuelo,
sesiones inexistentes/revocadas/vencidas/de otro usuario, token adulterado/vencido/emisor/audiencia/
algoritmo/claims incorrectos, rol vigente ADMIN/USER (y cambios posteriores), cookie HTTPS detrás de
proxy explícito, CSRF/CORS, 429 ignorando X-Forwarded-For no confiable, fallos de firma/persistencia
y regresión completa de etapa 1. Falla de firma también probada vía HTTP con DB real: 500 seguro,
sin cookie y cero sesiones creadas. Las suites borran exclusivamente cuentas/sesiones propias.
No se aplicaron migraciones a desarrollo/producción, no se usaron credenciales reales ni se alteraron
archivos ajenos preexistentes (.github y TASK-002 CI).

## Pendientes y entrega

No hay bloqueos de implementación. Validación manual del desarrollador pendiente para mover la
tarea a finished conforme docs/tasks/OVERVIEW.md. Recursos efímeros de prueba limpiados al terminar.
No se verificó despliegue cloud ni navegador de producción: cookies cross-site dependen de sus
políticas; mantener HTTPS y usar un sitio común si el navegador bloquea cookies de terceros.
El store de límites es por proceso: para varias réplicas requiere store compartido o gateway.
Antes de desplegar definir IP/CIDR de proxies controlados y valores exactos de origen/emisor/audiencia.
No hay renovación ni logout: la sesión vencida requiere un nuevo login. Refresh, rotación,
recuperación/cambio de contraseña, frontend y gestión académica quedan fuera de esta etapa.
Sin commit, push ni PR ejecutados.

Mensaje sugerido: `feat(auth): agregar login con sesiones JWT y autorización por roles`

## Cierre vigente

El desarrollador confirmó que los cambios realizados quedaron comprobados el 2026-10-09.
Esta aprobación cierra la validación manual indicada como pendiente en la evidencia histórica
de esta tarea. Los controles anteriores conservan sus resultados y límites: no se afirma
una nueva ejecución de la matriz automatizada completa de navegador ni entrega SMTP real.
La configuración y navegación vigentes se describen en README y los OVERVIEW de cada módulo.
