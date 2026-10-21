# TASK-022: Verificar el correo institucional antes de habilitar acceso

Estado: Finalizada — validación manual aprobada
Fecha: 2026-10-21
Rama: `feat/verificacion-correo-institucional`

## Objetivo

Como estudiante, registrarme con correo institucional y confirmar su propiedad antes de
acceder a la comunidad. El registro actual no envía correo ni impide iniciar sesión.
Dominio confirmado por el desarrollador: exclusivamente `alu.frlp.utn.edu.ar`.

## Alcance y autorización

Registro pendiente, entrega SMTP, confirmación, reenvío, bloqueo de login y sesiones de cuentas
sin verificar, migración de datos y pantallas de registro/verificación. La solicitud autoriza
modificar autenticación para este flujo, sin rediseñar layout global, hooks ni estilos base.
Reutilizar Prisma, nodemailer, generación criptográfica y seguridad HTTP existentes; sin
dependencias nuevas. No modificar README. Tras la aprobación manual se preparan commits locales
según el flujo acordado; push, PR y despliegue requieren su paso de aprobación correspondiente.
Las pruebas automatizadas usan SMTP/Mailpit y una base local/de pruebas. El desarrollador
autorizó posteriormente la comprobación con Gmail SMTP real desde el backend local, sin
modificar datos ni despliegues productivos.

## Decisiones técnicas y contratos

- `User.emailVerifiedAt` nullable es la fuente de verdad: null equivale a pendiente.
  Ningún USER anterior se considera verificado automáticamente. Conservar acceso de ADMIN
  provisionados explícitamente, que no se registran públicamente; documentar esa excepción.
- Verificación con credencial separada de recuperación: 32 bytes aleatorios base64url,
  solo SHA-256 persistido, vencimiento de 24 horas y uso único/transacción atómica.
  No aceptar tokens de recuperación para verificar. Nunca exponer hashes o tokens en JSON/logs.
- `POST /auth/register` mantiene forma pública del usuario y crea una cuenta pendiente;
  solo informa envío correcto si SMTP aceptó el mensaje. Si falla, conserva cuenta pendiente
  y permite reenvío, sin afirmar que llegó un correo. Sin cookies de sesión.
- `POST /auth/verify-email` recibe `{ token }`, éxito 204. Una repetición del mismo token
  consumido correctamente puede devolver 204 sin mutaciones para tolerar reintentos del cliente.
  Token inválido/vencido/revocado: 400 con mensaje seguro. No crea sesión automáticamente.
- `POST /auth/resend-verification` recibe `{ email }`, 202 con mensaje genérico sin enumerar
  cuentas. Rotar credenciales/invalidate las previas; no habilitar cuentas al reenviar.
  Limitar registro, verificación y reenvío por IP con la política de seguridad existente.
- El login solo emite sesión si el USER está verificado, con error 403 claro luego de validar
  contraseña. Auth/me y refresh tampoco deben permitir cuentas USER pendientes, incluyendo
  sesiones previas a la migración. Recuperar contraseña no equivale a verificar el correo.
- La URL de verificación usa el origen frontend de configuración local/productiva, nunca
  `Host` del request. Puede derivarse del origen de `AUTH_PASSWORD_RESET_URL`, ruta `/verify-email`.
  Query token solo se conserva en memoria; se elimina de la URL, `no-store`, `no-referrer`.
  Abrir el enlace confirma mediante POST; estado final y enlace al login; errores con reenvío.
- SMTP fuera de la transacción; fallos invalidan solo la credencial de ese intento y mantienen
  la cuenta bloqueada. Proteger concurrencia de reenvíos/confirmación con bloqueo de usuario.
- Pruebas existentes deben activar explícitamente las cuentas que se usan para probar login,
  sin debilitar la nueva restricción. No dar por equivalente envío a Mailpit y entrega real.

## Criterios de aceptación

1. Registro institucional crea USER pendiente y entrega enlace al buzón SMTP configurado.
2. Login previo a confirmar queda bloqueado y no emite cookies ni sesión utilizable.
3. Abrir enlace válido confirma la cuenta; luego login funciona.
4. Correos ajenos al dominio siguen rechazados; enlaces inválidos, vencidos y credenciales
   de otros flujos no habilitan cuentas. Reenvío recupera una entrega fallida/vencida.
5. Las cuentas USER existentes no obtienen confianza sin verificar y pueden solicitar enlace.
6. UI informa el paso pendiente y no promete envío exitoso cuando el proveedor falla.

## Validaciones requeridas

Casos unitarios registro/login/verificación y configuración; integración con PostgreSQL exclusivo
de pruebas y SMTP/Mailpit; concurrencia/replay, expiry, dominio, fallos de envío, sesiones
anteriores. Typecheck y suites de ambos workspaces, build, recorrido de navegador local:
registro → buzón → login bloqueado → enlace → login habilitado. Revisión manual del desarrollador
antes de actualizar CHANGELOG y mover a finished.

## Resultado y evidencia

Implementación validada y aprobada manualmente por el desarrollador el 2026-10-21,
incluido el flujo con correo real. Documentación y CHANGELOG actualizados para el cierre;
preparación de commits locales en la rama indicada, sin push ni despliegue.

- La migración `20261020000000_email_verification` agrega el estado pendiente y credenciales
  separadas. Aplicada en las bases locales de desarrollo y de pruebas.
- Dominio conservado y confirmado: `alu.frlp.utn.edu.ar`. Administradores provisionados
  explícitamente conservan acceso; no se verifican automáticamente estudiantes existentes.
- Registro entrega por SMTP; sin aceptación SMTP devuelve 503 y la cuenta sigue pendiente.
  Reenvío con respuesta genérica y mínimo temporal, y enlaces válidos por 24 horas.
- Pruebas backend: 439 aprobadas en 21 archivos, sin omisiones, usando PostgreSQL exclusivo
  de pruebas y SMTP/Mailpit. Incluyen registro pendiente, rechazo de login sin cookies,
  verificación concurrente, replay idempotente, vencimiento, rotación, fallo de entrega y
  recuperación por reenvío, y bloqueo de sesiones/refresh de estudiantes anteriores pendientes.
  Después se añadió el caso de reenvíos concurrentes: pasó la suite específica de 4 casos,
  que valida que queda exactamente una credencial vigente (440 casos backend en total).
- Pruebas frontend: 78 aprobadas en 5 archivos. Typecheck de ambos workspaces aprobado.
- `npm run build`: backend y frontend aprobados, incluyendo `/verify-email` y
  `/resend-verification`.
- Recorrido manual real en navegador local: registro institucional ficticio, aviso pendiente,
  login bloqueado, mensaje recibido en Mailpit, apertura del enlace, token retirado de URL,
  confirmación exitosa, login habilitado con acceso a `/home`, y cierre de sesión al terminar.
  Evidencia local no versionada: `.atl/verificacion-correo-confirmada.png`.
- Playwright: los 11 casos quedaron validados. Se instaló Chromium requerido por el proyecto
  y se compiló frontend con `NEXT_PUBLIC_API_URL=http://localhost:3301` exclusivamente para
  la API/base de pruebas. Última corrida completa: 10/11; el restante pasó en una repetición
  dirigida tras precisar el selector de alerta para distinguirlo del anunciador de rutas Next.
  También se corrigió un contador previo para medir renovaciones de la acción bajo prueba,
  sin contar las renovaciones legítimas de navegación. No hubo cambios adicionales de producto.
  Registro por formulario → Mailpit → confirmación → login pasó en las corridas completas.
- Build productivo inspeccionado temporalmente en localhost:3400: `/verify-email` responde
  con `Cache-Control: no-store` y `Referrer-Policy: no-referrer`. Servidor temporal detenido.
- El desarrollador confirmó que el comportamiento local es el esperado. Luego autorizó
  configurar SMTP Gmail real en `.env` privado mediante contraseña de aplicación.
  Autenticación SMTP aceptada; backend reiniciado. Un reenvío solicitado a la cuenta
  institucional indicada devolvió 202 y persistió `deliveredAt` sin invalidación después
  de aceptación de Gmail SMTP. El desarrollador confirmó el flujo real el 2026-10-21;
  no se incluyen credenciales en esta evidencia ni se modificó producción.
- Frontend y proxy excluyen las rutas nuevas de compresión; frontend usa `no-store` y
  `no-referrer`. README y dependencias sin modificaciones.

En producción también debe configurarse SMTP real y desplegarse esta rama/migración para
entregar correos institucionales reales. Mailpit captura mensajes locales; no demuestra entrega
a una casilla externa ni se modifica producción en esta tarea.
