# Publicación directa y revisión por dos denunciantes

## Solicitud y alcance

Cambio autorizado luego de validar T6 e Inicio: publicar los comentarios nuevos sin aprobación previa y activar revisión administrativa al recibir reportes abiertos de al menos dos usuarios distintos. Incluye backend, mensajes frontend, pruebas y documentación. Sin IA, dependencias, despliegues ni pruebas visuales; la validación manual queda a cargo del usuario. Crear commits locales, sin push.

## Decisiones previas a implementación

- Los comentarios nuevos nacen APROBADO. Editar uno aprobado conserva su aprobación. No se levantan causas de ocultamiento existentes al editar.
- Un rechazo administrativo vigente se conserva al editar; la solicitud explícita de nueva revisión sigue disponible. No se cambian retrospectivamente registros pendientes o rechazados.
- Dos denunciantes distintos con reportes abiertos activan el ocultamiento preventivo y revisión. Reintentos y varios reportes de una misma persona no suman denunciantes.
- La restitución preventiva exige menos de dos denunciantes abiertos y decisión administrativa justificada; cerrar reportes no republica automáticamente ni levanta otras causas.
- La administración conserva acceso a reportes individuales para trazabilidad; el umbral determina el ocultamiento y la revisión requerida.
- Se reutilizan contratos, versiones, bloqueos transaccionales, anonimato y permisos existentes. Sin migraciones destructivas ni modificación de datos de desarrollo.
- Los avisos se eligen por el estado real devuelto por la API, con textos de aplicación seguros y sin JSON.
- El POST de creación conserva la proyección pública existente (sin metadatos de moderación); su política garantiza APROBADO y el aviso confirma publicación. PATCH devuelve el detalle propio y permite distinguir aprobación, rechazo o pendiente. No se agrega una consulta ni se amplía la exposición de datos para mostrar el aviso.

## Aceptación y validación

- Crear y editar comentarios aprobados mantiene visibilidad pública; rechazo y ocultamientos preservan sus restricciones.
- Primer denunciante: continúa visible. Segundo distinto: ocultamiento y revisión; duplicados y concurrencia no eluden el umbral.
- Restitución bloqueada con dos denunciantes, permitida por debajo del umbral con justificación.
- Pruebas frontend y backend, incluidas integraciones con PostgreSQL real aislado; typecheck, lint, builds, diff check.
- Reconstruir y dejar saludable el stack oficial mediante Docker Compose, conservando su base de desarrollo.

## Resultados

- Typecheck y lint frontend/backend: aprobados. Typecheck reejecutado tras agregar escenarios de prueba: aprobado.
- `docker compose -f docker-compose.dev.yml --profile mail build backend frontend`: exit 0; builds de ambas aplicaciones aprobados.
- `docker compose -f docker-compose.dev.yml --profile mail up -d --wait backend frontend proxy postgres mailpit`: exit 0. Cinco servicios saludables; migrate finalizó correctamente. Se conserva el volumen de desarrollo.
- Smoke HTTP: 24/24; `nginx -t`: correcto. Sin uso de navegador.
- Ejecución inicial de pruebas detectó expectativas anteriores (alta pendiente, votos y umbral tres), corregidas para la nueva política. La carga simultánea produjo timeouts; una ejecución global frontend posterior no progresó y se detuvo. No se declara aprobada esa suite global.
- Los intentos interrumpidos dejaron fixtures en la base aislada anterior; se creó `t6_policy_validation` en el PostgreSQL de pruebas y se aplicaron las 28 migraciones, sin tocar datos de desarrollo. Se reejecutan pruebas relevantes con un worker y resultados separados.
- Backend: 66/66 unitarias (create/update/umbral) y 155/155 integraciones HTTP con PostgreSQL real en cinco archivos. El recorrido nuevo cubre alta pública sin aprobación, primer reporte, reintento idempotente, segundo denunciante, acceso propio, restitución bloqueada, cierre sin publicación automática y restitución explícita con recuperación del voto. Incluye rechazo, permisos, privacidad, versiones, concurrencia y rollback.
- Frontend: 193/193 pruebas relevantes en ocho archivos. Se corrigió una expectativa antigua de texto en mensajes seguros y se reejecutó su archivo (15/15); los otros siete suman 178/178.
- Evidencia de reejecuciones: `.tmp/policy-back-focused-final.log` (cuatro suites aprobadas, T4 con expectativas antiguas y dos timeouts de preparación), `.tmp/policy-back-reportes-rerun.log` (T4 corregido 38/38, hookTimeout 30000 para preparación real), `.tmp/publicacion-back-unit-final.log` (66/66), `.tmp/policy-front-relevant-final.log` y `.tmp/policy-front-errors-final.log` (193/193). La advertencia pg de consultas concurrentes durante fixtures no produce fallos.
- `git diff --check`: aprobado. Playwright actualizado como artefacto para la nueva política, sin ejecutarse por instrucción del usuario. La suite global no se declara aprobada.
- Validación manual comunicada por el usuario: desaparición del feed con el umbral anterior, aprobación de un comentario y restauración desde administración tras desestimar el reporte. La nueva regla de dos se comprueba además por HTTP/PostgreSQL real.

## Commits locales

La integración previa de desarrollo permanece antes de estas modificaciones. Se dividió el commit inicial amplio sin perder contenido ni modificar archivos de trabajo:

- `d7bb8a4` feat(reportes): agregar contratos del cliente de denuncias
- `a51f09b` feat(feedback): definir contratos de moderación y mensajes seguros
- `dd8cd7d` feat(feedback): gestionar experiencias propias y revisión de rechazos
- `e417a6c` feat(reportes): permitir denunciar experiencias comunitarias
- `4976a8e` feat(admin): gestionar moderación y resolución de reportes
- `aab537a` fix(feedback): mostrar errores seguros en respuestas y feed
- `de412f1` feat(inicio): ajustar feed, selector y ocultamiento directo
- `c1b4db8` test(moderacion): cubrir recorridos reales y permisos
- `268f59b` docs(feedback): registrar cierre de T6 y ajustes de Inicio
- `eadca67` fix(proxy): enrutar consultas de rankings al backend

El ajuste posterior se registra en dos commits por dominio: backend con sus pruebas, y frontend con sus pruebas y documentación. Se revisan mediante `git diff --cached` y `git diff --cached --check`. Sin push, merge ni despliegue.

## Recorrido funcional para la validación manual

1. El autor publica; el comentario aparece en la comunidad y en Mis experiencias. Puede editarlo, retirarlo u ocultarlo voluntariamente. Mostrar desde Mis experiencias levanta solo su propio ocultamiento.
2. Un usuario ajeno reporta con motivo obligatorio y descripción opcional. El primer denunciante no cambia la visibilidad; el segundo distinto con reporte abierto activa el ocultamiento preventivo. Reintentar no duplica el conteo.
3. El autor conserva acceso privado. En Administración > Experiencias > Reportes, ADMIN consulta el contenido denunciado, contexto, versión, motivos, estado, historial e identidad autorizada de denunciantes (id y displayName).
4. ADMIN resuelve o desestima reportes con justificación. Para restituir por reportes, reduce los denunciantes abiertos a cero o uno y confirma Restituir ocultamiento preventivo. No basta con cerrar reportes. Si queda otra causa o no está aprobada, continúa oculta.
5. ADMIN puede rechazar una experiencia aprobada o pendiente con motivo visible para el autor, y ocultar una aprobada por administración. Restituir ocultamiento administrativo levanta solo esa causa.
6. El autor corrige una rechazada y guarda: sigue rechazada. Solicitar nueva revisión exige una diferencia real de texto y la deja pendiente. ADMIN puede aprobar una pendiente ajena; aprobar no levanta ocultamientos.

Todas las decisiones relevantes registran versión e historial; conflictos requieren actualizar los datos. Los listados usan nueve elementos y el historial tres. La comunidad no recibe identidades ni cantidades de reportes. Los comentarios pendientes anteriores no se publican retrospectivamente.

## Cierre

Etapa implementada, pruebas relevantes aprobadas y validación manual administrativa comunicada por el usuario. Stack oficial actualizado y saludable en http://localhost:8080/home, conservando la base de desarrollo. Sin tareas de IA, push, merge ni despliegue. La validación de entornos productivos precede a la unión de la rama y queda fuera de este cierre local.
