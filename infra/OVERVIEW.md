# Stack Docker

`docker-compose.dev.yml` y `docker-compose.yml` son archivos completos e independientes;
no se combinan como overrides. El primero tiene proyecto predeterminado `profesor-butchery-dev`
e imágenes con tag `dev`; producción usa imágenes con tag `local`. Sus volúmenes y redes deben
pertenecer a proyectos distintos (`-p`) para impedir compartir datos accidentalmente.

## Archivos de entorno

En Docker basta un archivo privado en la raíz: `.env` para desarrollo y `.env.production`
para producción con `--env-file`. No se necesitan archivos en `back/` ni `front/`:
Compose inyecta el entorno del backend y pasa al build frontend solamente variables públicas.
Los archivos privados no se copian a ninguna imagen. `DATABASE_URL` del backend Docker se
construye con el hostname interno `postgres`, no con `localhost`.

Fuera de Docker, el backend lee `.env` de su carpeta y de la raíz. Next.js necesita sus variables
públicas exportadas al proceso o en `front/.env.local`; no carga automáticamente el `.env`
raíz al ejecutar el workspace. Ese archivo opcional debe contener solamente
`NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_ALLOW_LOCAL_HTTP`, sin secretos de DB, JWT o SMTP.

El stack local ejecuta PostgreSQL, migraciones Prisma, backend NestJS, frontend Next.js,
Nginx y, con el perfil `mail`, Mailpit. Frontend y API comparten
`http://localhost:8080`: Nginx enruta `/auth/` y los healthchecks al backend
y comprime recursos públicos. La autenticación y la pantalla de recuperación no usan gzip.
Los logs de acceso y errores de peticiones del proxy están desactivados para evitar registrar
enlaces de recuperación. La disponibilidad se observa mediante healthchecks; una integración
futura de logs deberá sanitizar URLs antes de registrarlas.

## Ejecución local

1. Copiar `.env.example` como `.env`. Configurar `POSTGRES_PASSWORD` privado y
   `AUTH_JWT_SECRET` con al menos 32 bytes aleatorios en base64url. No versionar `.env`.
   La contraseña de PostgreSQL debe ser apta para la URL de conexión (base64url sirve).
   Si se reutiliza un volumen existente, conservar su usuario, base y contraseña actuales.
2. Ejecutar desde la raíz:

```sh
docker compose -f docker-compose.dev.yml --profile mail up --build --wait
docker compose -f docker-compose.dev.yml --profile mail ps -a
```

3. Abrir `http://localhost:8080`. No hay certificados TLS locales. Mailpit está en
   `http://localhost:8025`; comprueba recepción local, no entrega mediante un proveedor real.
4. Apagar con `docker compose -f docker-compose.dev.yml --profile mail down`. No usar `down -v` para preservar datos.

El perfil `mail` es necesario para recibir correos con la configuración Mailpit predeterminada;
puede omitirse si ya hay un servidor SMTP accesible configurado. Sin SMTP, la recuperación
mantiene su respuesta genérica pero no entrega instrucciones. `--wait` ya implica segundo plano.
El comando `up --build --wait` sirve tanto para la primera ejecución como para actualizar el
stack. Las opciones se explican en el [README](../README.md#qué-significa-cada-opción).
PostgreSQL se publica para herramientas locales en `localhost:55449` por defecto; su puerto
interno sigue siendo 5432. Si el puerto está ocupado o reservado, cambiar `POSTGRES_PORT`.

Este entorno sirve builds compilados para probar flujos en condiciones similares al despliegue.
No incluye hot reload: tras editar código, reconstruir y ejecutar nuevamente `up -d --wait`.
Para edición con recarga automática, usar los comandos npm del README y levantar solamente
PostgreSQL/Mailpit con este Compose, configurando la API local según `.env.example`.

El job `migrate` aplica `prisma migrate deploy` antes del arranque del backend y termina con
código cero. No necesita healthcheck permanente: su finalización exitosa es la condición de
arranque. El Compose de desarrollo ya no incluye `tls-init` ni monta certificados.
Los volúmenes TLS creados anteriormente no se borran automáticamente.
Ante cambios de migraciones, reconstruir y volver a ejecutar el job antes de iniciar el backend.

La URL pública se fija con `DOCKER_PUBLIC_URL` y se incorpora al frontend durante el build:
cambiarla exige reconstruir. Ajustar `DOCKER_HTTP_PORT` en desarrollo o `DOCKER_HTTPS_PORT`
en producción si cambia el puerto publicado, manteniéndolo coherente con la URL pública.
La subred `DOCKER_APP_SUBNET` y la IP `DOCKER_PROXY_IP` deben estar libres y ser coherentes.
El backend confía únicamente en esa IP; Nginx reemplaza cabeceras reenviadas del cliente.
No agregar comodines de CORS: el origen configurado es explícito. CSRF conserva `Origin` y
`X-CSRF-Protection: 1`; las cookies son HttpOnly y SameSite=Lax. En desarrollo HTTP no tienen
Secure; `AUTH_ALLOW_LOCAL_HTTP=true` y `NEXT_PUBLIC_ALLOW_LOCAL_HTTP=true` están explícitos
y admiten solamente loopback. Producción conserva Secure y rechaza esta excepción.

## Aislamiento y operación

- Backend y frontend tienen builds por etapas con Node 22.22.3, `npm ci` y lockfile único.
  Backend runtime conserva dependencias de producción; el CLI Prisma vive en la imagen del job.
  Next.js utiliza su salida standalone. Los secretos no entran en los contextos de build.
- Todos los procesos de servicio ejecutan con usuarios no root. `init: true`, límites de procesos,
  memoria y CPU, `no-new-privileges`, capacidades eliminadas y filesystem de solo lectura.
  Solamente volúmenes de datos y tmpfs necesarios son escribibles.
- Backend y frontend no publican puertos al host. HTTP local, PostgreSQL y Mailpit se limitan a loopback.
  PostgreSQL usa volumen persistente y red de datos interna separada. Su segunda red permite
  publicar PostgreSQL en loopback para herramientas de desarrollo; no expone otros servicios.
- `/health` comprueba proceso; `/health/ready` comprueba PostgreSQL y devuelve `503` sin detalles
  si no está disponible. Frontend tiene `/health`; Nginx `/proxy-health`; Mailpit `/livez`.
  Docker marca fallos de salud, pero no reinicia por sí solo un proceso que permanece vivo.
- Apagado: PostgreSQL 60 s; backend, frontend, proxy y migraciones 30 s; Mailpit 15 s.
  NestJS habilita shutdown hooks; Nginx utiliza SIGQUIT.
  Los logs Docker rotan a tres archivos de 10 MB por servicio.

## Producción

`docker-compose.yml` fija `NODE_ENV=production`, SMTP TLS implícito y plaintext deshabilitado.
No contiene Mailpit, generación de certificados ni publicación de PostgreSQL. Proporcionar
configuración privada mediante `--env-file .env.production` (ignorado por Git y Docker):

- `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD`, `AUTH_JWT_SECRET`.
- `DOCKER_PUBLIC_URL`: origen HTTPS real utilizado por CORS, cookies y enlace de recuperación.
- `DOCKER_SMTP_HOST`, `DOCKER_SMTP_PORT`: servidor SMTPS (normalmente puerto 465).
  `SMTP_FROM`, `SMTP_USERNAME` y `SMTP_PASSWORD`: remitente y credenciales privadas.
- `DOCKER_TLS_DIRECTORY`: directorio existente con `cert.pem` (cadena completa) y `key.pem`,
  legibles por UID 101, montado en `/tls` con solo lectura. Usar certificados confiables.
- `DOCKER_APP_SUBNET`, `DOCKER_PROXY_IP`: rango libre e IP del proxy dentro de él, diferentes
  a desarrollo si ambos entornos conviven. Sin configuración, producción usa `192.168.241.0/24`.
- `DOCKER_BIND_ADDRESS`: loopback por defecto; configurar una interfaz explícita para exposición
  externa y ajustar firewall. `DOCKER_HTTPS_PORT` debe coincidir con la URL pública.

```sh
docker compose --env-file .env.production -p profesor-butchery-prod -f docker-compose.yml config --quiet
docker compose --env-file .env.production -p profesor-butchery-prod -f docker-compose.yml build
docker compose --env-file .env.production -p profesor-butchery-prod -f docker-compose.yml up -d --wait
docker compose --env-file .env.production -p profesor-butchery-prod -f docker-compose.yml ps -a
docker compose --env-file .env.production -p profesor-butchery-prod -f docker-compose.yml down
```

Configurar y conservar un nombre de proyecto estable para reutilizar el volumen correcto.
No ejecutar ambos archivos contra el mismo proyecto. Compose rechaza configuración requerida
ausente; el backend además valida claves, URLs HTTPS y SMTP al iniciar.
Gestionar renovación de certificados, secretos, copias de seguridad y exposición de puertos
según la plataforma de destino. La entrega real de email debe validarse con el proveedor elegido.
El volumen PostgreSQL requiere ownership del usuario `postgres`; no cambiar permisos de un
volumen existente sin una revisión y respaldo previos.

## Estado vigente y aceptación

El desarrollador confirmó la validación manual de los cambios el 2026-10-09. Desarrollo
utiliza HTTP local sin certificados, home autenticado y secciones informativas vacías.
Las tareas 005–013 están cerradas en `docs/tasks/finished/`. No hay despliegue productivo
ni entrega con proveedor SMTP real comprobados. La suite automatizada completa de navegador
no se declara ejecutada; los recorridos realizados y límites constan en las tareas.

Antes de los commits se repitieron migraciones en PostgreSQL efímero y 277/277 pruebas backend
con SMTP/Mailpit aislado, 47/47 frontend, tipos de ambos paquetes y validación Compose dev.
El stack del equipo y sus datos no se utilizaron para las pruebas de integración.

## Evidencia anterior: UX y HTTP local

Stack HTTP levantado en `http://localhost:8080` con todos los servicios saludables y migraciones
exit 0. Chromium comprobó formularios de registro/login/cambio/reset con contraseñas de ocho
caracteres, renovación, logout, correo en Mailpit, cookies HttpOnly y CSRF. Contraste, teclado,
movimiento reducido y landing en móvil/escritorio verificados. Backend 277 y frontend 38 pruebas
aprobadas, más tipos y builds. Detalle en [TASK-011](../docs/tasks/finished/TASK-011-ux-landing-http-local.md).

## Evidencia anterior: etapa Docker con TLS local

Estos resultados corresponden al stack anterior. La configuración vigente de desarrollo
utiliza HTTP y se valida como parte de [TASK-011](../docs/tasks/finished/TASK-011-ux-landing-http-local.md).

Ambos Compose validados, imágenes compiladas y stack de desarrollo levantado con base aislada.
Verificados healthchecks, límites y usuarios efectivos, HTTPS con CA local, gzip de JS, CSRF,
cookies, registro/login/refresh/logout y revocación inmediata. Probados readiness ante caída de
PostgreSQL y apagado dentro de la gracia sin SIGKILL. Backend 250/250 y frontend 32/32 pruebas;
tipos aprobados. No hay lint configurado. Evidencia y límites en
[TASK-010](../docs/tasks/finished/TASK-010-containerizar-stack.md).
Esta evidencia histórica no equivale a la matriz automatizada completa de navegador.
SMTP comprobado con buzón local, sin afirmar entrega mediante proveedor real.

Verificación adicional sobre el proyecto de desarrollo real `profesor-butchery-dev`: comandos
TLS y arranque ejecutados; todos los servicios saludables y migraciones con exit 0. El puerto
5432 del host fue rechazado por Windows y se cambió a 55449. Un recorrido de navegador pasó
registro/login, recarga/me, refresh, logout, CSRF, cookies Secure/HttpOnly, ausencia de credenciales
en storage, correo recibido en Mailpit, restablecimiento con token retirado de URL, rechazo de
contraseña anterior y aceptación de la nueva. Pantalla de login móvil sin desbordamiento.
Este recorrido comprueba disponibilidad para las pruebas manuales; no reemplaza la matriz
completa de etapa 5 ni su validación de UX. El stack quedó ejecutándose.
