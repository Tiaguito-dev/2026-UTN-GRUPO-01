# T6 — Integración frontend de moderación y reportes

Fecha: 2026-11-17. Autorización exclusiva T6 y sus pruebas. Sin commits, push,
despliegue, IA, M1.3, dependencias nuevas ni refactorizaciones generales.
Estado: implementación y validación automática completas. Cierre técnico de T6; aceptación manual y validación de entornos productivos pendientes antes de aprobar la unión del código.

## Precondiciones y alcance

T1–T5 finalizadas. T5 registrada en `a3e35ab`; árbol principal limpio al iniciar,
sin operaciones Git pendientes. El worktree M1.3 permanece estacionado e intacto.
Se inspeccionan fichas T1–T5, plan incremental, OVERVIEW de front/back y contratos
reales antes de consumirlos. Trabajo delegado por perfiles front/test conforme a
`.agents/OVERVIEW.md`, sin modificar layout, router, auth, hooks compartidos,
estilos base ni primitivas globales.

Integrar Mis experiencias, estados y causas simultáneas, ocultamiento voluntario,
edición y reenvío explícito de rechazados, reportar experiencias públicas ajenas,
moderación y reportes dentro de administración existente. Mantener anonimato,
CSRF/Origin, permisos backend y control de versión. Listados de nueve y eventos
de tres. Alta a `/home` con guardado pendiente; edición a detalle con feedback.

## Decisiones previas

- Reutilizar FeedbackForm, FeedbackDetail, ExperienceCard, ExperienciasList,
  ComisionFeedback, componentes administrativos, Dialog, Notice y clientes HTTP.
- Separar contratos públicos/propios/ADMIN: no llevar identidad de denunciantes
  a componentes comunitarios. Identidad ADMIN limitada a id/displayName.
- Estado y causas son independientes: mostrar pendiente/rechazado o publicado
  solo cuando corresponda, y enumerar restricciones activas sin restituir otras.
- Enviar versionEsperada en PATCH y acciones de moderación/autor que lo exigen;
  conflictos recargan información y conservan borradores. Cierres de reportes
  nunca restituyen automáticamente; RESTITUCION_REPORTES es explícita.
- Filtros y sección Reportes se integran en vistas y navegación administrativas
  existentes, preservando origen y retorno. No nuevo panel ni endpoints.
- Pruebas de contratos Vitest node y componentes jsdom/Testing Library; recorridos
  Playwright contra harness Nest compilado y PostgreSQL desechable real. Sin mocks
  para afirmar validación E2E. Axe y overflow a 360, 600 y escritorio.

## Aceptación y validación prevista

Cubrir propios/paginación/estados, causas simultáneas, ocultar/restaurar,
rechazo/corrección/revisión, validaciones/reportes/duplicados/429, moderación y
reportes ADMIN, privacidad, permisos, historial, restitución y conflictos,
navegación/retorno, accesibilidad y responsive. Recorrido principal completo de
creación, aprobación, ocultamiento autor, tres denunciantes, consulta ADMIN,
cierre y restitución; recorrido rechazo/corrección/reenvío/aprobación.

Ejecutar typecheck/lint/tests/build front/back, Playwright real, axe y
`git diff --check`. Registrar fallos y reejecuciones; no declarar validación
completa con pruebas omitidas. Infra exclusiva sin modificar datos existentes.
Actualizar ficha, plan, front/OVERVIEW y CHANGELOG; back/OVERVIEW solo si procede.
Mover ficha a finished únicamente al cumplir aceptación. Detenerse al cerrar T6.

## Evidencia

### Reapertura por validación manual: ranking y datos de desarrollo

El usuario informa fallo del ranking de profesores y pide usar la base de
desarrollo existente con materias y comentarios. La aceptación manual continúa
pendiente; las validaciones automáticas anteriores no cubrieron este enrutamiento.
Se verifica el endpoint por el proxy antes de corregir. Se preservan los datos
originales mediante backup; no se ejecutan seeds ni resets sobre esa base.
Se inspeccionan las migraciones pendientes y se comprueba compatibilidad antes
de conectarla al backend actualizado. El volumen aislado de revisión se conserva.
La corrección de proxy debe aplicarse a configuraciones de desarrollo y producción
y verificarse mediante smoke HTTP protegido, sin desplegar a producción.

Resultado de la corrección (2026-11-18):

- Causa del ranking: faltaba `/rankings/` en Nginx; una consulta sin sesión devolvía
  404 HTML de Next.js. Ambos archivos de proxy ahora envían esa ruta a NestJS.
  El smoke operativo agrega rankings de comisiones, profesores y perfil, además
  de sus páginas. Resultado contra Docker: 24/24; APIs protegidas devuelven 401
  JSON. Login y consultas autenticadas de rankings/búsqueda/perfil devuelven 200.
- Se recuperó la base configurada en `.env`, PostgreSQL de
  `profesor-butchery-dev-postgres-1`, puerto 55449, base `utn_grupo_01`.
  Respaldo previo privado: `.tmp/t6-desarrollo-before-migrations.dump`, comprobado
  mediante lectura y descompresión completa con `pg_restore --file=/dev/null`.
  La escritura inicial del dump terminó antes de instalar el listener de `finish`
  del helper; se comprobó el archivo íntegro antes de continuar, sin dar por
  aprobado ese primer comando por su código de salida.
- Once migraciones pendientes aplicadas con la imagen de migración del proyecto,
  sin reset ni seeds. Antes y después se compararon conteos y hashes de todas las
  filas y columnas originales de 15 tablas: idénticos. Posteriormente se aplicó
  únicamente el cambio de contraseña que el usuario había solicitado para su
  cuenta original; se usó el repositorio existente y se revocaron sus sesiones.
- Datos originales: 17 materias (16 vigentes), 28 profesores, 18 comisiones y
  4 comentarios (1 vigente y 3 de baja). La lectura comunitaria devuelve la
  experiencia vigente. No se restauran bajas ni se inventan estrellas: las
  experiencias históricas conservan puntuación nula y el ranking queda vacío
  correctamente, con búsqueda y perfiles disponibles.
- Se levantó el Compose oficial con `docker compose -f docker-compose.dev.yml
  --profile mail up --build --wait`: imágenes compiladas correctamente, cinco
  servicios saludables y migración exitosa. Nginx cargado pasa `nginx -t`.
  El stack aislado anterior se detuvo, conservando su volumen. Se retiró la
  conexión temporal entre sus redes y la base original. Frontend en 8080,
  Mailpit en 8025. Accesos privados locales actualizados.
- Smoke Playwright sobre el frontend Docker y base de desarrollo: login,
  ranking sin aviso de error y experiencia comunitaria original visible,
  aprobado. Primer intento falló por codificación del selector de contraseña
  en el helper PowerShell; se corrigió el script local, no el producto.
  `node --check` del smoke operativo y `git diff --check` aprobados. El intento
  de ESLint del script desde el workspace backend lo ignoró por estar fuera de
  su base; no se cuenta como lint aplicado al archivo.
- No se ejecutaron suites que escriban fixtures sobre la base del usuario.
  Las suites completas anteriores corresponden a bases exclusivas de pruebas.
  Estos cambios de configuración no modifican el código frontend/backend.
  La aprobación manual y la comprobación productiva siguen pendientes. No se
  realizaron nuevos commits ni despliegues.

### Secuencia de aceptación acordada

El usuario realiza la validación manual de comportamiento y aspecto en el navegador.
Después de esa revisión se deben validar los entornos productivos antes de unir el
código a la rama. Los healthchecks y builds locales no equivalen a esa validación.
No se autoriza un despliegue ni una unión automática. Los futuros commits conservan
el orden: integración de desarrollo primero y modificaciones de T6 después.

### Stack Docker para revisión

Compose de desarrollo del proyecto, con override de imágenes y variables privadas
locales, proyecto aislado `butchery-t6-validacion`. `up --build -d --wait` terminó
correctamente: PostgreSQL, backend, frontend, proxy y Mailpit saludables; migración
finalizada con código 0. Frontend/proxy en `http://localhost:8080`, Mailpit en
`http://localhost:58037`. Smoke `scripts/check-admin-proxy.mjs`: 16/16 comprobaciones
aprobadas (API exige autenticación y páginas frontend servidas por el proxy).
El stack se mantiene levantado. No se modifican otros contenedores ni sus datos.
Catálogo ficticio y cinco cuentas locales cargados en esta base aislada. Accesos
privados en `.tmp/t6-docker-accesos.md`, fuera del versionado. Smoke autenticado
por el proxy: ADMIN y autor inician sesión y consultan propios; reportes ADMIN
responde 200 para administrador y 403 para autor (6/6 comprobaciones). Readiness
desde dentro del contenedor confirma backend y PostgreSQL disponibles (200).

### Regresión final sobre integración y T6

- Frontend completo: 1084/1084 tests, 94/94 archivos, sin omisiones, exit 0,
  681.60 s. Incluye contratos, componentes, privacidad, mensajes sin JSON,
  borradores y concurrencia. Typecheck, lint y build de ambos workspaces aprobados.
- Primer global backend combinado: 1638/1640; dos fallos en el archivo de migración
  (timeout y conexión cerrada posterior). Reejecución aislada del mismo archivo,
  sin modificar pruebas ni plazos: 4/4, exit 0, 749 ms. Se exige repetir el global
  completo para declarar aprobación; el resultado definitivo consta debajo.
- Segundo intento global interrumpido: el comando usó SMTP_PORT, mientras las
  pruebas leen TEST_SMTP_PORT; los casos SMTP intentaron el puerto 1025 y fallaron.
  Se corrigió exclusivamente el entorno del comando (TEST_SMTP_HOST/PORT para
  Mailpit aislado en 51036) y se reinició la suite completa. No se modifican
  contratos, assertions, plazos ni implementación para eludir estos fallos.
- Global backend definitivo con entorno correcto: **1640/1640 tests**, **71/71
  archivos**, sin omisiones, exit 0, 324.18 s. PostgreSQL y SMTP/Mailpit reales.
  Archivo local de evidencia: `.tmp/t6-backend-final-correct-env.log`.
  Los intentos anteriores permanecen documentados y no se cuentan como aprobados.
- Comprobación final frontend de tipos y lint de ambos workspaces: exit 0.
  Build de ambos workspaces aprobado y build Docker final de las imágenes aprobado.
  `git diff --check` y revisión del índice sin conflictos aprobados.
- Recorrido E2E principal aprobado en las reejecuciones: cinco sesiones reales,
  PostgreSQL, umbral de tres reportes, causas simultáneas y restituciones explícitas.
  Los intentos incompletos del recorrido de rechazo y los ajustes de fixtures se
  conservan en los logs locales. Los resultados completos posteriores constan en
  la sección E2E final.

### Contratos y regresiones antes de integrar desarrollo

- Backend real: 208/208 en seis archivos (acciones T3 unitarias/HTTP, reportes T4
  unitarias/HTTP y umbral T5 unitarias/HTTP), exit 0, 152.68 s. Base desechable
  exclusiva `t6_backend`, 28 migraciones aplicadas; PostgreSQL y SMTP reales.
  Typecheck y lint backend aprobados. Esta evidencia corresponde al código previo
  a incorporar los cambios posteriores de desarrollo; se repetirá lo pertinente.
- Primer recorrido Playwright detectó una precondición de fixture incorrecta
  (email con mayúsculas frente a normalización del login); se corrigió el fixture.
  Luego encontró que Inicio recibía successMessage sin presentarlo: el producto
  agregó Notice con confirmación de guardado pendiente y validación del mensaje.
  No se declara todavía el recorrido completo aprobado.
- La revisión adicional solicitada por el usuario encontró que varios consumidores
  mostraban Error.message remoto directamente. Se reemplazaron por mensajes seguros
  con acciones para continuar y traducción exacta de conflictos de negocio conocidos,
  sin concatenar cuerpos JSON, stacks, emails, sesiones ni tokens arbitrarios.
  Las expectativas antiguas de error crudo se ajustaron de forma explícita;
  se conservaron los controles de borradores, UUID, doble envío y revalidación.
- Focalizada de respuestas, feed, interacciones y componentes de moderación:
  51/51 en cuatro archivos, exit 0, 40.89 s. La reejecución posterior de componentes,
  contratos de servicio y mensajes seguros pasó 49/49 en tres archivos, exit 0,
  14.72 s. Incluye un caso adicional de rechazo con motivo JSON y pruebas de UI
  para carga propia/reportes que verifican ausencia de secretos y borradores conservados.
- El usuario amplió el cierre: integrar desarrollo, verificar el resultado combinado
  y dejar el stack levantado para su validación manual. No se realizará ningún
  commit antes de esa validación; el orden posterior acordado es integración primero
  y cambios de T6 después. La integración y la validación final siguen pendientes.
- Primer intento global frontend tras la integración: ejecución serial interrumpida
  con Ctrl+C durante el diagnóstico del entorno, sin resumen final; no se cuenta
  como aprobada. Un intento focalizado concurrente de feedback-components no llegó
  a ejecutar casos porque el worker de Vitest no respondió en su plazo de arranque
  de 60 s. No se modificaron timeouts, dependencias ni configuración para ocultarlo;
  se requiere una reejecución tras recuperar el entorno de ejecución.
- Reejecución focalizada con el mismo comando y sin modificar configuración, con
  permiso de ejecución fuera del sandbox: feedback-components 54/54, exit 0,
  28.45 s. Incluye los casos nuevos de conflicto PATCH con conservación de borrador,
  recarga de versión y confirmación explícita, y corrección de rechazo usando contexto
  histórico sin exigir disponibilidad de la comisión. La comparación apunta a una
  restricción del entorno de ejecución; no se afirma una causa definitiva del bloqueo.
- Global frontend final sobre desarrollo integrado y T6: **1084/1084 pruebas,
  94/94 archivos**, exit 0, 681.60 s; comando `npm run test --workspace=front --
  --no-file-parallelism`, con permiso de ejecución fuera del sandbox. Sin pruebas
  omitidas y sin modificar timeouts ni configuración. Inicio 18:25:28 local.
  El informe del runner atribuye 48% al entorno, 27% a pruebas y 22% a importaciones;
  94 workers aislados. No se cambió el aislamiento para acelerar artificialmente.
- `npm run typecheck --workspace=front` posterior a la global: exit 0,
  incluyendo tanto `src/` como los tipos de `tests/` sobre el resultado integrado.

### E2E final y comprobación de la entrada de texto

- Un intento previo del recorrido de rechazo quedó en el formulario de alta:
  después de escribir y seleccionar valoración/anonimato, el contexto de error
  conservaba esos dos controles pero mostraba textarea vacío, contador `0 / 3000`
  y validación de texto obligatorio. No llegó a crear la experiencia por API.
- El helper de creación ahora verifica tanto el valor nativo del textarea como
  el contador derivado por React inmediatamente después de escribir y nuevamente
  tras elegir los controles. No vuelve a rellenar, no reintenta la operación y no
  aumenta esperas para ocultar pérdidas del borrador. También verifica la ausencia
  del antiguo checkbox de normas, conforme al cambio integrado desde desarrollo.
  No se modificó código de producto a partir de este fallo.
- Primera ejecución con estas comprobaciones: **4/4 E2E aprobados**, exit 0,
  1.3 min; principal 42.6 s, rechazo 6.2 s, negativos 1.4 s y reportes/idempotencia/
  cuota 6.4 s. Repetición de los cuatro para comprobar intermitencia: **4/4**,
  exit 0, 1.2 min; principal 43.5 s, rechazo 7.7 s, negativos 1.5 s y cuota 6.1 s.
  La pérdida de texto no se reprodujo en estas dos ejecuciones; su causa anterior
  no quedó determinada y no se presenta como una corrección demostrada de producto.
- Comando: `npm run test:e2e --workspace=front -- moderation.browser.spec.mjs`,
  fuera del sandbox, con `TEST_DATABASE_URL` exclusiva de `t6_e2e`, PostgreSQL y
  backend Nest compilado reales, sin interceptaciones/mocks de peticiones.
- Recorridos completos: alta pendiente, aprobación ADMIN, ocultar/mostrar autor,
  tres denunciantes y desaparición inmediata de la tarjeta comunitaria, acceso del
  autor, identidad segura ADMIN, cierre, restitución preventiva con causa administrativa
  todavía vigente y restitución administrativa final. Rechazo, intento de reenvío sin
  corrección, edición que conserva rechazo, solicitud explícita y aprobación posterior.
  Negativos 401/403, Origin/CSRF, versión obsoleta, reporte propio, idempotencia,
  duplicado con otros datos y cuota 429 mediante HTTP real.
- Axe y overflow a 360, 600 y 1280 px en formulario, experiencias propias,
  bandeja de moderación, diálogo de reporte, listado de reportes y detalle ADMIN:
  sin violaciones serious/critical ni desbordamiento horizontal en las ejecuciones.

### Regresión real del registro integrado desde desarrollo

- El caso upstream `auth.browser.spec.mjs`, seleccionado por
  `registro por formulario, login, recarga`, aprobó **1/1**, 5.2 s de ejecución
  del caso, sin modificar el test ni instalar navegadores. Verificó aceptación de
  términos en el registro, cuenta inicialmente no verificada, entrega real del
  correo por Mailpit, enlace de verificación, login, recarga, cookies HttpOnly y
  ausencia de credenciales en almacenamiento del navegador y proyecciones JSON.
- PostgreSQL exclusivo `t6_e2e`; SMTP 51037 y API Mailpit 58037 del stack local
  aislados del buzón 51036/58036 usado por la suite backend. La consulta utilizó
  exclusivamente el destinatario aleatorio del fixture; no se borraron mensajes
  generales ni se usó la base de datos de la validación manual.
- Comando: `npm run test:e2e --workspace=front -- auth.browser.spec.mjs -g
  'registro por formulario, login, recarga'`, fuera del sandbox, contra servicios
  reales y con la configuración de navegador existente.
