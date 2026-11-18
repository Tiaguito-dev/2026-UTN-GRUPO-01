# Sesión con aviso y renovación explícita por inactividad

## Alcance y autorización

Implementar el plan aprobado sobre fix/sesiones-confirmaciones (instrucción posterior explícita:
mantener la rama del hotfix). Incluye autenticación backend/frontend y sus pruebas; no modificar
layout, router, hooks compartidos, estilos base ni primitivas globales. Sin nuevas dependencias,
commits, push ni PR automáticos. Mantener la arquitectura Nest/Prisma y Next/React existentes.

## Decisiones previas y criterios de aceptación

- Inactividad 1800 segundos; aviso a los 1680 segundos con 120 segundos para confirmar.
  Antes del aviso la interacción real reinicia el plazo. Después solo Renovar sesión lo reinicia.
  Cerrar sesión o no responder bloquea la UI y retorna al login con explicación visible.
- Actividad compartida entre pestañas. Clic, teclado, scroll y movimiento de puntero confiables
  en pestaña visible cuentan; consultas, refresh, montaje, recarga y recuperar foco no cuentan.
  Agrupar actividad con máximo una solicitud cada 15 segundos (también entre pestañas).
- Mantener acceso de 900 segundos y vencimiento absoluto de 604800 segundos configurables.
  Renovar inactividad no prolonga el límite absoluto; cerca de ese límite pedir nuevo login.
- Backend es autoridad: agregar Session.lastActivityAt requerido, inicializado al login y
  rellenado con hora de migración para sesiones existentes, sin cambiar expiresAt.
  Rechazar inactividad vencida en autenticación y rotación de refresh. No actualizarlas al leer.
- Config: AUTH_IDLE_TTL_SECONDS=1800, AUTH_IDLE_WARNING_SECONDS=120; enteros positivos,
  warning menor a idle; exponer en ejemplos y Compose sin tocar secretos reales.
- Contrato aditivo: GET /auth/session, POST /auth/session/activity, POST /auth/session/renew.
  Respuesta SessionStatus: {serverNow, warningAt, idleExpiresAt, absoluteExpiresAt}, fechas ISO.
  warningAt=min(lastActivityAt+idle-warning, absoluteExpiresAt-warning),
  idleExpiresAt=lastActivityAt+idle, vencimiento efectivo=min(idleExpiresAt,absoluteExpiresAt).
  Solicitudes sin body (rechazar payloads ajenos en escrituras). No IDs/fechas del cliente.
  Preservar login, me y refresh con sus respuestas actuales. No devolver IDs ni tokens de sesión.
- Identidad interna de sesión derivada del guard, sin agregarla a authUser ni a /auth/me.
  Lectura revalida sesión vigente. Escrituras con bloqueo de fila Session compartido con
  logout/refresh, relectura bajo bloqueo y revalidación de usuario activo/verificado; actividad
  durante el aviso devuelve estado sin extender; renovar solo antes del vencimiento efectivo.
  Mantener CSRF, transporte seguro, no-store y mensajes seguros.
- Frontend: tipos/esquema/service dedicados al estado; coordinación existente para cookies,
  actividad y deadlines sin tokens. El aviso es componente local de auth con diálogo nativo
  accesible no descartable con Escape y CSS Module; no editar Dialog global.
- Backend determina deadlines; reloj del cliente usa referencia serverNow + tiempo transcurrido.
  Mantener serverNow original en caché y separar su hora local de recepción; estimaciones entre
  pestañas no invalidan respuestas posteriores del servidor. Una consulta autoritativa vuelve
  a sincronizar el reloj si la hora del equipo cambió, evitando bloqueos y sondeos repetitivos.
  Comprobar al montar y al recuperar foco/visibilidad, sin renovar por esos eventos. No mostrar
  datos protegidos tras vencimiento; renovaciones y cierre sin duplicados ni respuestas obsoletas.
  Renovación preserva formularios y muestra "La sesión se renovó correctamente."; limpiar ese
  aviso con la siguiente interacción real o al comenzar otro aviso. Red fallida permite reintentar solo dentro del plazo; cerrar UI
  no depende de logout exitoso. Al límite coordinar y verificar estado para no cerrar una sesión
  recién renovada en otra pestaña. No guardar borradores automáticamente.
- Cerca del límite absoluto el aviso explica el nuevo login, sin prometer extender siete días.
  Mostrar mensaje de cierre por inactividad en login mediante componente auth, sin router global.

## Validación y documentación

TDD por rol: test escribe regresiones rojas antes de implementar; back y front coordinan contratos.
Probar límites exactos, bloqueo tras aviso, renovación/cierre concurrentes, red, varias pestañas,
recarga, suspensión, revocación/desactivación, CSRF, duplicados y respuestas tardías. Integraciones
en PostgreSQL exclusivo de pruebas, nunca datos de desarrollo. Tipos, lint, suites pertinentes,
builds y navegador real con API simulada o DB aislada. Actualizar OVERVIEW front/back, CHANGELOG,
evidencia y límites de validación; mover tarea a finished al cerrar implementación.

## Despliegue

Migración y backend antes de frontend; backend aplica política también a clientes antiguos.
La migración ofrece hasta 30 minutos a sesiones existentes conservando su límite absoluto.
No desplegar ni aplicar migraciones sobre bases existentes durante la implementación.

## Implementación y evidencia

- La implementación se entregó en `fix/sesiones-confirmaciones`, inicialmente sin nuevos commits ni publicación.
- Regresiones iniciales: backend 9 casos rojos/1 verde, monitor sin implementación y pruebas
  nuevas de renovación/servicio; implementación posterior a esa evidencia.
- Backend: contratos aditivos, campo de actividad y bloqueo compartido implementados. Revisión
  adicional corrigió el vencimiento durante una consulta asíncrona de usuario, con regresión.
- Migración aplicada exclusivamente en PostgreSQL temporal de pruebas. Verificación previa con
  sesión legacy confirmó backfill de hora de migración y conservación exacta de expiresAt;
  comparación Prisma contra esquema migrado sin diferencias. El entorno se recreó al retomar
  y las 19 migraciones se aplicaron correctamente en una base vacía independiente.
- Integración nueva: 16 pruebas HTTP con PostgreSQL aprobadas. Suite backend completa: 43
  archivos, 950 pruebas aprobadas con base y Mailpit temporales exclusivos, incluidos SMTP y
  concurrencia. Typecheck, ESLint y build backend aprobados (Node 22.22.3).
- Recorrido real navegador -> Next -> Nest -> PostgreSQL temporal aprobado: login con cookies,
  aviso tras forzar 28 minutos, renovación explícita persistida, formulario conservado,
  expiresAt sin cambios y rechazo 401/retorno al login al superar 30 minutos. Sin errores JS.
- Compose mantiene parámetros nuevos con valores por defecto; no se modificaron secretos,
  dependencias ni datos de aplicaciones existentes. El despliegue remoto queda fuera de alcance.
- Frontend final: 77 archivos y 793 pruebas aprobadas. Una ejecución concurrente con build
  falló al esperar un enlace en un test existente de Experiencias; la repetición completa
  posterior aprobó sin modificar ese archivo, expectativas ni tiempos de espera.
- Las 36 regresiones focalizadas incluyen dos correcciones de reloj, actividad limitada por
  caché sin retrasar el aviso, login externo del mismo usuario y mensaje de renovación exitosa.
  Typecheck de aplicación/tests, ESLint completo y build de producción frontend aprobados.
- Ambos scripts Chromium aprobaron contra el build de producción: el recorrido anterior de
  eliminación de experiencias y el nuevo de dos pestañas con actividad real, agrupación de
  escrituras, recarga sin actividad, Escape, renovación explícita, error/reintento y cierre.
  El borrador se conserva y el mensaje de éxito queda dentro del viewport. Revisión visual
  del aviso a 1280 px y 390 px aprobada, sin cambiar snapshots.
- Verificación final de Compose de desarrollo/producción y git diff --check aprobada.
  PostgreSQL y Mailpit temporales retirados; servidor local de comprobación detenido.
  Se eliminaron los diez scripts auxiliares, registros y capturas temporales de esta tarea,
  preservando archivos previos ajenos y las pruebas permanentes. La validación final se entregó sin staging, commits ni push.

## Commits autorizados

El desarrollador solicitó posteriormente ejecutar los dos commits de esta etapa en la misma rama.
La publicación remota queda fuera de esta instrucción.

## Mensajes de commit propuestos

- `feat(auth): controlar el vencimiento de sesión por inactividad` (backend, migración y configuración).
- `feat(auth): agregar aviso y renovación explícita de sesión` (frontend y pruebas de navegador).
