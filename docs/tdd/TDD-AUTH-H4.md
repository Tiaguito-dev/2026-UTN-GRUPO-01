# TDD-AUTH-H4: Recuperación y mutación atómica de contraseña

Estado: Implementado y verificado; pendiente de validación manual del desarrollador
Fecha: 2026-10-08

## Persistencia y control de concurrencia

PasswordResetCredential agrega UUID, userId FK, tokenHash SHA-256 UNIQUE, createdAt,
expiresAt, consumedAt, invalidatedAt y deliveredAt. Migración aditiva posterior a H3. Tokens de 32 bytes
aleatorios; reutilizar CryptoRefreshTokenService mediante el mismo puerto criptográfico,
sin guardar originales. Plazo inicial 1800 segundos, configurable.

PasswordRecoveryRepository: issue(credential), markDelivered(credentialId,now), invalidate(credentialId,now), findByHash(hash),
reset(hash,newPasswordHash,now), findPasswordByUserId(userId),
change(userId,expectedPasswordHash,newPasswordHash,now). Métodos específicos y resultados
de estado; no exponer transacciones. issue invalida anteriores bajo lock del usuario.
Credencial pendiente de entrega (deliveredAt=null) no puede restablecer contraseña. Solo se
activa tras envío confirmado, bajo lock y si no fue invalidada por otra solicitud/cambio.
Así un fallo SMTP seguido de un fallo DB al invalidar tampoco deja un token utilizable.
invalidate actúa exclusivamente sobre la credencial cuya entrega falló, nunca sobre tokens
posteriores. reset bloquea usuario y relee credencial/fechas/estado; change compara el hash
verificado con el vigente después del lock. Ambos actualizan contraseña, invalidan recuperación
y revocan todas las sesiones/refresh en una transacción. Hashing se completa antes del lock.

Orden: User FOR UPDATE y luego Session FOR UPDATE ordenadas por id, para cambios/reset y login.
createSession exige expectedPasswordHash y lo compara bajo lock User antes de crear agregado;
si cambió, login devuelve credenciales inválidas y no persiste sesiones. Refresh/logout conservan
su lock Session; refresh solo lee usuario, sin lock User, y no puede bloquear en orden inverso.
Revocación bloquea sesiones antes de invalidar refresh, por lo que incluye reemplazos creados
concurrentemente. Refresh que llega después de revocar falla; ninguno reactiva sesiones.
No hashing ni llamadas SMTP dentro de transacciones. Reset no sobrescribe change: su token
queda invalidado bajo el mismo lock del usuario. Dos resets/cambios no pueden actualizar dos veces.

## Casos de uso y validación

Validación de email reutilizada; extracción de política de contraseña compartida (15–128
caracteres Unicode, sin recorte/normalización). Inputs estrictos rechazan campos adicionales.
RequestPasswordReset genera/digiere con independencia de existencia, consulta y emite para
cuenta existente, envía fuera de transacción. Fallos internos se registran con código fijo
sin email, excepciones, enlaces o tokens y mantienen 202. Invalidación precisa tras fallo SMTP.
Padding temporal para todos los emails válidos y envío con deadline acotado; documentar que
latencia de DB/proveedor puede exceder el piso y no constituye tiempo constante garantizado.
Reset valida entrada antes de hash y hace commit atómico; token no válido equivale a 400.
Change recibe userId del contexto, verifica actual y rechazo de contraseña idéntica, hashea
fuera de transacción y aplica comparación optimista del hash dentro de change.

## Email y configuración

Puerto PasswordResetEmail.send({email,token,expiresAt}); adaptador SMTP Nodemailer,
dependencia necesaria porque no existe mecanismo email previo. Enlace construido desde
AUTH_PASSWORD_RESET_URL explícita, HTTPS (HTTP solo local autorizado), sin host de request.
SMTP host, port, from, TLS y credenciales validados al arrancar. Sin fallback inseguro;
SMTP sin TLS solo en desarrollo explícito con host loopback. Sin logger/debug SMTP.
Buzón Mailpit optativo en Docker Compose, puertos ligados a loopback; pruebas pueden sustituir
puerto por buzón inspeccionable y deben verificar también SMTP real.
Referencia: [Nodemailer SMTP](https://nodemailer.com/smtp).

## Contratos HTTP y seguridad

forgot-password: email; 202 mensaje uniforme solicitado, 400 input, 403 CSRF, 429 límite.
reset-password: token,newPassword; 204 éxito limpiando ambas cookies, 400 input/token,
403 CSRF,429 límite,500 técnico seguro sin cambios parciales.
change-password: currentPassword,newPassword; autenticación obligatoria,204+limpieza,
400 input/actual incorrecta/igual/conflicto concurrente,401 auth,403 CSRF,429 límite,500 técnico.
No login automático. CSRF, no-store, CORS explícito, HTTPS y proxy/IP se conservan.
Límites independientes configurables para los tres endpoints; mismo store por proceso H2/H3.

Frontend futuro: página sin analítica/terceros, Referrer-Policy: no-referrer; retirar token de
URL cuanto antes, evitar logs/telemetría del enlace, no renovar tras cambio sino pedir login.
No se implementa esa pantalla en esta etapa.
