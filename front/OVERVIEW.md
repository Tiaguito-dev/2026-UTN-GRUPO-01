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
- `/home/admin/materias`, `/home/admin/cursadas` y `/home/admin/comisiones`: las listas y detalles administrativos preservan el contexto de filtros/página y construyen breadcrumbs desde las asociaciones reales; al gestionar cursadas o comisiones, Materias queda activa en el sidebar. Los destinos de retorno son internos y se validan contra la entidad padre.
- `/home/admin/profesores`: listado paginado de consulta de los profesores cargados.
- `/home/admin/usuarios`: listado con estado, filtros y administración del acceso de las cuentas registradas.
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
- `/home/feedback/[feedbackId]`: Tu comentario, tarjeta privada con materia/contexto,
  texto, identidad pública y fechas; edición propia si la comisión está activa y
  eliminación con confirmación. El historial privado es desplegable y pagina de tres en tres.
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
sobre la tabla; Usuarios permite desactivar y reactivar cuentas, sin gestión de roles. Materias pagina de
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
año y cuatrimestre, sin profesor; Comisión edita carrera y número, sin cambiar cursada
ni `activa`. Solo se envían diferencias. Cambiar materia en una cursada dirige al
listado de la materia destino, página uno; las incompatibilidades de carreras se muestran
como error del backend, preservando los datos ingresados. La edición/historial de materia
conserva su implementación actual.

TASK-057 agrega la gestión de docentes dentro de la edición de comisión mediante
`academic/DocentesComision`, compartido con el detalle académico. Permite asignar profesores
registrados, cambiar TITULAR/ADJUNTO/JTP y desvincular sin eliminar entidades, solo para ADMIN.
Cada operación guarda inmediatamente mediante los PUT/DELETE existentes, por separado de
carrera y número; el estado y el éxito cambian únicamente tras confirmación del servidor.
Ambos formularios bloquean sus guardados mientras el otro está enviando. El selector carga
el catálogo completo mediante `useAllPages`, excluye docentes ya asignados y muestra carga,
errores y reintentos, sin publicar opciones incompletas. Se conservan los guards existentes.
La asignación vive en una sección plegable inicialmente abierta, sin acceso superior repetido;
se cierra tras la confirmación del servidor y devuelve el foco a su título. El listado y el
éxito permanecen visibles; se puede reabrir para asignar otro profesor y los errores conservan
el formulario abierto. En edición administrativa la tarjeta tiene separación local de los
botones de datos de comisión.
La integración con desarrollo conserva el detalle de experiencias y su equipo docente con
enlaces administrativos. En ese detalle el editor compartido usa la presentación de gestión
desplegable existente; sus operaciones confirmadas refrescan equipo, detalle, opciones de
comisiones y auditoría. Las comisiones dadas de baja conservan la consulta del equipo sin
controles de escritura ni consultas al catálogo docente. La edición conserva el contexto de
carrera única automático y vuelve al detalle administrativo con su destino de retorno.

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

### Breadcrumbs compartidos (TASK-063)

`components/ui/Breadcrumb` compone el regreso y la navegación semántica para todas las
pantallas que ya tienen recorrido. `PageHeader` delega en él; administración y cambio de
contraseña reutilizan la misma presentación. `BackLink` y los separadores usan Lucide.
La única hoja `styles/components/breadcrumb.css` define superficie blanca, borde, selección
azul, foco y ajuste de nombres completos. Usa los tokens originales del sistema, incluido
el borde #D8E0ED; se retiraron los overrides locales del formulario de comentarios.

Cada pantalla entrega sus entidades y enlaces. `feedbackNavigation` completa materia y
comisión en publicación, detalle privado y edición con los filtros y las páginas académicas.
La edición conserva el contexto tanto al guardar como al cancelar. Si se abre un comentario
desde Experiencias, el regreso y la eliminación retornan a su página del listado general;
ese origen se representa por un identificador permitido, nunca por una URL arbitraria.
Sin origen explícito válido, Breadcrumb regresa al último ancestro enlazado o a `/home`.

### Identidad académica y comisiones de materia (TASK-064)

`lib/format/carrera.ts` centraliza las denominaciones formales; `validations/materias.ts`
conserva sus exports para consumidores existentes de Materias, administración y contexto de
Experiencias. Los nombres breves siguen disponibles para filtros compactos del catálogo.
Detalle y metadatos del listado usan nombres formales. El detalle calcula Básica con las
asociaciones completas cuando hay varias carreras; con una sola, muestra su denominación.
`materiaAnioLabel` elige el año/nivel de la carrera seleccionada, o un año común; cuando difiere
muestra Año según carrera. Electivas con niveles distintos informan Nivel según carrera.

`ComisionesMateria` recibe las asociaciones completas desde MateriaDetail. Carrera única
es contexto fijo; con varias, usa únicamente una carrera válida en la URL o espera selección,
sin consultar todas las tarjetas. Carrera y Año de cursada se muestran juntos y actualizan
`carrera`, `cursadaId` y `comisionesPage`; cambios de filtros reinician solo la página de
comisiones. Un ID de cursada explícito inexistente informa el estado sin elegir otro año.
Se conserva búsqueda y contexto del catálogo en los enlaces al detalle y su regreso.

El service envía carrera al endpoint paginado por cursada, nueve resultados por página;
el total y el vacío corresponden a esa combinación. Los períodos siguen identificados por
su ID real, sin mezclar sus experiencias. La modalidad anual/cuatrimestral de materia se
conserva. No hay filtrado local de comisiones. Las tarjetas completas son enlaces nativos
con código unido, denominación formal, docentes/cargos y grilla de mínimo aproximado 300 px,
adaptada al ancho disponible y sin altura mínima artificial. Solo usan los tokens actuales.

### Filtros y lectura de Experiencias (TASK-065)

`ExperienciasList` consume GET /feedback con `carrera`, `materiaId`, `page` y nueve elementos.
Los filtros viven en URL, se combinan en servidor y reinician página al seleccionar o limpiar.
No filtra la página en memoria. Carrera corresponde a la comisión; una materia compartida
mantiene separadas sus experiencias. Total y rango usan la respuesta paginada real.

`ExperienciasMateriaSelector` ofrece un desplegable nativo con búsqueda por nombre, botones
de selección y paginación remota de nueve opciones. Usa listarMaterias con carrera opcional,
validación de búsqueda existente y debounce de 300 ms; solo consulta opciones al abrirse.
La materia seleccionada se resuelve por ID, independientemente de la página del selector.
Al cambiar carrera comprueba las asociaciones completas antes de mantenerla o limpiarla;
un error permite reintentar sin perder los filtros. Escape y salida de foco cierran el
selector, y elegir devuelve el foco a su control. Incluye carga/error/vacío recuperables.

`ExperienceCard` mantiene identidad pública (Anónimo incluso para el autor), contexto real,
texto con saltos de línea y palabras largas, enlace de materia y acciones existentes.
Solo `propio` habilita Administrar mi comentario. Colores, radios y superficies usan tokens.
El service acepta `contexto.carrera` de forma compatible con respuestas previas; el backend
actual siempre devuelve ese código real, que se muestra con la correspondencia formal.

`experienciasOrigin` y `experienciasBack` conservan filtros y página como `origen=experiencias`,
`experienciasCarrera`, `experienciasMateriaId` y `experienciasPage`, separados del contexto
académico. Comisión, cambio de comisión, publicación y administración conservan este origen;
el regreso de materia también lo reconoce. No se admiten URLs arbitrarias de retorno.

### Administración del comentario propio (TASK-066)

`FeedbackDetail` usa el título Tu comentario y el breadcrumb compartido con materia y comisión
reales. Reutiliza `feedbackNavigation` para el regreso filtrado y el enlace de materia; este
último también conserva el origen de Experiencias. La edición mantiene ese contexto tanto
al cancelar como al guardar. Los labels del recorrido de edición identifican Tu comentario.

`FeedbackCard` presenta una única superficie privada: acciones provistas por el detalle,
materia enlazada (26 px), comisión/carrera formal/período de publicación, destinatario y texto
multilínea (19 px, 16 px móvil, interlineado 1.75). Metadatos en el pie: publicación, última
edición solo cuando updatedAt es posterior a createdAt e identidad pública de la respuesta.
Anónimo se conserva incluso para el autor. No se consulta la identidad privada de su cuenta.
La anterior tarjeta de auditoría no se renderiza; registros, endpoints y permisos permanecen.

`FeedbackHistoryDisclosure` usa details/summary nativos, cerrado inicialmente, con aviso de
privacidad enlazado mediante aria-describedby. Monta el `FeedbackHistorial` existente solo
al abrir: consulta real, tres versiones por página, fecha/contenido, carga/error/reintento/vacío.
Cerrar retira las versiones de la vista y reabrir comienza en la primera página. No hay
una segunda copia permanente del comentario ni solicitudes de historial iniciales.

Editar (Pencil, secundario azul) y Eliminar (Trash2, rojo discreto) están dentro de la tarjeta;
se distribuyen en móvil sin solaparse. Comisión inactiva solo permite retiro. La confirmación
usa Dialog, conserva prevención de duplicados, cancelación con foco al activador y mensaje
de error para reintentar sin perder contenido. Una respuesta sin propio tampoco renderiza
contenido/acciones/versiones; esto complementa la autorización obligatoria del servidor.
Estilos limitados al módulo, con los tokens vigentes y sin nuevas dependencias.

### Compatibilidad con desarrollo (TASK-067)

El contrato actual conserva año y período de Cursada: PRIMERO, SEGUNDO o ANUAL. Reemplaza la
limitación por materia/año descripta en TASK-062. Materia conserva su campo de modalidad;
para identificar una comisión o publicar, el período explícito de su cursada tiene prioridad.
Los registros legados sin período no se reinterpretan. Se muestran Sin período definido y
pueden corregirse desde el editor administrativo seleccionando un valor real.

Los listados/editores de Administración incorporados desde desarrollo se mantienen, incluido
el selector múltiple de carreras, retorno seguro al listado y sus filtros/página, y edición
de profesor, cursada y comisión. MateriaFormPage conserva ese retorno junto al breadcrumb
compartido. Los formularios de materia conservan el campo Modalidad de esta rama.

ComisionesMateria diferencia las opciones del mismo año por período e ID, con orden estable;
selección explícita de cursada y carrera se conserva en URL y se consulta en servidor. El
flujo estudiantil sigue materia > comisión, con cursada como filtro. Experiencias conserva
filtros, paginación, autoría y anonimato; el detalle privado mantiene historial bajo demanda.

### Recorridos por rol (TASK-068)

`lib/navigation.ts` centraliza inicio por rol, destinos internos seguros y equivalencias entre
rutas estudiantiles y administrativas. Login usa el rol de la cuenta devuelta por el servidor;
la sesión recuperada usa el mismo criterio. `RoleRouteBoundary`, dentro del guard de sesión,
resuelve ADMIN antes de montar contenido estudiantil. `/account` conserva perfil y contraseña.
El menú y la marca utilizan el mismo inicio; el menú administrativo incluye Inicio, Materias,
Profesores, Usuarios y Experiencias. Mantiene la distribución responsive existente.

Las nuevas rutas `/home/admin/materias/[materiaId]`, `/profesores/[profesorId]`,
`/cursadas/[cursadaId]` y `/comisiones/[comisionId]` (todas bajo `/home/admin`) reutilizan
consultas, edición, historial de materia y gestión de equipo existentes. Los enlaces del
catálogo administrativo y sus relaciones usan estas rutas. Breadcrumb compartido comienza
en Administración; `returnTo` valida un origen interno administrativo y conserva filtros.

`/home/admin/experiencias` reutiliza `ExperienciasList` y `ExperienceCard` con presentación
administrativa: filtros/paginación existentes, enlaces administrativos y anonimato público;
sin publicación ni gestión privada del autor. `ComisionFeedback` usa el mismo modo de consulta
y evita consultar el comentario propio. No se agregan endpoints ni capacidades de moderación.
El guard ADMIN del layout y las comprobaciones backend permanecen obligatorios. USER conserva
sus rutas y no monta contenido administrativo cuando el guard rechaza su rol.

### Tablas administrativas (TASK-069)

`admin/AdminTable.tsx` reúne superficie tabular, controles de búsqueda/selección, estados y
acciones de los listados existentes. `AdminTables.module.css` controla ancho completo, radio
de 8px, celdas de 14.4px con padding vertical de 8px y acciones de 40px al extremo derecho.
En móvil se apilan filtros y el scroll horizontal se contiene en una región enfocable.
Excepción local de ESLint `no-noninteractive-tabindex`: esa región necesita foco para scroll
con teclado. No cambia Card, componentes globales, hooks compartidos ni el shell.

`AdminAcademicList` conserva altas y enlaces administrativos reales; oculta edición en
registros inactivos cuando el contrato expone ese estado. Usa Plus, Eye y Pencil de Lucide.
Los tooltips aparecen por hover/foco, permiten mover el puntero a su texto y se cierran con
Escape. `UsuariosList` ofrece detalle administrativo y cambios de estado con confirmación;
no ofrece alta ni edición de roles. Experiencias sigue usando tarjetas.

Filtros permitidos por `validations/admin.ts`, con búsqueda validada hasta 150 caracteres:

- Materias: `q`, `carrera`, `anioCarrera`, `nivelElectiva` (3, 4 o 5 solo en ELECTIVA).
- Profesores: `q` por nombre, insensible a mayúsculas y tildes.
- Usuarios: `q` por nombre/email, `rol` (ADMIN/USER) y `estado` (ACTIVO/INACTIVO).
- Cursadas: `materiaId`; Comisiones: `materiaId`, `cursadaId` (período) y `carrera`.
- `page` en todos los casos. Cambiar filtros reinicia la página; detalle/edición preservan
  filtros y página mediante `returnTo` validado. Los parámetros desconocidos se rechazan.

Materias consume filtros del servicio existente y páginas remotas de nueve registros. Los
otros listados usan `useAllPages` con páginas de 100 y límite de 20 páginas; filtran el conjunto
completo antes de dividirlo en páginas de nueve. Cambiar página/filtro no descarga otra vez
ese catálogo. Si excede el límite o una solicitud falla, no se muestran resultados parciales.
Para catálogos mayores queda pendiente búsqueda y filtros backend; no se infiere estado de
usuario ni se simula activación. Los estados incluyen carga, error con Reintentar, total
filtrado cero y recuperación hacia la primera página cuando la URL queda fuera de rango.

Pruebas: `admin-tables.spec.tsx`, regresión `listados.spec.tsx` y
`admin-tables.browser.spec.mjs`. La configuración `admin-tables.playwright.config.mjs`
permite revisar los cinco listados a 390/1280px en Chrome con HTTP simulado, sin base de datos.
Requiere build previo con `NEXT_PUBLIC_API_URL=http://127.0.0.1:3399` y
`NEXT_PUBLIC_ALLOW_LOCAL_HTTP=true`; se ejecuta desde raíz con
`npx playwright test --config=front/tests/admin-tables.playwright.config.mjs`.

### Administración remota y operaciones reales (TASK-070)

Esta actualización reemplaza las limitaciones de TASK-069. Todas las tablas administrativas
consumen páginas remotas de nueve registros con filtros aplicados por backend. Profesores
envía `q`; Usuarios envía `q`, `rol` y `estado=ACTIVO|INACTIVO`, junto a página y tamaño.
Comisiones envía carrera y conserva materia/período en URL. No se usa `useAllPages` para
resultados tabulares ni para sus selectores de contexto.

`AdminParentSelector` carga opciones al abrir un diálogo: materias admite búsqueda remota
por nombre y los períodos se recorren por páginas. La selección actual se obtiene por ID,
incluso si está fuera de la página consultada. Cambiar materia limpia período y reinicia la
página de resultados. La paginación interna de opciones es independiente de la del listado.
No hay límite de 2000 resultados ni de opciones para operar estos listados.

`AdminConfirmDialog` reutiliza Dialog, enfoca Cancelar inicialmente, impide cierre y doble
envío mientras procesa y conserva errores para reintentar. `admin-academic.eliminarAcademico`
ejecuta DELETE de materia/profesor/cursada/comisión; un 409 relacional se muestra en el diálogo
sin simular éxito. Las tablas recargan resultados manteniendo filtros/página; una página vacía
permite regresar al inicio. Trash2 tiene tooltip, nombre accesible y control de 40px; una
comisión inactiva sigue permitiendo baja si no está eliminada, aunque no sea editable.

`users.cambiarEstadoUsuario` envía PATCH `/users/:id/estado` con `{activo:boolean}`. El servicio
valida `disabledAt:string|null` en las respuestas administrativas. Usuarios muestra Estado,
UserX/UserCheck, confirmación e historial; la cuenta propia no ofrece autodesactivación.
No se agrega creación de usuarios ni edición de roles. La autorización final siempre es backend.

`AdminHistory` consulta `services/admin-history.ts` para profesor, cursada, comisión y usuario.
Muestra cambios reales con fecha, acción, valor anterior/nuevo y páginas de tres. Los detalles
académicos lo incorporan; Usuarios muestra el historial en el detalle administrativo. Materias mantiene su
historial dedicado, ahora compatible con el cambio `deletedAt`. Los editores de profesor,
cursada y comisión vuelven al detalle con `successMessage` y `returnTo` validado; si se cambia
la materia de una cursada, el retorno apunta al listado de la nueva materia en página uno.

Cobertura nueva: `admin-remote.spec.tsx`, `admin-parent-selector.spec.tsx`,
`admin-operations-service.spec.ts` y `admin-limits.browser.spec.mjs`. Esta última comprueba
operaciones reales contra el harness NestJS y PostgreSQL explícito, sin capturas ni análisis
de imágenes. Requiere builds backend/frontend, `TEST_DATABASE_URL` exclusivo y el frontend
compilado con `NEXT_PUBLIC_API_URL=http://localhost:3301`, `NEXT_PUBLIC_ALLOW_LOCAL_HTTP=true`.
Ejecución desde raíz: `npx playwright test admin-limits.browser.spec.mjs --config=playwright.config.ts`.
La revisión visual es responsabilidad del usuario.


## Detalle administrativo y auditoría

La integración de TASK-057 con la navegación contextual conserva los parámetros de origen en filtros, paginación, detalle y edición. Las pruebas usan relaciones completas de materia y cursada para habilitar los listados dependientes; primero esperan su carga y después verifican el resultado. Asignar, cambiar cargo o desvincular docentes guarda cada operación inmediatamente, por separado de Guardar cambios de la comisión. Cancelar la edición de sus datos no revierte operaciones docentes confirmadas. Evidencia automática en `docs/tasks/finished/TASK-integracion-desarrollo-docentes.md`; revisión en navegador a cargo del desarrollador.

Los accesos Eye de materias, profesores, cursadas y comisiones abren detalles bajo `/home/admin`. Usuarios dispone de `/home/admin/usuarios/[usuarioId]` y comentarios de `/home/admin/experiencias/[feedbackId]`, separados del detalle privado del autor. Cada tarjeta de Experiencias ofrece al administrador Ver detalle y auditoría; `returnTo` conserva la URL con filtros y página, validada como destino interno. Los usuarios comunes no reciben esta acción.

`services/admin-detail.ts` valida con Zod el contrato protegido `GET /admin/:kind/:id/detalle?page=1&pageSize=3`. `useAdminDetail` es un hook local al módulo. `AdminAudit`/`AdminAuditPanel` presentan metadatos y eventos reales con paginación de tres. Los datos ausentes se explicitan y la fecha de actualización se distingue del historial. Los campos de usuario/comentario visibles son una lista explícita; no se renderizan objetos de respuesta ni secretos. Usuarios permite confirmar cambios de estado excepto para la propia cuenta; el backend aplica la autorización definitiva. No se agrega moderación de comentarios.

## Administración del acceso de usuarios

`UsuariosList` consume `services/users.ts`: `listarUsuarios` envía búsqueda, rol, estado y páginas de nueve; `cambiarEstadoUsuario` valida la respuesta de `PATCH /users/:id/estado` con `{ activo: boolean }`. La tabla muestra Activo/Inactivo y acciones Lucide Eye, UserX y UserCheck con nombres accesibles que distinguen cuentas por nombre y email. Las confirmaciones conservan esa identidad, explican la revocación de sesiones y requieren una aceptación explícita antes de enviar. Tras el éxito se recarga la página con sus filtros y se actualizan resultados, estado y acciones.

`AdminRecordDetail` reutiliza el hook local `useAdminDetail` y `AdminAuditPanel` para mostrar campos seguros, auditoría e historial de tres eventos con actor y fecha. La operación vuelve a la primera página del historial para hacer visible el evento reciente. La propia cuenta no ofrece desactivación y las acciones se muestran solo para ADMIN; el backend verifica permisos y restricciones de concurrencia. Reactivar exige iniciar sesión nuevamente y no restaura sesiones revocadas. Los errores del servidor se muestran dentro de la confirmación para corregir o reintentar; la cuenta y los comentarios se conservan.

Cobertura: `user-access-state.spec.tsx` verifica cuentas homónimas, cancelación, recarga filtrada, reactivación desde otra página del historial, rechazo backend y restricciones de UI. El recorrido aislado de Playwright valida estas acciones con un navegador y contratos HTTP interceptados.

## Verificación de detalles con proxy
Los servicios de detalle administrativo consumen `/admin/:kind/:id/detalle`; las páginas se sirven bajo `/home/admin/...`. Nginx debe encaminarlos a backend y frontend respectivamente. Las rutas individuales `/users/` y `/profesores/` también requieren proxy al backend para estado, detalle e historial. `node scripts/check-admin-proxy.mjs` comprueba el contrato desplegado (401 JSON sin sesión en API y 200 HTML en páginas) sin modificar datos; los mocks de servicios no detectan errores de este enrutamiento.

## Bajas administrativas académicas
Los listados de Materias, Profesores, Períodos (Cursadas) y Comisiones usan Trash2 con nombre accesible y confirmación de baja lógica. `AcademicDeleteDialog` identifica etiqueta e ID y explica las restricciones por entidad y la conservación de experiencias, relaciones e historial. `AcademicDeleteAction` añade la misma operación a los cuatro detalles y sólo se ofrece a ADMIN cuando el registro está vigente. Reutiliza `services/admin-academic.ts` y `AdminConfirmDialog`; no hay borrado definitivo ni endpoints nuevos.

Después de una baja, el detalle permanece disponible, recarga estado y auditoría y oculta edición/baja. Los errores de dependencias conservan el motivo recibido del backend y mantienen abierta la confirmación. La auditoría se recarga en página 1 para mostrar el intento bloqueado sin borrar el error de operación ni los datos actuales. `AdminAudit` y `AdminHistory` muestran `BAJA_BLOQUEADA`, resultado y motivo como eventos distintos de modificaciones reales.

Los listados académicos vuelven a pedir la página, el total filtrado y los contadores tras operar. El hook local `useAcademicPage` ajusta a la última página válida usando total/pageSize remotos cuando la página actual queda fuera de rango; conserva filtros y no modifica hooks compartidos. La desvinculación docente se presenta como `Quitar asignación de <nombre>` y aclara que no da de baja al profesor. Dar de baja una comisión conserva las asignaciones históricas y cierra nuevas operaciones.

Pruebas de interacción en `academic-bajas.spec.tsx` cubren cuatro detalles, confirmación/cancelación, conservación del detalle histórico, permisos visuales, error relacional con actualización del historial y última fila de página 2 con retorno a página 1 y contador actualizado. Los guards del segmento y el backend siguen siendo la autoridad de autorización.

## Altas administrativas y carrera de comisión

`AltaComision` obtiene las carreras de la materia seleccionada mediante el catálogo académico. Si hay una, muestra su nombre como contexto de lectura y la envía automáticamente; si hay varias, exige seleccionar una de ellas. Si no hay ninguna, bloquea el envío e indica asociar una carrera desde la edición de la materia. El cambio de materia descarta la carrera anterior y recalcula cursadas y opciones. `EditarAcademico` aplica el mismo contexto para comisión y evita PATCH si no existen diferencias. Número y períodos conservan sus validadores y límites; el selector de cursada distingue año y cuatrimestre.

`AltaForm` admite `defaultReturnTo` fijo o derivado de los valores enviados y prioriza un `returnTo` administrativo validado. Materias y profesores vuelven a su listado; períodos y comisiones vuelven al listado acotado a materia/período. Los enlaces desde `ComisionesMateria` y `ComisionesList` conservan ese origen. Las altas en modal cierran únicamente tras éxito y recargan su lista; las páginas navegan con confirmación y refrescan el router. Los servicios HTTP ya usan `cache: no-store`.

`adminCreationHref` conserva filtros y página y agrega `creationOutsideFilters=1` cuando el registro no coincide con la consulta de origen. Los listados muestran el aviso y ofrecen limpiar filtros mediante una acción explícita. La creación de materias evalúa las carreras y años de la misma asociación, sin combinar filas distintas. La edición de materia vuelve a su detalle con el listado de origen en `returnTo`.

Los errores conservan los campos. Los formularios mantienen la protección frente a envíos simultáneos. Las asignaciones docentes permanecen en su sección y recargan detalle, opciones y auditoría después de confirmar el éxito; seleccionar el mismo cargo no envía una actualización.

Regresiones: `admin-comision-carreras`, `admin-creation-flows`, `admin-creation-filters`, `admin-creation-list-refresh`, `admin-assignment-flows` y `comisiones-creation-origin`, además de los tests existentes de formularios, filtros, precarga y edición. Pruebas visuales y de navegador a cargo del desarrollador en esta tarea.
# Presentación de detalles administrativos

`AdminRecordDetail` presenta usuarios mediante `UserAccountCard`, con iniciales, nombre público,
estado y acciones en la cabecera (debajo de la identidad en móvil), correo y rol en grilla responsive. El contrato actual solo
expone `displayName`; no se infiere un nombre completo distinto. Conserva retorno con filtros,
confirmaciones, restricciones sobre la propia cuenta y operaciones reales del service de usuarios.

`UserAudit` y `UserDetail.module.css` definen exclusivamente la presentación del detalle de usuarios:
tres columnas de auditoría en escritorio, dos intermedias y una móvil; historial nativo desplegable
con tabla Campo/Antes/Después. Las referencias de actores usan nombres autorizados opcionales del
endpoint; una referencia sin nombre se presenta como “Usuario no identificado”, sin mostrar IDs.
No se cambian las vistas académicas. La marca compartida `SiteHeader` usa `BookOpen` decorativo
y conserva el enlace de destino por rol.

`AdminAudit` y `AdminAuditPanel` restringen auditoría e historial al rol `ADMIN`. El cargador
compartido no consulta auditoría para otros roles; los endpoints mantienen su autorización backend.
La presentación usa `AdminAcademicDetail.module.css` y tokens vigentes, etiquetas `dt`, valores `dd`,
ausencias “No registrado”, fechas largas y hora secundaria en la zona local del navegador.
Se agrupa creación, modificación y baja/desactivación/eliminación según la entidad; una fecha
ausente no determina el estado actual. El identificador interno no se muestra en la auditoría.
El historial usa `details`/`summary`, inicia cerrado, cuenta solo eventos del backend y conserva
paginación de tres registros. No reemplaza el historial privado de versiones de comentarios.
