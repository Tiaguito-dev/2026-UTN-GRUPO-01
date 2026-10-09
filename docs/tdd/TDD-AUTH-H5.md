# TDD-AUTH-H5: Cliente de cuenta y coordinación de cookies

Estado: Diseño autorizado por la tarea; implementación en curso
Fecha: 2026-10-08

## Base y contratos

Next.js App Router y React ya elegidos, sin biblioteca UI previa. Se agregan servicios/tipos/
La auditoría previa identifica parches pendientes en Next.js, sharp y source-map-js. H5 corrige
esas versiones dentro de las herramientas elegidas, sin migrar framework ni cambiar ORM.
validaciones/hooks/componentes de autenticación y rutas /login, /register, /forgot-password,
/reset-password, /account. Homepage conserva alcance simple y enlaza cuenta. La composición
del provider necesita layout; estilos usan tokens para #1240C9, #1E4CD4, #2169FC y semánticos.
CSRF: navegador emite Origin; cliente credentials:include y X-CSRF-Protection:1 en métodos
inseguros. NEXT_PUBLIC_API_URL origen explícito HTTP loopback local/HTTPS producción.
AuthProvider distingue checking/authenticated/anonymous/temporary-error y mantiene PublicUser.
No leer cookies HttpOnly ni guardar credenciales o contraseñas en storage. No SSR de secretos.

## Renovación y sincronización

Web Locks serializa operaciones que mutan cookies entre pestañas del mismo origen: refresh,
login, logout, reset y change. BroadcastChannel notifica cambios; localStorage mantiene solo
un marcador aleatorio de revisión/evento, sin cuenta, tokens ni claves. Una pestaña toma el
lock y relee marcador, además consulta /me antes de renovar: si otra ya renovó, no repite refresh.
Dentro de una pestaña se comparte una Promise. Las notificaciones no transportan credenciales.
Una notificación de revocación limpia cuenta; cambios de login/refresh consultan me sin provocar
recursión. Leer revisión antes de petición para evitar invalidar una sesión nueva tras un 401 viejo.

Web Locks requiere contexto seguro; localhost es válido para desarrollo. Si Locks o storage
coordinado no están disponibles, no ejecutar refresh automático ni reintentar: mostrar límite
de compatibilidad y pedir login explícito. No usar timeout de lease en localStorage ni tolerar
reutilización del backend. Navegadores soportados para flujo completo: Web Locks, storage y
comunicación entre pestañas disponibles; probar motor Chromium real y documentar esa cobertura.
No coordina dispositivos/perfiles distintos (sus cookies y sesiones son independientes).

Cliente central limita recuperación automática a GET protegidos y change-password (401 emitido
por guard antes de mutación). Nunca a login/register/refresh/forgot/reset/logout, ni a 403,
errores red/5xx. Cada petición puede renovar/reintentar una sola vez con body JSON reproducible;
sin reintentar operaciones ambiguas. Refresh401 => anonymous; error red/500/429 => temporal,
preserva cuenta y permite reintento manual. Logout técnico no afirma revocación ni borra cuenta.

## Pantallas, permisos y recuperación

Inputs estrictos y validación igual a backend (email ASCII normalizado trim/lower; contraseña
Unicode 15–128, nunca recortada). Autocomplete, labels visibles, feedback por campo y foco,
disabled/submitting para evitar duplicados. Registro lleva al login por instrucción explícita.
Reset/change limpian estado y piden login; forgot conserva mensaje genérico del backend.
RequireAuth diferencia checking/anonymous/403 conceptual/error temporal; roles ADMIN/USER
son navegación, backend conserva autoridad. No ruta administrativa ficticia en producto.
Retorno solo paths internos allowlisted/sin //, backslash ni caracteres de control.

Reset token se extrae una sola vez en componente cliente y se quita con history.replaceState;
permanece en memoria hasta envío/salida, sin UI/logging. Recarga requiere reabrir enlace.
Referrer-Policy:no-referrer en rutas; sin recursos de terceros/analítica. Evitar logger de acceso
Next del enlace: redactar/eliminar query antes de que el framework registre rutas en desarrollo,
o usar servidor compilado sin logs de request. Proxy de despliegue debe excluir/redactar query.

## Verificación y herramientas

Playwright dev dependency y harness de tests en front/tests. Levantar backend real Nest con
Prisma/PostgreSQL y Mailpit; controlador administrativo exclusivamente en harness. Expirar
access manipulando cookies de test con JWT vencido firmado usando clave efímera de tests,
sin bajar mínimos de configuración productiva. Pruebas con varias pestañas/cookies compartidas,
dos browser contexts independientes para revocación global por cambio, fallos interceptados
solo donde se comprueba estado temporal. Suite también verifica rutas, storage, CSRF/CORS,
token limpiado de URL, screenshot móvil/desktop, contrastes y ausencia de secretos en logs.
Ejecutar primero H4 completa; luego build/types/tests y E2E. SMTP comprobado es buzón local,
no garantía de entrega de proveedor de producción.
