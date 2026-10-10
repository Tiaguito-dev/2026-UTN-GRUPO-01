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

Esta sección documenta una capacidad local del stack Docker (ejecutarlo con configuración
productiva: HTTPS, SMTP TLS, sin Mailpit), no un despliegue real. El despliegue real del
proyecto es cloud (Vercel + Render + Neon), ver
[docs/architecture/DEFINICION-ARQUITECTURA.md](../docs/architecture/DEFINICION-ARQUITECTURA.md),
que fija explícitamente "sin Docker en producción en esta fase" por presupuesto. Esta
configuración sirve para validar el stack en condiciones productivas localmente, no para
exponerlo en un servidor. El procedimiento paso a paso de ese despliegue está en
[DESPLIEGUE-CLOUD.md](DESPLIEGUE-CLOUD.md).

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

Evidencia histórica de validación por etapa (conteos de tests, fechas de aceptación) en
[CHANGELOG.md](../CHANGELOG.md) y en cada `TASK-NNN` correspondiente bajo
[docs/tasks/finished/](../docs/tasks/finished/).
