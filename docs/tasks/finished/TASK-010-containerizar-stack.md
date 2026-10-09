# TASK-010: Contenerización del stack

La configuración de desarrollo fue actualizada posteriormente a HTTP local sin certificados
en [TASK-011](./TASK-011-ux-landing-http-local.md). Los resultados TLS siguientes son históricos.

Estado: Terminada; validación manual confirmada por el desarrollador el 2026-10-09
Fecha: 2026-10-09
Diseño: [TDD-DOCKER-H1](../../tdd/TDD-DOCKER-H1.md)

Containerizar NestJS/Next.js con npm workspaces, PostgreSQL y buzón local. Multi-stage,
usuarios no root, healthchecks, init, límites de procesos/recursos, parada ordenada,
contexto sin secretos y TLS local sin relajar autenticación. Migraciones explícitas como
servicio de una ejecución. No borrar volúmenes existentes ni desplegar a servicios externos.
Validar Compose, construir imágenes, levantar proyecto aislado y comprobar recorrido HTTP
y configuración efectiva. Documentar ejecución y limitaciones; sin commits/push/PR.

Ampliación solicitada: separar `docker-compose.yml` productivo y `docker-compose.dev.yml`
de desarrollo, con configuración y datos aislados. Actualizar README, índice, documentación
backend/frontend e infraestructura con comandos explícitos por entorno.

## Resultado y evidencia

Implementación completada el 2026-10-09; pendiente aprobación manual del desarrollador.

- Ambos Compose validados: desarrollo contiene Mailpit/TLS local y producción los excluye,
  fija SMTP TLS/production y PostgreSQL interno. Producción rechaza configuración requerida ausente.
- Imágenes construidas por Docker con Node 22.22.3; migraciones aditivas aplicadas en base aislada.
  Proyecto de prueba `butchery-docker-check`, distinto de los volúmenes del desarrollador.
- Stack de desarrollo con todos los servicios persistentes saludables y migraciones con exit 0.
  Verificados usuarios no root, init, pids_limit, grace period, cap_drop, no-new-privileges y read_only
  mediante inspección limitada, sin imprimir variables privadas.
- HTTPS verificado con CA local explícita y validación de hostname; frontend y recurso JS con gzip.
  Registro 201, login 200, dos cookies Secure/HttpOnly, JSON público sin tokens, CSRF 403,
  me 200, refresh 200, logout 204 y rechazo inmediato de me 401 con credencial anterior.
- Caída controlada de PostgreSQL: readiness 503, liveness 200; servicio restaurado.
  Configuración JWT incompleta impide iniciar el contenedor con mensaje público seguro.
- Apagado por Compose dentro de la gracia configurada, sin OOM ni SIGKILL: backend/frontend
  exit 143 (SIGTERM), PostgreSQL/Nginx/Mailpit/migraciones exit 0.
- Backend: 250/250 pruebas, 13 archivos, sin omisiones, PostgreSQL y SMTP/Mailpit reales.
  Frontend: 32/32 pruebas, 2 archivos. Tipos de ambos workspaces aprobados.
  Primera pasada SMTP bajo carga de build falló; pasada final aprobada con timeout de prueba
  explícito 1500 ms, coherente con el caso existente. Corregido fixture frontend que reutilizaba
  un mismo objeto Response entre peticiones; no cambió el cliente HTTP.
- `git diff --check` aprobado. No existe lint configurado; no se declara ejecutado.
  Los controles locales usan Node 22.17.0 instalado; los builds Docker usan la versión fijada.

Los certificados productivos y la entrega con proveedor SMTP externo requieren configuración
del despliegue y no fueron probados como servicio externo real. La etapa 5 todavía tiene
pendiente su verificación completa de navegador/UX; estos checks Docker no la reemplazan.
Instrucciones: [infra/OVERVIEW.md](../../../infra/OVERVIEW.md).

## Arranque solicitado para pruebas manuales

Procedimiento repetido usando `.env` privado actual y proyecto `profesor-butchery-dev`, no el
proyecto aislado anterior. `run --build --rm tls-init` terminó con exit 0; no se reprodujo el
fallo TLS reportado inicialmente. `up --build --wait` encontró puerto 5432 rechazado por Windows;
se configuró PostgreSQL en 55449 en `.env`, plantilla y default de Compose dev. Reintento aprobado.
Backend/frontend/PostgreSQL/Nginx/Mailpit saludables; job de migración con exit 0.

Recorrido adicional Chromium contra HTTPS real: formulario de registro y login, recarga/me,
cookies Secure/HttpOnly sin credenciales en storage, CSRF rechazado sin cabecera, refresh,
logout y me 401, formulario de recuperación, recepción SMTP en Mailpit, enlace con token
retirado de URL, restablecimiento, login anterior rechazado/nuevo aprobado y login móvil sin
desbordamiento. Aceptación del certificado autofirmado limitada al navegador de prueba;
HTTPS también verificado con CA local explícita y hostname. Stack conservado en ejecución
para pruebas manuales. No se borraron volúmenes existentes ni se modificaron otras bases.

README actualizado con primera/siguientes ejecuciones, explicación de opciones y necesidad
de Mailpit para probar recuperación. Pendientes: validación manual y matriz completa de etapa 5.

## Cierre vigente

El desarrollador confirmó que los cambios realizados quedaron comprobados el 2026-10-09.
Esta aprobación cierra la validación manual indicada como pendiente en la evidencia histórica
de esta tarea. Los controles anteriores conservan sus resultados y límites: no se afirma
una nueva ejecución de la matriz automatizada completa de navegador ni entrega SMTP real.
La configuración y navegación vigentes se describen en README y los OVERVIEW de cada módulo.
