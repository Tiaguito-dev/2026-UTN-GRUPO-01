# Hotfix de sesiones y confirmaciones

## Alcance y autorización

Solicitud: rama de hotfix para desarrollo, revisar expiración de sesiones, eliminación de
experiencias y comportamientos similares. Incluye AuthProvider exclusivamente para corregir
la comprobación de sesión en una pestaña abierta. No modificar layout, router, hooks compartidos,
primitivas globales, permisos, dependencias ni política de duración. Sin commit ni push automático.

## Hallazgos y decisiones previas

- Backend: acceso de 900 segundos y sesión absoluta de 604800 segundos; refresh no prolonga
  expiresAt. No hay cierre por inactividad. Conservar esos contratos y validar tests existentes.
- AuthProvider conserva estado autenticado sin volver a consultar. Comprobar en segundo plano
  cada minuto visible y al recuperar foco/visibilidad, sin desmontar formularios, sin peticiones
  solapadas y descartando resultados anteriores a login/logout/cambio de cuenta. Un 401 limpia
  la cuenta; fallos transitorios conservan la cuenta y permiten reintentar la comprobación.
- Experiencias ya confirma antes de borrar, pero el listado no muestra successMessage.
  Consumirlo con Notice, también en la variante administrativa.
- Desvincular docente requiere confirmación local con Dialog existente; cancelar no escribe.
  Mantener mensajes, permisos, bloqueo de duplicados y gestión de asociaciones existentes.

## Criterios de aceptación y validación

- Tests de regresión antes de implementar: éxito visible del listado, confirmación/cancelación
  docente y comprobación de sesión por reloj/foco, 401, red, concurrencia y desmontaje.
- Frontend: tests focalizados, typecheck, lint; backend: tests de JWT, sesión y refresh.
- Revisión manual de flujos; intentar navegador si existe servicio disponible. Documentar toda
  limitación de entorno y evidencia sin afirmar comprobaciones no realizadas.
- Actualizar front/OVERVIEW.md, back/OVERVIEW.md y CHANGELOG.md. Entregar mensajes de commit
  por módulo y dejar todos los cambios sin commit en fix/sesiones-confirmaciones.

## Implementación y evidencia

- Rama local creada desde `origin/desarrollo` actualizado, base `27b50b9`.
- Auditoría: confirmaciones existentes en eliminación de experiencias autor/ADMIN, bajas
  académicas y desactivación de usuarios. La falta de confirmación encontrada correspondía
  a desvinculación docente; el fallo de experiencias era el mensaje de éxito del retorno.
- TDD: tests nuevos de listado/docentes fallaron antes del ajuste; AuthProvider tuvo
  7 casos rojos y 1 verde antes de implementar. Después: 45 pruebas de los tres archivos
  de listado/docentes y 8 del proveedor aprobadas.
- Backend: 85 pruebas aprobadas en auth-jwt-config, auth-session.use-cases y
  auth-refresh.use-cases en la base actual. No se modificó lógica backend.
- Typecheck frontend, ESLint completo y build de producción aprobados (Node 22.22.3).
- Suite frontend completa: 75 archivos, 765 pruebas aprobadas con maxWorkers=2 y reporter
  verbose (160.91 segundos). La primera ejecución sin salida de progreso se interrumpió;
  la repetición completa terminó con código 0. Revisión final de diff sin errores ni staging.
- Chromium headless real aprobado contra Next dev con API simulada: confirmación del autor,
  cancelar sin DELETE, confirmar con un único DELETE, éxito visible en listado, comprobación
  tras un minuto virtual y retorno a login tras expiración confirmada al recuperar foco.
  Reproducible con `node front/tests/hotfix-browser-check.mjs` (instrucciones en su encabezado).
- No se verificó el despliegue remoto ni sesiones de usuarios reales. No se ejecutaron
  integraciones sobre PostgreSQL: no hay TEST_DATABASE_URL aislada configurada. El navegador
  no escribió datos reales. La implementación se entregó inicialmente sin commits ni push.

## Publicación autorizada

El desarrollador solicitó posteriormente ejecutar los tres commits y publicar la rama
`fix/sesiones-confirmaciones` para abrir manualmente una PR a `desarrollo` en GitHub.

## Mensajes de commit propuestos por módulo

- `fix(auth): comprobar la vigencia de sesiones abiertas`
- `fix(experiencias): mostrar el éxito al eliminar comentarios`
- `fix(docentes): confirmar la desvinculación de comisiones`
