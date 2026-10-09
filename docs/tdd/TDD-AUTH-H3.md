# TDD-AUTH-H3: Rotación atómica y revocación

Estado: Implementado y verificado; pendiente de validación manual del desarrollador
Fecha: 2026-10-08

## Sesión y credenciales

Access TTL conserva 900 segundos iniciales. AUTH_SESSION_TTL_SECONDS define plazo absoluto,
inicial 604800 (7 días), rango 60–2592000 y al menos access TTL. No se cambia ni extiende la
fecha de ninguna sesión preexistente. Migración solo agrega RefreshCredential y relaciones.
Refresh: UUID, sessionId FK, tokenHash SHA-256 hex UNIQUE, createdAt, expiresAt, consumedAt,
invalidatedAt nullable. Registros consumidos se conservan; sin proceso de limpieza.
No hace falta FK a reemplazo: trazabilidad temporal por sesión y estado, un activo por rotación.
Token opaco: randomBytes(32), base64url canónico; persistir únicamente SHA-256. La entropía
de 256 bits permite hash rápido criptográfico sin política de contraseñas ni secreto de respaldo.
Puerto RefreshTokenService genera/digiere; adaptador usa crypto estándar de Node.

## Atomicidad y concurrencia

RefreshCredentialRepository es puerto específico del agregado sesión/credenciales:
createSession(session,credential), findByHash(hash), rotate(hash,now,prepareReplacement),
revokeSession(sessionId,now,expectedUserId opcional). SessionRepository agrega findById para
logout; se conserva findValidById para guard. No se expone Prisma/transaction al caso de uso.

createSession persiste sesión y credencial inicial en la misma transacción, después de firma y
generación. Falla técnica hace rollback. rotate localiza hash, bloquea fila Session FOR UPDATE,
vuelve a leer estado y decide; logout usa exactamente ese mismo bloqueo y orden.
Con sesión activa y credencial consumida, revoca Session e invalida credenciales activas y
retorna reused para confirmar la transacción antes de devolver 401. Hash desconocido no revoca.
Con credencial activa consulta el usuario público en esa misma transacción e invoca
prepareReplacement(session,user): el caso de uso comprueba asociación, genera refresh y firma
access; el callback retorna solo la credencial con hash, nunca secretos. No consulta otro cliente
mientras mantiene el lock: así no necesita una segunda conexión ni bloquea un pool pequeño.
Luego consume la vieja e inserta la nueva en la misma transacción. Firma/generación/persistencia
fallidas revierten todo, conservando la credencial anterior. El callback recibe solo dominio,
no ORM; resultados HTTP quedan en la aplicación y solo se entregan tras commit.

Se usa aislamiento ReadCommitted y bloqueo por fila para serializar las operaciones de una
sesión entre procesos. No se usan locks en memoria. FK e índice único respaldan integridad.
El repositorio revalida sesión/estados/fechas bajo lock, incluyendo vencimiento antes del commit.
Referencias: [PostgreSQL locks](https://www.postgresql.org/docs/17/explicit-locking.html),
[Prisma transactions](https://www.prisma.io/docs/orm/fundamentals/transactions).

## Casos de uso y JWT

Login verifica como etapa 2 y crea sesión hasta plazo absoluto con credencial refresh igual
plazo; firma JWT hasta min(iat+accessTTL,session.expiresAt) y persiste agregado atómicamente.
RefreshSession recibe valor opaco (sin HTTP), lo digiere y usa rotate; el callback comprueba
usuario y prepara ambas credenciales. Refresh no prolonga Session.expiresAt. JWT acepta
duración positiva hasta accessTTL para permitir truncar al límite absoluto. Guard verifica
firma/vencimiento y exige exp<=Session.expiresAt e iat>=Session.createdAt; deja de exigir
igualdad, conservando pertenencia, revocación y rol vigente de DB, sin caché.

Logout recibe access/refresh opcionales. Access usa verificación normal completa; no se agrega
excepción para JWT expirados ni se leen claims sin firma. Si no identifica sesión por access,
busca refresh reconocido (incluso consumido/vencido) y revoca esa sesión. Sin credencial
reconocible es no-op; fallos técnicos propagan. Ambas cookies se limpian desde HTTP con 204.
No hay logout global. Token expirado con refresh reconocido permite cerrar sesión.

## HTTP, cookies y errores

POST /auth/refresh: 200 cuenta pública y ambas cookies rotadas, 401 credencial no válida
(limpia ambas), 403 CSRF, 429 límite, 500 técnico seguro (sin limpiar cookies válidas).
POST /auth/logout: 204 y ambas cookies expiran aun si no existía sesión; 403 CSRF sigue obligatorio.
Refresh y logout no requieren access vigente. Login JSON solo datos públicos.
Cookie access conserva nombre/path y seguridad. Refresh: butchery_refresh local o
__Secure-butchery_refresh HTTPS, host-only (sin Domain), Path=/auth, HttpOnly, Secure en HTTPS,
SameSite de etapa 2. __Host no puede usarse con Path=/auth. Limpieza mismos atributos,
Expires epoch/Max-Age=0. Todo /auth no-store. Se conserva Origin+X-CSRF-Protection:1 en todos
los métodos inseguros y allowlist CORS, sin relajaciones de TLS/proxy.
AUTH_REFRESH_MAX_ATTEMPTS/AUTH_REFRESH_WINDOW_SECONDS iniciales 30/900; store/IP/proxy igual
al limitador de login. El store sigue por proceso; multi-réplica exige store compartido/gateway.

## Política de reutilización y frontera

Dos refresh concurrentes no generan dos reemplazos válidos: el segundo reconoce consumo,
revoca sesión e invalida reemplazo, aunque el primero haya recibido 200. Frontend futuro debe
coordinar una única renovación entre requests y pestañas; sin tolerancias ni ventanas implícitas.
Refresh/logout serializados no pueden reactivar sesión ni insertar refresh utilizable luego de
revocación. El guard rechazará el siguiente acceso después del commit de revocación.
No limpieza automática, recuperación/cambio de contraseña, frontend ni logout de dispositivos.
