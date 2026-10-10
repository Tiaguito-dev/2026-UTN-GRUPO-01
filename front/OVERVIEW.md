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
- `/home`: inicio protegido con funcionalidades previstas y estados vacíos informativos.
- `/account`, `/account/change-password`: perfil y cambio de contraseña protegidos.
- `NEXT_PUBLIC_API_URL`: URL pública del backend.

## Landing y experiencia de cuenta

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
- `npm run test --workspace=front`: ejecuta las pruebas unitarias de Vitest.
- `npm run test:e2e --workspace=front`: ejecuta el harness Playwright; requiere la configuración
  y los servicios de prueba que documentó en su momento la tarea de integración de cuenta
  (`docs/tasks/finished/`).

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
[TASK-011](../docs/tasks/finished/TASK-011-ux-landing-http-local.md). No hay lint configurado.
