# Frontend

## Contenedor

`front/Dockerfile` utiliza build por etapas con Node 22.22.3, lockfile raíz y salida
Next.js standalone. El runtime ejecuta como `node`, sin dependencias de desarrollo.
`NEXT_PUBLIC_API_URL` se configura durante el build, apuntando al mismo origen del proxy:
`http://localhost:8080` para Compose de desarrollo y HTTPS para producción.
La excepción HTTP local requiere `NEXT_PUBLIC_ALLOW_LOCAL_HTTP=true`; no se habilita en
producción. `/health` es público y no expone configuración. La compresión la realiza Nginx;
Next.js conserva la política de referencia y evita logs de URLs de peticiones.
Ejecución y configuración: [infra/OVERVIEW.md](../infra/OVERVIEW.md).

Aplicación web escrita en TypeScript con Next.js y React. Usa App Router, Server Components por
defecto y el runtime de Node.js.

## Estructura

- `src/app/`: rutas, layouts y estados del App Router.
- `src/components/`: componentes por módulo (`home/`, `academic/`, `admin/`, `auth/`), más
  `SiteHeader` y `FeatureCarousel` en la raíz.
- `src/components/ui/`: primitivas de UI genéricas, sin lógica de dominio.
- `src/lib/`: utilidades sin estado. `lib/format/` formatea valores para mostrar (`periodo.ts`,
  `role.ts` con `ROLE_LABEL`) y `lib/messages.ts` reúne los textos de interfaz repetidos.
- `src/services/`: clientes HTTP dedicados por módulo.
- `src/hooks/`: hooks reutilizables por módulo.
- `src/types/`: contratos TypeScript del frontend.
- `src/validations/`: validaciones de formularios.
- `src/styles/`: CSS por capas (`reset`, `tokens`, `base`, `layout`, `components`), importado
  desde `app/globals.css`.
- `tests/`: pruebas de integración y end-to-end de los flujos funcionales.

Las reglas del front están en `docs/standards/`:
[frontend-estilos.md](../docs/standards/frontend-estilos.md) (capas y tokens),
[frontend-componentes.md](../docs/standards/frontend-componentes.md) (primitivas de `ui/`, `lib/`
y nombres), [frontend-pantallas.md](../docs/standards/frontend-pantallas.md) (patrones de
pantalla, encabezado, shell, accesibilidad y checklist de pantalla nueva) y
[frontend-tests.md](../docs/standards/frontend-tests.md).

## Shell del espacio interno

`/home/**` y `/account/**` usan `components/home/AppShell.tsx` desde su `layout.tsx`: `<main>`,
`RequireAuth` y `SidebarNav`, cuyo `<nav>` es el landmark "Navegación principal". En
`/account/**` el sidebar marca Inicio. `app/home/admin/layout.tsx` agrega `RequireRole` para
ADMIN: sin ese rol muestra "Acceso no permitido" dentro del shell.

## Contratos iniciales

- `/`: landing previa al login, descripción del propósito y CTA de ingreso y registro.
- `/register`, `/login`: flujos para visitantes; cuentas autenticadas vuelven al espacio interno.
- `/forgot-password`, `/reset-password`: recuperación pública de cuenta.
- `/verify-email`: confirma el enlace SMTP y retira el token de la URL; no inicia sesión.
- `/resend-verification`: solicita un enlace para una cuenta pendiente, incluso anterior al cambio.
- `/home`: inicio protegido con saludo, estado vacío informativo y acceso al perfil.
- `/home/profesores`, `/home/comunidad`: secciones en preparación
  (Próximamente), sin llamadas a endpoints académicos.
- `/home/experiencias`: comentarios públicos para cuentas autenticadas, ordenados por publicación, con materia, comisión y período (TASK-061).
- `/home/materias`: catálogo paginado de materias únicas, con carrera, año y búsqueda independientes; agrupación por años y niveles de electivas en los metadatos (TASK-060).
- `/home/materias/[materiaId]`: detalle de materia y comisiones del período seleccionado, sin paso intermedio; historial y gestión de períodos solo ADMIN (TASK-061).
- `/home/materias/[materiaId]/cursadas/[cursadaId]`: comisiones de una cursada filtrables por chip de carrera, con listado de docentes asignados y cargos.
- `/home/materias/[materiaId]/cursadas/[cursadaId]/comisiones/[comisionId]`: experiencias y equipo docente debajo, administración de profesores solo ADMIN y selector de otras comisiones del período.
- `/home/admin`: panel de administración (solo ADMIN, como todo `/home/admin/**`).
- `/home/admin/materias/nueva`, `/home/admin/materias/[materiaId]/editar`: alta y edición de
  materias con asignación multicarretera (`carreras: MateriaCarrera[]`).
- `/home/admin/profesores/nuevo`: alta de profesores.
- `/home/admin/cursadas/nueva`: alta de cursada por materia y período (sin profesor responsable).
- `/home/admin/comisiones/nueva`: alta de comisión por cursada, carrera y número (1 a 999).
- `/home/admin/profesores`: listado paginado de consulta de los profesores cargados.
- `/home/admin/usuarios`: listado de consulta de las cuentas registradas.
- `/account`, `/account/change-password`: perfil y cambio de contraseña protegidos.
- `/health`: comprobación pública de estado (`app/health/route.ts`).
- `NEXT_PUBLIC_API_URL`: URL pública del backend.

## Landing y experiencia de cuenta

El registro informa que la cuenta queda pendiente de verificación. El estudiante debe abrir el
enlace recibido por correo antes de iniciar sesión; login y registro ofrecen acceso al reenvío.
Las rutas de verificación y reenvío usan `no-store` y `no-referrer`.

La landing presenta el propósito de compartir información entre estudiantes sobre materias
y profesores. El título, descripción y acciones están centrados. La navegación presenta
un botón con icono de cuenta únicamente cuando existe una sesión autenticada comprobada,
sin enlaces de secciones en la barra. Su desplegable ofrece Mi perfil, Cambiar contraseña
y Cerrar sesión. La landing no muestra el icono; los CTA permiten ingresar o registrarse.
El logo apunta a `/home` para cuentas autenticadas y a `/` para visitantes.
El botón anuncia su estado con `aria-expanded`;
Tab recorre las opciones nativas, Escape cierra y devuelve el foco al botón, y un clic fuera
cierra el desplegable. La comprobación y los errores temporales tienen mensajes y reintento.
El detalle de comisión permite consultar y compartir comentarios textuales. Las secciones
generales de Profesores y Comunidad siguen como funcionalidades futuras; Experiencias muestra los comentarios publicados de todas las comisiones.

`FeatureCarousel` utiliza perspectiva CSS y controles explícitos, sin reproducción automática
ni dependencias adicionales. Permite avanzar con flechas, elegir una tarjeta con botones y
utilizar ArrowLeft/ArrowRight/Home/End. Anuncia la selección y oculta las tarjetas inactivas
a lectores de pantalla. Con movimiento reducido se desactiva la animación y se muestra solo
la tarjeta activa. La presentación se adapta a móvil y escritorio.

Estilos: capas y tokens según [frontend-estilos.md](../docs/standards/frontend-estilos.md).
Formularios con etiquetas visibles,
foco de teclado, errores asociados y botones de envío bloqueados durante la petición.
Contraseñas nuevas: entre 8 y 128 caracteres Unicode, sin recortar ni normalizar, en registro,
restablecimiento y cambio. Login permite las credenciales existentes; el backend sigue siendo
la autoridad de validación. No se agregan fuentes remotas, analítica ni recursos de terceros.

Las cookies HttpOnly, CSRF, coordinación de renovaciones y revocación se conservan en los
servicios existentes. `/account` presenta únicamente los datos públicos en una tarjeta con
iniciales, nombre, email y rol legible. Las acciones aparecen debajo, fuera de la tarjeta.
Cambiar contraseña abre explícitamente `/account/change-password`, dentro del mismo shell,
con el formulario existente, el breadcrumb "Mi perfil › Cambiar contraseña" y un enlace de vuelta
al perfil; no se muestra junto a los datos. El perfil entra al shell (sidebar incluido) sin
cambiar sus URLs, para no perder la navegación al abrirlo desde el menú de cuenta.
`LogoutButton` comparte estados de envío, prevención de duplicados y errores recuperables entre
el menú y el perfil. Solo navega al login después de confirmar el cierre en el backend.
El retorno después del login permite únicamente `/home`, `/account` y `/account/change-password`.
Un destino ausente, inseguro o `/` lleva a `/home`. Un retorno explícito válido se conserva.
La pantalla de recuperación retira el token de la URL y lo conserva
únicamente en memoria mientras se completa el formulario. Toda la aplicación mantiene
`Referrer-Policy: no-referrer`.

## Separación pública e interna

`RequireGuest` evita mostrar la landing, login o registro durante la comprobación de sesión
y redirige las cuentas autenticadas al espacio interno. Ante un error temporal, landing y
registro permiten reintentar. Ir explícitamente al login permite comprobar nuevas credenciales
con una advertencia, sin declarar terminada la sesión anterior. Esto permite recuperarse
también de una renovación cuya respuesta no pudo confirmarse.

`/home` (`InicioSection`) presenta un saludo con el nombre público de la cuenta y un estado
vacío que explica qué funcionalidades llegarán al sistema. El menú lateral permanece fijo en
escritorio y se adapta a botones superiores en móvil, sin desbordamiento horizontal. Cada
sección del menú (`components/home/sections.ts`) es una ruta propia: Inicio, Profesores,
Materias, Experiencias, Comunidad y, solo para ADMIN, Administración. Profesores
y Comunidad muestran Próximamente (`UpcomingSection`); no llaman a endpoints académicos ni
presentan datos inventados. El enlace de la sección actual lleva `aria-current`, y el título de
cada pantalla recibe el foco al montar. El perfil se abre desde el menú de cuenta o Ver mi perfil. `RequireAuth`, vía `AppShell`, protege
el home, perfil y cambio; ante un error temporal muestra la pantalla "No pudimos comprobar tu
sesión" con Reintentar comprobación (la misma que usa `RequireGuest` en landing y registro). Los
guards del backend siguen siendo la autoridad de autenticación.

## Comandos

- `npm run dev:front`: inicia Next.js en desarrollo desde la raíz.
- `npm run build --workspace=front`: genera el build de producción.
- `npm run start --workspace=front`: sirve el build de producción.
- `npm run typecheck --workspace=front`: comprueba tipos TypeScript.
- `npm run lint --workspace=front`: corre ESLint (`front/eslint.config.mjs`: Next
  `core-web-vitals`, `react-hooks` y `jsx-a11y`) con `--max-warnings 0`; todas las reglas son
  error.
- `npm run test --workspace=front`: ejecuta las pruebas unitarias de Vitest.
- `npm run test:e2e --workspace=front`: ejecuta el harness Playwright; requiere la configuración
  y los servicios de prueba que documentó en su momento la tarea de integración de cuenta
  (`docs/tasks/finished/`). Incluye `visual.browser.spec.mjs`: capturas de referencia y análisis
  axe de las pantallas principales. Cómo y desde dónde se regeneran las capturas:
  [frontend-tests.md](../docs/standards/frontend-tests.md).

El workflow `.github/workflows/front.yml` publica el check `frontend-ci` y corre
`typecheck`, `lint`, `test` y `build` en cada PR hacia `desarrollo` o `main`, sin
filtros por archivos ni ejecución adicional al hacer push tras el merge. Solo
verifica; no despliega. Instala ambos workspaces con `npm ci` usando el lockfile
raíz: las pruebas de contrato del frontend importan filtros reales del backend
y requieren NestJS. La instalación permite hasta tres intentos con cinco segundos
entre fallos para tolerar cortes transitorios de descarga; si todos fallan, falla
el job. Los tests browser locales requieren el stack completo y no corren en este job.
DoD, protección de ramas y evidencia de aceptación en
[CONTRIBUTING.md](../CONTRIBUTING.md#integración-continua-y-definition-of-done).

Para levantar el stack completo, preparar el `.env` privado de la raíz según el
[README](../README.md) y ejecutar:

```powershell
docker compose -f docker-compose.dev.yml --profile mail up --build -d
```

Aplicación: `http://localhost:8080`. Buzón: `http://localhost:8025`. No crear `.env`
en `front/` para Compose ni combinar los archivos Compose de desarrollo y producción.
Las variables `NEXT_PUBLIC_*` se incorporan al build: un cambio requiere reconstruir
el frontend. Las instrucciones para ejecutar Next fuera de Docker están en el README.

## Cliente HTTP y coordinación de sesiones

- `services/http.ts` centraliza fetch con `credentials: include`, `cache: no-store`,
  timeout y errores seguros. Los POST agregan `X-CSRF-Protection: 1` y JSON; el navegador
  aporta Origin. El backend valida el origen exacto configurado. No hay endpoint para
  obtener un token CSRF ni lectura de cookies HttpOnly desde JavaScript.
- `requestJson` devuelve el cuerpo sin tipar. Cada servicio lo valida con su esquema Zod de
  `services/schemas.ts` (`protectedGet`/`protectedPost` reciben el esquema). Una respuesta con
  forma inesperada se convierte en `HttpError(502)` con mensaje en español, que las pantallas
  ya muestran con Reintentar (TASK-031).
- Los nombres de materia y período que muestran títulos y breadcrumbs salen del backend
  (`GET /materias/:id`, `GET /cursadas/:id`); la URL del recorrido lleva solo ids y el
  contexto del listado. Mientras llega el detalle se muestra "Cargando…".
- `services/auth.ts` ofrece registro, login, cuenta, recuperación, reset, cambio y logout.
  Ante un 401 en un GET protegido, comparte un intento de renovación y repite la consulta
  una sola vez. Un 403, error de red o 500 no genera una renovación automática. Login,
  registro, refresh y recuperación no se interceptan así.
- Las mutaciones no tienen un reintento genérico. Cambio de contraseña verifica la cuenta
  y solo admite recuperación ante un 401 del guard, que garantiza que no se ejecutó;
  las respuestas ambiguas no se repiten automáticamente.
- `services/session-coordinator.ts` usa un Web Lock común entre pestañas y comprueba
  `/auth/me` después de tomarlo: otra pestaña puede haber renovado la cookie. BroadcastChannel
  y eventos de almacenamiento comunican cambios. `localStorage` conserva únicamente un
  identificador de revisión y tipo de evento, nunca cuenta, JWT, refresh o contraseña.
- Login, logout, reset y cambio comparten el bloqueo de cookies. Un refresh 401 comunica
  sesión vencida. Un fallo temporal comunica renovación incierta y permite comprobar la
  cuenta o ingresar nuevamente, sin afirmar que el servidor terminó la sesión ni repetir
  a ciegas un token posiblemente consumido.
- La renovación automática exige Web Locks y almacenamiento local habilitado. Si no están
  disponibles, se muestra la limitación y se exige login al vencer el acceso; no se presenta
  una coordinación entre pestañas que el navegador no puede garantizar.

El estado central distingue comprobación inicial, cuenta autenticada, ausencia de sesión
y error temporal. Las pantallas permiten reintentar sin perder esas diferencias.
El rol de navegación proviene de la cuenta del backend; sus guards conservan la autoridad.
No existen módulos administrativos públicos de demostración.

## Recorrido de recuperación

Desde `/login`, abrir la recuperación e ingresar el email de una cuenta de prueba.
La respuesta siempre muestra el mensaje genérico del backend. Abrir Mailpit, seleccionar
el mensaje recibido y abrir el enlace de recuperación. Completar la nueva contraseña,
iniciar sesión nuevamente y comprobar el perfil. Después de cambiar la contraseña desde
el menú de cuenta también se exige un nuevo login y se revocan las sesiones anteriores.

El token del enlace permanece en memoria durante el formulario y se retira del historial.
Una recarga puede requerir abrir otra vez el enlace. No hay analítica, fuentes remotas
ni recursos de terceros en la pantalla. Mailpit demuestra recepción local del email;
no acredita entrega mediante un proveedor real.

Evidencia histórica de validación (conteos de tests, recorridos Chromium, fechas de
aceptación) en [CHANGELOG.md](../CHANGELOG.md) y en
[TASK-013](../docs/tasks/finished/TASK-013-home-interno.md) /
[TASK-011](../docs/tasks/finished/TASK-011-ux-landing-http-local.md).

## Materias: año de carrera y filtros (TASK-024)

El listado `/home/materias` consulta `GET /materias` con `anioCarrera` opcional y páginas de
9 elementos. El backend ordena antes de paginar; la vista agrupa por años 1 a 5,
Electiva y Sin año asignado para registros heredados. La URL conserva `anioCarrera` y
`page`; los enlaces al detalle trasladan la página como `listadoPage`, independiente
de la paginación de cursadas. Volver y breadcrumb restauran el listado filtrado.

services/materias.ts contiene el contrato HTTP dedicado; types/materias.ts define
los tipos, validations/materias.ts valida años y construye destinos internos,
y hooks/useMateria.ts carga el detalle con descarte de respuestas obsoletas.
academic.ts reexporta listarMaterias/crearMateria para consumidores existentes.
El tamaño predeterminado es 9; los formularios administrativos solicitan páginas de hasta
100 para cargar sus opciones completas. `useAllPages` mantiene un tope de 20 páginas y
devuelve error, sin opciones parciales, si no alcanza el total o recibe una página vacía
antes de completarlo (TASK-027).

MateriaDetail consume GET /materias/:id y GET /materias/:id/historial (3 entradas
por página), muestra datos, auditoría y cambios por campo con actor y fecha.
El enlace Editar requiere ADMIN y materia activa. La ruta administrativa
/home/admin/materias/:materiaId/editar utiliza el guard ADMIN ya existente.
El backend sigue siendo la autoridad de permisos y validación.

MateriaForm se reutiliza únicamente en alta y edición de materias. Exige nombre
recortado, sin controles y de hasta 150 caracteres, y un año de 1 a 5 o ELECTIVA.
POST /materias recibe ambos campos y regresa al listado con successMessage.
PATCH /materias/:id recibe solo diferencias reales; sin cambios no hay petición.
Antes del PATCH se comprueba la sesión mediante el servicio existente; la mutación
no se repite automáticamente. Al guardar edición se vuelve al detalle con
successMessage y el contexto del filtro. Los errores se muestran con reintento
en consultas y preservan los valores del formulario para corregir o reenviar.

## Búsqueda y niveles de electivas (TASK-025)

Casos y resultados verificados en la
[matriz de trazabilidad TASK-025](../docs/tasks/finished/TASK-025-busqueda-materias-niveles-electivas.md#matriz-de-trazabilidad-de-casos-probados).

El listado permite buscar por nombre con envío explícito mediante Buscar. El criterio `q`
se recorta, admite hasta 150 caracteres y rechaza caracteres de control. Desde TASK-060
se combina con carrera y año de manera independiente, sin chips ni selector de nivel.
Limpiar filtros retira todos los criterios y reinicia la página. El nivel de electiva
se muestra en los metadatos y se conserva si llega en una URL de Electivas; cambiar a
un año obligatorio lo elimina. El backend filtra antes de paginar.

`MateriaContext` y los constructores de destinos de `validations/materias.ts`
conservan `q`, `anioCarrera`, `nivelElectiva` y página a través de detalle,
edición, cursadas, comisiones, breadcrumbs y Volver. Las firmas anteriores de los
constructores siguen funcionando; el contexto adicional es opcional.

`Materia` incorpora `nivelElectiva`: `3`, `4`, `5` o null para registros heredados.
Alta y edición muestran y exigen el nivel únicamente para Electiva. Al convertir
una electiva en obligatoria se envía null cuando corresponde para limpiar el
valor anterior; el backend también normaliza la consistencia. La edición conserva
el envío de diferencias y evita solicitudes cuando no hay cambios. Listado y
detalle muestran el nivel; el historial presenta los campos y sus valores con
etiquetas legibles, incluido el nuevo valor null al limpiar el nivel.

Desde TASK-060 la sección de filtros muestra dos selects nativos (Carrera y Año de la
carrera) y un buscador con icono y envío explícito. En pantallas pequeñas los selects
comparten una fila y la búsqueda ocupa todo el ancho. Los estilos siguen aislados en
`components/academic/MateriasList.module.css`, sin modificar estilos base.

Casos probados, correspondencia con criterios de aceptación, resultados y recorrido manual:
[matriz de trazabilidad TASK-024](../docs/tasks/finished/TASK-024-filtros-materias-anio-carrera.md#trazabilidad-de-casos-probados).

## Carreras, comisiones y profesores asignados (TASK-042)

La jerarquía académica adopta el nuevo modelo de dominio:

- **Carreras en materias**: `Materia` modela `carreras: MateriaCarrera[]` (`carrera`, `anioCarrera`,
  `nivelElectiva`). El selector de carreras de `/home/materias` permite navegar "Todas" o una carrera
  específica. Desde TASK-060, año y carrera se combinan de forma independiente y el listado
  siempre agrupa por años (1 a 5 y Electivas), con metadatos de las asociaciones relevantes.
- **Formularios de materias**: `MateriaForm` permite marcar una o más carreras con checkboxes. Para cada
  carrera marcada se define año y opcionalmente nivel si es electiva. Valida que al menos una carrera
  esté tildada y advierte en caso de discrepancia de años entre carreras.
- **Cursadas**: no tienen profesor asignado ni campo `profesorId`. Su resumen y detalle exponen
  `cantidadComisiones`, `cantidadProfesores` y `letrasCarreras` (ej. "S, C").
- **Comisiones y carreras**: cada comisión pertenece a una carrera (`carrera`) y tiene un número entero
  (1 a 999), construyendo su código identificador como `<Letra>-<Número>` (ej. `S-31`).
  `/home/materias/[materiaId]/cursadas/[cursadaId]` permite filtrar comisiones por chips de carrera
  (client-side a partir de `pageSize=100`) y muestra para cada comisión sus profesores con cargo docente
  (`TITULAR`, `ASOCIADO`, `ADJUNTO`, `JTP`, `AYUDANTE`).
- **Detalle de comisión**: `/home/materias/[materiaId]/cursadas/[cursadaId]/comisiones/[comisionId]`
  permite consultar la comisión, ver los profesores asignados con sus cargos, acceder a otras
  comisiones de la cursada y ver el placeholder de experiencias ("Próximamente"). Para administradores
  (rol ADMIN), ofrece controles en línea para asignar nuevos profesores con su cargo, modificar el
  cargo docente o desasignar profesores.
- **Alta de comisiones**: `AltaComision` filtra el combo de carreras según las carreras habilitadas
  en la materia elegida, valida el número entre 1 y 999 con paridad con el backend y muestra
  previsualización en vivo del código de la comisión.

## Rediseño de pantallas académicas y administración (TASK-043)

Las pantallas siguen el canvas *Style Guide 2026-UTN-GRUPO-01* (Page 2):

- `/home/materias`: el ADMIN tiene un botón "Nueva materia" que abre `ui/Dialog` con el cuerpo de
  `MateriaForm`. Al crear, el diálogo se cierra, aparece un aviso `role="status"` y el listado se
  recarga con `refreshKey`, sin navegar. `/home/admin/materias/nueva` queda como respaldo. Los
  grupos por año tienen un h2 con insignia y la cantidad de materias.
- Detalle de materia: Volver, breadcrumb y h1 desde `PageHeader`, con insignias. Se quitan las
  cards "Datos de la materia" y "Auditoría". Las cursadas se agrupan por año. El historial pasa a
  una línea de tiempo y sigue visible para todos, con `actorId`.
- Cursada (`ComisionesList`): eyebrow con la materia y h1 con el período. Comisiones en tarjetas.
- Comisión: h1 "Comisión X". "Datos de la comisión" es solo para ADMIN y se muestra como `<dl>`.
  El ADMIN conserva la edición de cargo y "Quitar" en cada fila. El enlace "Asignar profesor"
  lleva el foco al formulario de asignación.
- Los enlaces de alta precargan por query: "Nueva cursada" pasa `?materiaId=` y "Nueva comisión"
  pasa `?cursadaId=`. `AltaCursada` y `AltaComision` leen el parámetro (sus páginas van envueltas
  en `Suspense`), y `ui/FormField` acepta `defaultValue`.
- `/home/admin`: "Oferta académica" (Materias, Cursadas, Comisiones, Profesores) y "Cuentas y
  moderación". "Ver todas" de cursadas y comisiones lleva a `/home/materias`, porque no hay
  listados globales.
- `hooks/useIsAdmin.ts` reemplaza las comparaciones de rol escritas a mano.
- Clases compartidas `academic-*` en `styles/components/academic.css`; piezas comunes en
  `components/academic/detalle.tsx`.

Esta sección reemplaza la descripción de `MateriaDetail` de TASK-024. Lo omitido figura en
[TASK-043](../docs/tasks/finished/TASK-043-front-rediseno-academico.md#resultado).

## Accesos rápidos, historial con hito de alta y modal de cursada (TASK-054)

- `/home/admin`: en viewport mobile (`≤600px`) aparecen dos links de ancla ("Oferta académica" /
  "Cuentas") arriba del contenido; en desktop no se muestran.
- El historial de materia muestra un avatar con las iniciales del actor (en vez del ícono de lápiz
  fijo) y, como última entrada de la última página, un hito fijo "Alta de la materia" con
  `materia.createdAt`, sin actor ni diffs.
- `CursadasList`: las carreras de cada cursada se muestran como chips de una letra
  (`academic-tag`), no como texto separado por comas.
- Desde el detalle de materia, "Nueva cursada" abre un `Dialog` con `AltaCursada materiaId={…}`
  (materia ya fija, sin selector); al crear, el modal se cierra y el listado se recarga con
  `refreshKey`, sin navegar. `/home/admin/cursadas/nueva` sigue intacta como ruta directa, con
  `AltaCursada` leyendo `?materiaId` cuando no recibe la prop.

## Comentarios por comisión (TASK-057)

El detalle de comisión incluye un listado de experiencias paginado de nueve elementos y
comprueba por separado si la cuenta ya tiene una publicación vigente. USER y ADMIN pueden
publicar, con el mismo límite de un comentario vigente por usuario y comisión, incluso
si es anónimo o se refiere a otro docente. Después de eliminarlo se puede volver a publicar.
Una comisión inactiva conserva la consulta y el retiro propio, pero no permite publicar ni editar.

Rutas del módulo bajo el shell autenticado existente:

- `/home/feedback/nuevo?comisionId=...`: formulario contextual. Con un único docente se
  asocia automáticamente; con varios se elige uno o la comisión en general; sin docentes
  se comenta la comisión. El alta vuelve al detalle de comisión con `successMessage`.
- `/home/feedback/[feedbackId]`: comentario, contexto de comisión/período, auditoría,
  edición propia si la comisión está activa y eliminación propia con confirmación.
  El historial se muestra exclusivamente al autor y pagina de tres en tres.
- `/home/feedback/[feedbackId]/editar`: edición propia de texto y anonimato. Conserva la
  referencia docente original, envía solo diferencias y no llama al backend si no hay cambios.
  Vuelve al detalle del comentario con `successMessage`.

`services/feedback.ts` consume los endpoints de comentarios de comisión, detalle, comentario
propio e historial. `feedback-schemas.ts` valida las respuestas y rechaza autores visibles
en comentarios anónimos. Los tipos viven en `types/feedback.ts`; las validaciones y URLs
del módulo en `validations/feedback.ts`. El texto se recorta y acepta entre 1 y 3000 puntos
de código, sin controles salvo tabulación y saltos de línea. React lo presenta como texto,
sin interpretar HTML. No se envían identificadores de autor desde formularios.

`components/feedback/` contiene formulario, detalle, tarjetas, bloque de comisión y el hook
local `useFeedbackResource`, que descarta respuestas de rutas anteriores y permite reintentar.
Reutiliza paginación, formularios y primitivas existentes sin modificar hooks compartidos,
autenticación, layout ni estilos base. El CSS Module usa tokens existentes.
Los errores conservan el formulario y ofrecen feedback visible; el envío se bloquea ante
doble clic y la eliminación requiere confirmación accesible.

La búsqueda de docentes, las consultas agrupadas por docente, los controles administrativos
de estado y la moderación quedan fuera de esta entrega. Profesores sigue como Próximamente.

### Presentación de Experiencias en comisión (TASK-058)

El bloque distingue encabezado y acción principal, aviso del límite con icono informativo y
tarjetas de comentarios. El texto completo conserva saltos de línea; autor, referencia docente,
fecha y marca de edición aparecen como contexto secundario. Los botones del bloque navegan
al formulario o al comentario mediante el router, sin enlaces dentro del listado ni repetir
el vínculo a la comisión actual. Se mantienen los estados de carga, error, vacío e inactividad
y la paginación de nueve. Este ajuste no modifica el detalle individual ni los formularios.

### Detalle centrado en la comunidad (TASK-059)

El nombre de la materia encabeza la página; carrera y año se muestran con la clasificación
real recuperada por el endpoint existente de materia. Comisión y período aparecen debajo.
Los breadcrumbs se simplifican solo en esta página mediante ComisionDetail.module.css.
Un selector reemplaza la tarjeta Otras comisiones, conserva contexto de navegación y distingue
carga, error y comisión única. No se agregan endpoints ni vínculos a perfiles inexistentes.

Experiencias ocupa la columna principal; Equipo docente usa una lista compacta en lateral de
260 px. Hasta 1000 px se apilan las columnas. Se conservan las acciones ADMIN dentro de
Gestionar equipo docente. El total de comentarios sale del total paginado, no del tamaño
de la página; las tarjetas muestran identidad pública/anonimato, fecha, destinatario y texto.
El propio se identifica con un acento azul y una única acción Administrar mi comentario.
Los comentarios ajenos se leen en la lista y no acceden al detalle privado; el backend
rechaza ese acceso con 403. La ayuda de reglas usa un details/summary nativo, sin modal nuevo.

La pestaña del navegador conserva siempre Profesor Butchery: metadata raíz con default y
template constantes, sin asignaciones document.title al cargar materias o comisiones.
Esta política no cambia los encabezados visibles ni la navegación global.

## Catálogo de materias con filtros independientes (TASK-060)

`MateriasList` muestra exactamente tres criterios: Carrera, Año de la carrera y Buscar por
nombre. Carrera y año son selects siempre disponibles; la búsqueda usa envío explícito,
con icono `Search` de `lucide-react`, sin consultas por pulsación. Limpiar filtros elimina
criterios y paginación. Los cambios individuales mantienen los otros criterios aplicados
y vuelven a la primera página. En móvil se presentan los dos selects en una fila y el
buscador a todo el ancho. El nivel de electiva ya no es un control adicional del catálogo.

El servidor pagina nueve materias únicas en orden alfabético estable por nombre e id.
La pantalla proyecta las asociaciones de esa página en todos los años que correspondan:
una materia compartida puede repetirse en dos grupos, pero aporta una unidad al total y
al rango mostrado. No se descarga el catálogo completo ni se elige el menor año.
Cada fila muestra únicamente las carreras relevantes para ese grupo y los filtros activos;
Electivas añade el nivel de cada asociación relevante. Las asociaciones completas se
conservan en el contrato para el detalle. La agrupación siempre está disponible, incluso
sin seleccionar carrera. Los registros sin asociaciones se muestran aparte sin filtros.

Cada grupo presenta una lista blanca compacta con separadores suaves. Toda la fila es
un `Link` nativo al detalle, con nombre, metadatos y `ChevronRight` decorativo; conserva
clic normal, nueva pestaña, foco de teclado y contexto de retorno. URLs y service aceptan
año sin carrera, incluida la navegación entre listado, detalle y edición. Los enlaces
antiguos con nivel siguen siendo válidos para Electivas, incluso sin carrera.

`MateriasResults` compone el hook existente `usePaginatedFetch`, `Notice` y `Pagination`
directamente para disponer del total real también en estados vacíos o páginas agotadas.
Muestra carga y reintento, evita informar cero ante una página fuera de rango y ofrece
volver a la primera página. No modifica los hooks ni las primitivas compartidas.
El alta administrativa continúa en el diálogo existente y recarga el listado tras guardar.

El menú compartido `SidebarNav` utiliza `NavigationIcon` con importaciones nominales de
`lucide-react`: House (Inicio), Users (Profesores), BookOpen (Materias), MessageSquare
(Experiencias), UsersRound (Comunidad) y LayoutGrid (Administración). La librería se
incorporó por pedido explícito del usuario en TASK-060. Los iconos son decorativos,
de 18 px y trazo uniforme; las etiquetas accesibles, rutas, permisos y `aria-current`
se conservan. `SidebarNav.module.css` ajusta únicamente radio, separación y acento activo,
sin modificar el layout responsive compartido ni los estilos base.

## Acceso directo a comisiones y lectura transversal (TASK-061)

`MateriaDetail` integra `ComisionesMateria`: el contenido principal son las comisiones y la
cursada es un selector de año. El valor inicial es el más reciente (año descendente),
salvo un `cursadaId` válido en la URL. Se cargan
las opciones de períodos mediante el endpoint existente paginado de cursadas; las comisiones
se solicitan únicamente para el período elegido, de nueve en nueve. No se descargan todas
las comisiones ni se aplica un filtro parcial de carrera a la página recibida.

`cursadaId` y `comisionesPage` mantienen período y página en la URL, sin alterar el contexto
del catálogo (`carrera`, `anioCarrera`, `listadoPage`, `q`, `nivelElectiva`). Al cambiar de
cursada se reinicia la página. Los enlaces nativos de comisión llevan ese contexto; el detalle
de comisión vuelve a la materia con el período que corresponde. Las URLs anteriores de
cursada y comisión siguen disponibles. No cambia la relación de datos: cada comisión sigue
perteneciendo a una cursada concreta y conserva sus comentarios históricos.

Para ADMIN, Nueva comisión precarga el período seleccionado. Gestionar períodos abre el
listado administrativo existente `CursadasList` con Nueva cursada; se monta al desplegar para
evitar consultas mientras permanece cerrado. Su callback opcional `onCreated` permite
refrescar las opciones luego del alta sin modificar hooks compartidos. El historial de materia
conserva su permiso y paginación. Hay estados diferenciados de carga, error/reintento,
ausencia de períodos, ausencia de comisiones y página agotada; las respuestas tardías de un
período previo se descartan mediante la identidad del recurso y limpieza del efecto.

`/home/experiencias` usa `ExperienciasList` dentro de Suspense y `listarFeedback` del service
dedicado, que consume `GET /feedback` autenticado. Lista nueve comentarios por página, con
total real y orden de publicación descendente del servidor. No crea publicaciones distintas:
las mismas experiencias se leen desde su comisión o desde este listado transversal.
`ExperienceCard` comparte la presentación con `ComisionFeedback`: identidad pública o
anonimato, fecha, destinatario, texto con saltos de línea y acento para el comentario propio.
En el listado general añade materia, comisión y período del snapshot, junto con Ver comisión.
Solo `propio` muestra Administrar mi comentario, hacia el detalle privado existente; los
comentarios ajenos no enlazan a ese detalle. No agrega votos, valoraciones ni filtros globales.
Inicio y la descripción de la sección reflejan estas funcionalidades disponibles.

`ComisionDetail` presenta Experiencias y luego Equipo docente en una sola columna, también
en escritorio. El equipo mantiene sus acciones administrativas en el desplegable existente.
Breadcrumbs y botón de regreso van al detalle de materia con `cursadaId` real y la página de
comisiones de origen. No se requiere pasar por la pantalla de cursada para leer comentarios.

## Modalidad de materia y presentación académica (TASK-062)

`Materia` incorpora `modalidad`: ANUAL, PRIMERO o SEGUNDO. Las etiquetas distinguen Anual
y Cuatrimestral con primer o segundo cuatrimestre; null se presenta como Modalidad sin
definir, sin asumir una modalidad para datos antiguos. `MateriaForm` exige esta selección
en altas y ediciones, independientemente de carreras, año o electiva. `MateriaFormPage`
reutiliza ese mismo formulario. La edición envía solo diferencias; cambiar únicamente
modalidad conserva las asociaciones de carrera/año, incluidas las que difieren entre sí.
Los cambios de modalidad se consumen en el historial con su etiqueta legible.

El service y los esquemas validan modalidad; las lecturas toleran su ausencia en respuestas
antiguas, mientras el backend actualizado siempre devuelve valor o null. Los datos de
materia se muestran en catálogo, detalle y comisión. No existe un filtro nuevo por modalidad.

Los contratos públicos `Cursada`, `CursadaResumen` y `CursadaDetalle` identifican solamente
el año, con unicidad materia/año. `AltaCursada` envía materiaId y anio, sin cuatrimestre;
la etiqueta `periodoLabel` devuelve solo el año. Los listados y el selector de comisión
siguen usando los mismos endpoints y preservan IDs, paginación y contexto de retorno.

`ComisionesMateria` reutiliza la grilla y las tarjetas compactas de `ComisionesList`, con
nombre destacado, carrera y docentes por fila. Las tarjetas conservan enlaces nativos,
foco visible y tamaño flexible para nombres largos. Los selectores mantienen semántica
nativa con apariencia controlada, bordes neutros, fondo blanco y chevron Lucide decorativo.
`ComisionDetail` usa el breadcrumb compartido, sin sus overrides locales anteriores, para
mantener el estilo entre niveles. No se modifican estilos base ni primitivas globales.

### Formulario de experiencias (spec ampliado de TASK-062)

`FeedbackForm` limita el contenido a 880 px y usa un contexto compacto con BookOpen y una
única superficie blanca. Destinatario, texto e identidad pública son bloques separados.
La referencia usa radios nativos hasta tres opciones y selector para más. Con un único
docente se conserva la asociación automática existente; al editar, la referencia es fija.
Las opciones muestran cargos reales, permiten foco de teclado y tienen etiquetas completas.

La identidad se representa con dos radios (nombre público de la sesión o Anónimo), adaptados
al booleano `anonimo` existente. La aclaración confirma que la cuenta permanece vinculada.
El contador calcula puntos de código sobre el texto recortado, igual que backend; no usa
maxlength UTF-16 ni live region por carácter. Valida vacío, controles y más de 3000 caracteres
sin borrar contenido. El hook de envío existente previene duplicados y conserva errores.

Cancelar vuelve al detalle de origen; si cambió texto, referencia o identidad, abre el Dialog
compartido para descartar o seguir escribiendo. El contexto de catálogo, año/página de comisiones
y página de comentarios se conserva mediante una lista explícita de parámetros académicos;
no se aceptan destinos externos. Publicación y edición mantienen su navegación de éxito.
Los iconos Send/LoaderCircle indican envío; campos y cancelación permanecen deshabilitados
mientras se guarda. La animación respeta prefers-reduced-motion.

El contexto del formulario presenta modalidad y año reales; para comentarios previos toma
su snapshot, sin atribuirles la modalidad actual de la materia. `feedbackSchema` admite la
modalidad del snapshot y el cuatrimestre legado nullable. Las tarjetas muestran año y
modalidad por separado. El menú lateral y la navegación general no se modifican.
## Administración HU-11 (TASK-055)

La portada `/home/admin` conserva las tarjetas de oferta académica y cuentas. Sus enlaces
Ver todas abren tablas administrativas en `/home/admin/materias`, `/profesores`, `/cursadas`,
`/comisiones` y `/usuarios`. Las cuatro primeras muestran acciones Editar por fila y creación
sobre la tabla; Usuarios es de consulta, sin edición ni gestión de roles. Materias pagina de
a nueve y los otros listados de a veinte. Las rutas permanecen bajo el guard ADMIN existente.

Cursadas requiere seleccionar materia; Comisiones requiere materia y cursada. Los listados
usan las consultas anidadas existentes, `useUrlPagination` y `PaginatedListView`, sin endpoints
globales nuevos. La selección se conserva mediante `materiaId`, `cursadaId` y `page` en la URL;
cambiar materia limpia cursada y reinicia la página. Los catálogos de opciones usan páginas
de hasta cien y el límite de recursos existente de `useAllPages`.

Las altas cortas de materia, profesor y cursada se abren en `Dialog`, reutilizan los formularios
actuales y refrescan mediante `refreshKey`, sin remontar el listado ni cambiar sus filtros.
Comisión conserva su página de alta con carrera y número. Las páginas de alta/edición reciben
`returnTo`, limitado por `validations/admin.ts` a los cinco listados y sus parámetros admitidos.
Guardar y cancelar recuperan ese contexto. Sin `returnTo`, las altas conservan su recorrido
anterior. Los modales y altas del recorrido académico permanecen disponibles.

Nuevas rutas de edición: `/home/admin/profesores/:id/editar`, `/cursadas/:id/editar` y
`/comisiones/:id/editar`. `EditarAcademico` usa los detalles actuales, campos precargados,
`useFormSubmission`, `FormField` y `Notice`. Profesor edita su nombre; Cursada edita materia,
año y cuatrimestre, sin profesor; Comisión edita carrera y número, sin cambiar cursada,
profesores ni `activa`. Solo se envían diferencias. Cambiar materia en una cursada dirige al
listado de la materia destino, página uno; las incompatibilidades de carreras se muestran
como error del backend, preservando los datos ingresados. La edición/historial de materia
conserva su implementación actual.

`services/admin-academic.ts` valida GET/PATCH con los esquemas de respuesta existentes. Los
PATCH comprueban sesión y no repiten escrituras ambiguas. Las tablas usan estilos locales
`AdminTables.module.css` con tokens, sin cambios de layout, autenticación, hooks compartidos,
primitivas globales ni estilos base. No se agregan bajas ni gestión de roles.

La ampliación de TASK-055 admite `ANUAL` además de `PRIMERO` y `SEGUNDO`, manteniendo
`cuatrimestre` como nombre del campo HTTP. En alta y edición la etiqueta visible es Período;
los listados y detalles muestran, por ejemplo, «Anual 2026». Los esquemas Zod y formularios
aceptan los tres valores, incluidas las altas dentro de modal.

MateriaForm selecciona una o varias carreras mediante un selector nativo múltiple, controlado
por `selectedCarreras`, con las cinco carreras disponibles, instrucciones para teclado y
validación accesible. La edición conserva la selección existente; enviar sin carreras enfoca
ese selector. Se mantienen las reglas actuales de año/nivel y el contrato `carreras` de la API.
