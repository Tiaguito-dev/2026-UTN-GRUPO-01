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
- `src/components/`: componentes reutilizables cuando sean necesarios.
- `src/services/`: clientes HTTP dedicados por módulo.
- `src/hooks/`: hooks reutilizables por módulo.
- `src/types/`: contratos TypeScript del frontend.
- `src/validations/`: validaciones de formularios.
- `tests/`: pruebas de integración y end-to-end de los flujos funcionales.

## Contratos iniciales

- `/`: landing previa al login, descripción del propósito y CTA de ingreso y registro.
- `/register`, `/login`: flujos para visitantes; cuentas autenticadas vuelven al espacio interno.
- `/forgot-password`, `/reset-password`: recuperación pública de cuenta.
- `/verify-email`: confirma el enlace SMTP y retira el token de la URL; no inicia sesión.
- `/resend-verification`: solicita un enlace para una cuenta pendiente, incluso anterior al cambio.
- `/home`: inicio protegido con funcionalidades previstas y estados vacíos informativos.
- `/account`, `/account/change-password`: perfil y cambio de contraseña protegidos.
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
Las reseñas, panorama de materias, experiencias y comunidad se presentan como funcionalidades
futuras, sin exponer operaciones académicas que todavía no existen.

`FeatureCarousel` utiliza perspectiva CSS y controles explícitos, sin reproducción automática
ni dependencias adicionales. Permite avanzar con flechas, elegir una tarjeta con botones y
utilizar ArrowLeft/ArrowRight/Home/End. Anuncia la selección y oculta las tarjetas inactivas
a lectores de pantalla. Con movimiento reducido se desactiva la animación y se muestra solo
la tarjeta activa. La presentación se adapta a móvil y escritorio.

`globals.css` centraliza colores de marca y semánticos. Formularios con etiquetas visibles,
foco de teclado, errores asociados y botones de envío bloqueados durante la petición.
Contraseñas nuevas: entre 8 y 128 caracteres Unicode, sin recortar ni normalizar, en registro,
restablecimiento y cambio. Login permite las credenciales existentes; el backend sigue siendo
la autoridad de validación. No se agregan fuentes remotas, analítica ni recursos de terceros.

Las cookies HttpOnly, CSRF, coordinación de renovaciones y revocación se conservan en los
servicios existentes. `/account` presenta únicamente los datos públicos en una tarjeta con
iniciales, nombre, email y rol legible. Las acciones aparecen debajo, fuera de la tarjeta.
Cambiar contraseña abre explícitamente `/account/change-password`, protegida por `RequireAuth`,
con el formulario existente y un enlace de vuelta al perfil; no se muestra junto a los datos.
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

`SystemHome` presenta un saludo con el nombre público de la cuenta y un estado vacío que
explica qué funcionalidades llegarán al sistema. El menú lateral permanece fijo en escritorio
y se adapta a botones superiores en móvil, sin desbordamiento horizontal. Inicio, Profesores,
Materias, Experiencias y Comunidad seleccionan contenido informativo en la misma pantalla.
Las secciones futuras muestran Próximamente; no llaman a endpoints académicos ni presentan
datos inventados. La selección utiliza `aria-current` y lleva el foco al título actualizado.
El perfil se abre desde el menú de cuenta o Ver mi perfil. `RequireAuth` protege el home,
perfil y cambio; los guards del backend siguen siendo la autoridad de autenticación.

## Comandos

- `npm run dev:front`: inicia Next.js en desarrollo desde la raíz.
- `npm run build --workspace=front`: genera el build de producción.
- `npm run start --workspace=front`: sirve el build de producción.
- `npm run typecheck --workspace=front`: comprueba tipos TypeScript.
- `npm run lint --workspace=front`: corre ESLint (`front/eslint.config.mjs`: Next
  `core-web-vitals`, `react-hooks` y `jsx-a11y`). Por ahora las reglas avisan sin fallar,
  salvo `react-hooks/rules-of-hooks`.
- `npm run test --workspace=front`: ejecuta las pruebas unitarias de Vitest.
- `npm run test:e2e --workspace=front`: ejecuta el harness Playwright; requiere la configuración
  y los servicios de prueba que documentó en su momento la tarea de integración de cuenta
  (`docs/tasks/finished/`). Incluye `visual.browser.spec.mjs`: capturas de referencia y análisis
  axe de las pantallas principales. Las capturas se regeneran (`--update-snapshots`) solo desde
  Linux, con el Google Chrome del sistema.

El workflow `.github/workflows/front.yml` corre `typecheck`, `lint`, `test` y `build` en cada PR
hacia `desarrollo` o `main` que toque el front. Solo verifica; no despliega.

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
El límite de 9 se aplica también al cargar opciones de los formularios relacionados.

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

El listado permite buscar por nombre con envío explícito mediante Buscar y limpiar
el texto mediante Limpiar búsqueda. El criterio `q` se recorta, admite hasta 150
caracteres y rechaza caracteres de control. Se combina con el año y, únicamente
al elegir Electivas, con los chips Todos los niveles, 3.er Nivel, 4.º Nivel o
5.º Nivel. Los cambios reinician la página; cambiar a un año obligatorio elimina
el nivel. El backend filtra todos los resultados antes de paginar.

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

La sección de filtros usa un panel con buscador y chips de selección única para Todos
los años, 1.º a 5.º año y Electivas. El grupo Nivel de electiva aparece únicamente al
seleccionar Electivas. Los botones nativos exponen `aria-pressed`, admiten teclado y
foco visible; se distribuyen en varias filas en pantallas pequeñas. Los estilos están
aislados en `components/academic/MateriasList.module.css`, sin modificar estilos base.
El contrato HTTP, permisos, validaciones y listado de resultados se conservan (TASK-026).

Casos probados, correspondencia con criterios de aceptación, resultados y recorrido manual:
[matriz de trazabilidad TASK-024](../docs/tasks/finished/TASK-024-filtros-materias-anio-carrera.md#trazabilidad-de-casos-probados).
