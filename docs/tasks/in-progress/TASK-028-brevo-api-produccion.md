# TASK-028: Enviar correo por Brevo HTTPS en producción gratuita

Estado: En progreso
Fecha: 2026-10-22
Rama: fix/brevo-api-produccion

## Objetivo

El desarrollador solicita que la verificación de correo funcione en producción. Render Free
bloquea SMTP 25/465/587; el envío local por Brevo SMTP funciona pero no acredita producción.
Se autoriza el cambio puntual de adaptadores de email y su configuración de autenticación.

## Diseño y alcance

- EMAIL_PROVIDER=smtp (por defecto, compatible) o brevo. SMTP/Mailpit permanece disponible.
- En modo brevo no validar ni requerir SMTP_HOST/PORT/USERNAME/PASSWORD/SECURE.
- Usar BREVO_API_KEY privada, EMAIL_FROM (dirección verificada) y EMAIL_FROM_NAME
  (Profesor Butchery por defecto). Mantener SMTP_TIMEOUT_MS como deadline compartido y la
  relación existente con AUTH_PASSWORD_RESET_MIN_RESPONSE_MS para no cambiar contratos.
- POST HTTPS fijo https://api.brevo.com/v3/smtp/email mediante fetch de Node22, api-key,
  sender, to, subject y textContent. Sin dependencias adicionales, redirecciones ni reintentos.
- Reutilizar dominios VerificationEmail/PasswordResetEmail. Conservar tokens, vencimientos,
  rutas, dominio institucional y respuestas públicas. Timeout, error HTTP o respuesta sin
  messageId producen error genérico sin contenido/credenciales del proveedor.
- AbortController/deadline para solicitud y lectura de respuesta. No fallback silencioso.
- Validar configuración seleccionada al arrancar y en DI. Enviar verificación y recuperación
  por el mismo proveedor. Nombre visible del proyecto en Brevo.
- Actualizar .env.example, render.yaml, back/OVERVIEW e infra/DESPLIEGUE-CLOUD (no README).
- Sin migraciones, UI ni dependencias nuevas. No cambiar producción sin acceso/configuración.

## TDD y aceptación

Tests antes de producción: configuración Brevo sin SMTP, SMTP por defecto compatible,
proveedor inválido/clave ausente rechazados, cuerpo y enlaces correctos para ambos emails,
201 con messageId aceptado, errores/timeout/redirección/respuesta inválida rechazados sin
filtrar secretos. Luego suites auth relevantes, typecheck y build backend.

Para habilitar producción: clave API real distinta de SMTP; configurar variables en Render,
URLs HTTPS públicas y timeout mínimo coherente; deploy de rama aprobada según flujo Git;
registrar usuario pendiente, recibir enlace real, verificar y habilitar login. No dar por
completado el despliegue con solo un envío local. Clave API local disponible; acceso a Render
y configuración productiva pendientes del encargado.

## Fuentes

- https://render.com/docs/free
- https://developers.brevo.com/docs/send-a-transactional-email

## Resultado

Implementados selector de proveedor, adaptadores HTTPS para ambos correos, validación de
arranque y DI, ejemplos y guía de despliegue. TDD RED capturado antes de implementación
(módulos nuevos aún ausentes); build backend y typecheck aprobados con Node22.22.3.

Acceso comprobado al dashboard Render: requiere inicio de sesión. El desarrollador aclara
que no administra esa cuenta; deberá intervenir su responsable. BREVO_API_KEY ya fue
guardada por el desarrollador en el entorno privado local. Prueba HTTPS real aceptada
por Brevo con HTTP201/messageId, nombre Profesor Butchery y el correo institucional que
el desarrollador había autorizado para pruebas. Recepción de esta nueva prueba pendiente
de confirmar; envío desde local, no desde Render. No se modificó producción.
La cuenta institucional local usada anteriormente ya está verificada: no desverificarla para
forzar pruebas. Para E2E usar una cuenta pendiente autorizada por el desarrollador.

Configuración local SMTP conservada; corregida su respuesta mínima a 15500 ms para respetar
el timeout de 15000 ms existente. No se publicaron secretos, no se tocó README ni base real.
Suite de siete archivos: 169 pruebas aprobadas (configuración, adaptadores, wiring real de
Nest y regresiones unitarias de autenticación). Typecheck backend (aplicación y pruebas),
build y git diff --check aprobados. Tests automatizados con fetch simulado y sin base real.
Pendientes acceso/configuración Render por su administrador, integración mediante el flujo
Git y verificación de recepción/activación en producción. Tarea sin cerrar, sin merge.

El 2026-10-25 el desarrollador solicita commit local para compartir posteriormente la rama
con el encargado de Render. HU-11 resguardada en stash independiente antes de recuperar
Brevo. No hay autorización nueva de push/PR/merge en esta solicitud.

## Integración con desarrollo (2026-10-25)

El desarrollador solicita incorporar los últimos cambios manteniendo el trabajo previo.
Se integra origin/desarrollo (3aa55b8) en la rama de Brevo, conservando los dos commits
publicados. El único conflicto textual es CHANGELOG: se conservan ambas entradas.
El blueprint conserva tanto las migraciones de arranque nuevas como el proveedor Brevo.
Sin aplicar migraciones a bases locales o productivas en esta actualización: el nuevo modelo
académico requiere revisión de datos antes de poner al día la base de trabajo.
HU-11 queda intacta en su stash; debe adaptarse al nuevo modelo y primitivas antes de aplicarse.
Se sincronizan dependencias y cliente Prisma generado y se verifica tipos, tests de Brevo y lint.
El lint nuevo detectó no-control-regex en la validación deliberada de caracteres de control
de email.config. Se documenta una excepción de línea con motivo, siguiendo exactamente
el patrón ya aplicado en auth.config y smtp.config; se conserva la validación de seguridad.
Validación de integración: 169 pruebas aprobadas, typechecks backend/frontend y lint backend
aprobados. Se regeneraron tipos locales de Next que referían a rutas de HU-11 resguardadas.
Las advertencias de espacios en tres archivos entrantes de desarrollo se conservan sin
limpieza ajena al alcance; la diferencia propia respecto de origin/desarrollo pasa diff-check.
