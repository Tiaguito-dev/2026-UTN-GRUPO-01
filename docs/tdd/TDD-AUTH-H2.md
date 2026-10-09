# TDD-AUTH-H2: Access JWT y sesión persistida

Estado: Implementado por solicitud del desarrollador; validación manual del equipo pendiente
Fecha: 2026-10-08

## Arquitectura y consistencia

Se conserva el monolito modular NestJS/PostgreSQL/Prisma y los puertos de etapa 1.
Auth agrega SessionRepository (create/findValidById), AccessTokenService (issue/verify), Login
y AuthenticateRequest, todos en TypeScript sin NestJS/ORM. UserRepository agrega findById.
findById obtiene únicamente datos públicos con select Prisma; la autenticación de peticiones
no necesita cargar passwordHash. findByEmail conserva el hash para registro/login/provisión.
Sesión: UUID, userId FK, createdAt, expiresAt, revokedAt nullable, índice userId/fecha.
No hay endpoint de revocación ni refresh. El rol se consulta desde User en cada petición.

Login valida email/password estrictos, normaliza con etapa 1 y verifica Argon2 incluso si no
existe usuario: hash señuelo aleatorio generado al componer providers con mismos parámetros.
La regla 15–128 aplica al alta; login acepta 1–128 puntos Unicode sin trim para que contraseñas
cortas incorrectas reciban el mismo 401. Vacío, tipos incorrectos o exceso de longitud reciben 400.
Prepara la entidad Session y firma antes de persistir: si firma falla, no hay sesión; si DB falla,
el token no se entrega. Este orden evita depender de compensaciones que también podrían fallar.
UUID y reloj inyectables; createdAt/exp usan segundos enteros, la misma expiración en DB/JWT.

## JWT y configuración

Biblioteca mantenida jose (ESM, compatible con stack) para HS256 explícito y tipo JWT.
AUTH_JWT_SECRET: secreto aleatorio base64url de al menos 32 bytes sin fallback.
AUTH_JWT_ISSUER/AUTH_JWT_AUDIENCE requeridos. AUTH_ACCESS_TTL_SECONDS por defecto 900;
validar rango acotado 60–3600. Validar firma, algoritmo, typ, iss, aud, iat/exp enteros,
UUID sub/sessionId, duración y ausencia de claims inesperados. Sin role en el JWT.
Config inválida impide inicio HTTP; CLI de provisión permanece independiente de JWT/HTTP.

## Transporte y CSRF

AUTH_ALLOWED_ORIGINS: lista exacta de orígenes, sin comodines, paths, credenciales ni null.
AUTH_PUBLIC_URL: origen HTTPS público de API. Cookie host-only, Path=/, HttpOnly, Secure;
SameSite=None para Vercel/Render (sitios distintos), Lax configurable para same-site/local.
Sin Domain. AUTH_ALLOW_LOCAL_HTTP=true solo con NODE_ENV=development y orígenes loopback HTTP.
Cookie butchery_access en local, __Host-butchery_access con Secure en HTTPS. Max-Age/Expires
coinciden con JWT. Token exclusivamente cookie; JSON solo datos públicos; /me omite createdAt.
Cache-Control:no-store para todo /auth, incluidos errores y rechazos previos al controlador.

CSRF: para toda operación HTTP insegura exigir Origin exacto permitido y cabecera personalizada
X-CSRF-Protection:1. Login incluido. JSON requerido para login/registro. La cabecera provoca
preflight; CORS solo permite orígenes configurados, credentials:true y cabeceras explícitas.
No aceptar Origin ausente/null, formularios simples ni fallback por Referer. No hace falta
endpoint/token CSRF: el origen y la cabecera se controlan en servidor; SameSite es defensa extra.
Los clientes CLI también envían Origin y cabecera. No habilitar comodines para resolver CORS.

## Login y proxy

express-rate-limit como adaptador mantenido de limitación HTTP, sin mecanismo previo existente.
AUTH_LOGIN_MAX_ATTEMPTS y AUTH_LOGIN_WINDOW_SECONDS configurables, inicialmente 10/900.
Cuenta todos los intentos por IP normalizada, incluso éxito, y devuelve 429 seguro/Retry-After.
Por defecto trust proxy=false y se ignora X-Forwarded-For. AUTH_TRUSTED_PROXIES permite solo
IP/CIDR explícitos de proxies controlados (sin true ni número de saltos). TLS se obtiene de la
conexión o de req.secure únicamente tras confiar en esos proxies configurados.
Store inicial en memoria por proceso para el Render único actual: al escalar a varios procesos
se debe usar store compartido o limitar en gateway; no afirmar un límite global entre réplicas.

## Verificación y siguientes etapas

Pruebas de puertos/casos de uso, JWT manipulado/vencido/claims, configuración y guard HTTP
con sesiones reales, roles consultados en DB, protección CSRF y rate limit. Reusar Vitest.
Controlador administrativo exclusivo en tests. DB aislada y limpieza limitada a IDs creados.
No refresh ni logout: vencida la sesión, el usuario vuelve a iniciar sesión.
