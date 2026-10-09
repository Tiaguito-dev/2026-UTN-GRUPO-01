# 2026-UTN-GRUPO-01

Profesor Butchery busca compartir experiencias entre estudiantes para conocer mejor las
materias y los docentes de la carrera, y tomar decisiones con información de sus pares.

## Estado

Autenticación de etapas 1–5 y navegación pública/interna implementadas. El desarrollador
confirmó la validación manual de los cambios el 2026-10-09. El stack tiene configuración
Docker separada para desarrollo y producción. La evidencia automatizada y sus límites se
detallan abajo: la suite completa de navegador no se declara ejecutada en esta entrega.

## Experiencia de cuenta y landing

La portada presenta el propósito del proyecto, con acciones para crear una cuenta o iniciar
sesión. El carrusel 3D muestra funcionalidades futuras, con botones y navegación por teclado;
respeta la preferencia de movimiento reducido. La landing es la entrada previa al login:
los visitantes acceden o se registran desde sus CTA, sin icono de cuenta en la navbar.
Con sesión comprobada, la entrada es `/home` y el logo también conduce allí; el icono
despliega Mi perfil, Cambiar contraseña y Cerrar sesión. Landing, login y registro
redirigen las cuentas autenticadas al home (o al retorno interno permitido del login).

El home interno exige autenticación y ofrece un menú lateral fijo en escritorio, adaptado
a móvil, con Inicio, Profesores, Materias, Experiencias y Comunidad. Las secciones futuras
muestran estados vacíos e información sobre su propósito; todavía no ofrecen operaciones
académicas ni presentan datos ficticios.

El perfil presenta los datos del usuario en una tarjeta y las acciones por debajo, separadas
de la información. El formulario de cambio de contraseña se abre solo cuando se selecciona
esa opción, en `/account/change-password`, con autenticación requerida.

Registro, restablecimiento y cambio de contraseña comparten una política de
8 a 128 caracteres, incluidos espacios y Unicode, sin recortar ni normalizar la contraseña.
Las pantallas se adaptan a móvil y escritorio y conservan etiquetas y mensajes de validación.

## Tecnologías

- Lenguaje: TypeScript.
- Backend: NestJS sobre Node.js.
- Frontend: Next.js con App Router y React.
- Persistencia: PostgreSQL con Prisma ORM.
- Gestión de paquetes: npm workspaces.

## Estructura del Repositorio

Ver [index.md](./index.md) para un mapa completo de las carpetas y archivos de este repositorio.

## Primeros pasos

1. Usar Node.js 22.22.3 y npm 10.
2. Ejecutar `npm ci` desde la raíz para respetar el lockfile compartido.
3. Copiar `.env.example` como `.env` y adaptar sus valores al entorno local.
4. Iniciar PostgreSQL con `docker compose -f docker-compose.dev.yml up -d postgres` cuando no se use otra instalación.
5. Ejecutar `npm run db:generate`.
6. Aplicar migraciones con `npm run db:deploy --workspace=back`.
7. Iniciar backend con `npm run dev:back` y frontend con `npm run dev:front`.

Estos pasos ejecutan las aplicaciones con npm fuera de Docker. Configurar `DATABASE_URL` para
el puerto publicado de PostgreSQL, y las variables públicas de Next.js en `front/.env.local`
o en el proceso. Para levantar todo con Docker, usar el procedimiento siguiente.

## Stack containerizado

La ejecución completa con Nginx, migraciones y Mailpit está documentada en
[infra/OVERVIEW.md](./infra/OVERVIEW.md). Usar `docker-compose.dev.yml` para desarrollo y
`docker-compose.yml` para producción, con archivos privados de configuración independientes.
Los dos archivos son independientes: **elegir uno, no combinarlos con dos opciones `-f`**.
Compose combina los archivos en el orden indicado; usar ambos mezclaría los entornos.
Ejecutar los comandos siguientes desde la raíz del repositorio, con Docker Desktop iniciado.

### Desarrollo: primera ejecución

Copiar `.env.example` como `.env` y completar `POSTGRES_PASSWORD` y `AUTH_JWT_SECRET`
(clave aleatoria base64url de al menos 32 bytes). No versionar credenciales. Para Docker no
se necesitan archivos `.env` en `back/` ni `front/`: Compose suministra su configuración.

Ejemplo en PowerShell (Windows); no volver a copiar si ya existe configuración privada:

```powershell
Copy-Item .env.example .env
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))"
```

El segundo comando genera una clave nueva para pegar en `AUTH_JWT_SECRET` del archivo privado.
Generar otra para `POSTGRES_PASSWORD` o elegir una propia apta para URL. Si ya hay un volumen
PostgreSQL con datos, conservar sus credenciales; cambiar `.env` no cambia la contraseña de
ese volumen. No compartir los valores ni reutilizar una clave entre entornos.

Construir las imágenes e iniciar el stack con un solo comando:

```sh
docker compose -f docker-compose.dev.yml --profile mail up --build --wait
```

Desarrollo utiliza HTTP en loopback: no requiere generar ni aceptar certificados. Producción
mantiene HTTPS. Las cookies son HttpOnly y SameSite=Lax; la excepción sin Secure se permite
solamente en HTTP local de desarrollo, con CSRF y orígenes explícitos.

- Aplicación: `http://localhost:8080`.
- Buzón Mailpit: `http://localhost:8025`, para consultar los mensajes de recuperación.
- PostgreSQL para herramientas locales: `localhost:55449` (configurable con `POSTGRES_PORT`).

El perfil `mail` habilita Mailpit. **Usarlo para probar el módulo completo**, incluida la
recuperación de contraseña. Puede omitirse si ya hay un Mailpit accesible o se configuró otro
servidor SMTP. Sin servidor SMTP accesible, registro/login/refresh/logout siguen funcionando,
pero no se entregan emails de recuperación; la API mantiene su respuesta genérica por seguridad.
La recepción en Mailpit no demuestra entrega mediante un proveedor real.

### Desarrollo: siguientes ejecuciones

Para volver a iniciar o actualizar el stack, usar el mismo comando:

```sh
docker compose -f docker-compose.dev.yml --profile mail up --build --wait
```

Este entorno utiliza builds compilados, sin recarga automática de código. Después de editar,
volver a ejecutar el comando para reconstruir y actualizar los servicios. Las migraciones se
aplican mediante un job que debe finalizar correctamente antes de arrancar el backend.

Para consultar el estado y detener el stack conservando los datos:

```sh
docker compose -f docker-compose.dev.yml --profile mail ps -a
docker compose -f docker-compose.dev.yml --profile mail down
```

No agregar `-v` a `down` si se quieren conservar los datos. Si hay conflicto de puertos o redes,
ajustar los puertos y la subred/IP del proxy en `.env`; ver [infra/OVERVIEW.md](./infra/OVERVIEW.md).

### Qué significa cada opción

| Opción o comando | Para qué sirve |
|---|---|
| `-f archivo.yml` | Selecciona el Compose del entorno. |
| `--env-file archivo` | Usa un archivo privado de variables; en desarrollo se lee `.env` de la raíz por defecto. |
| `-p nombre` | Identifica el proyecto y permite separar sus contenedores, redes y volúmenes de otro entorno. |
| `--profile mail` | Incluye el buzón Mailpit opcional. |
| `build` | Construye las imágenes sin iniciar servicios. |
| `up` | Crea o actualiza contenedores, redes y volúmenes, e inicia los servicios. |
| `--build` | Construye las imágenes antes de ejecutar `up` o `run`. |
| `-d` | Ejecuta en segundo plano sin esperar la salud de los servicios. |
| `--wait` | Espera a que los servicios estén ejecutándose o saludables; ya implica segundo plano. |
| `ps -a` | Muestra el estado, incluidos los jobs que ya terminaron. |
| `config --quiet` | Valida la configuración sin imprimir sus valores privados. |
| `down` | Retira contenedores y redes; conserva los volúmenes salvo que se agregue `-v`. |

`up --build -d` también sirve para construir e iniciar. Aquí se usa `--wait` para detectar
problemas de arranque antes de comenzar las pruebas; no hace falta añadir además `-d`.

### Producción

Usar únicamente `docker-compose.yml`, configuración privada `.env.production`, certificados
confiables y un proveedor SMTP TLS. Este Compose no incluye Mailpit ni genera certificados.
Los valores requeridos y permisos de certificados se detallan en [infra/OVERVIEW.md](./infra/OVERVIEW.md).

```sh
docker compose --env-file .env.production -p profesor-butchery-prod -f docker-compose.yml config --quiet
docker compose --env-file .env.production -p profesor-butchery-prod -f docker-compose.yml up --build --wait
```

Mantener nombres de proyecto distintos por entorno y un nombre estable para conservar sus datos.

## Recorrido para el equipo

1. Abrir la aplicación y crear una cuenta; luego iniciar sesión. El registro siempre crea `USER`.
2. El login abre `/home`. El menú lateral explica las funcionalidades previstas; todavía no
   hay contenido académico. El icono de cuenta abre perfil, cambio de contraseña y logout.
3. Probar recuperación desde el login: ingresar el email, abrir el mensaje en Mailpit y seguir
   el enlace. Tras restablecer o cambiar la contraseña es necesario iniciar sesión nuevamente;
   todas las sesiones anteriores quedan revocadas.
4. Para probar `ADMIN`, provisionar la cuenta mediante configuración privada y comando explícito;
   seguir [back/OVERVIEW.md](./back/OVERVIEW.md). No existe un endpoint público para crear administradores.

Las credenciales viajan exclusivamente en cookies HttpOnly. Access: 15 minutos; sesión absoluta:
7 días; recuperación: 30 minutos, configurables. Refresh rota sin extender la sesión; reutilizar
una credencial consumida revoca la sesión. El frontend coordina pestañas mediante Web Locks y
metadatos sin credenciales; su limitación en navegadores sin coordinación está documentada en
[front/OVERVIEW.md](./front/OVERVIEW.md). CSRF exige origen permitido y `X-CSRF-Protection: 1`
en peticiones mutables. El cliente del producto ya envía esa configuración.

## Verificación y límites

Controles anteriores ejecutados: 277 pruebas backend con PostgreSQL y SMTP/Mailpit reales,
47 frontend, tipos de ambos paquetes y builds Docker. Chromium comprobó registro, login,
recarga, refresh, logout, recuperación mediante buzón, cambio de contraseña, navegación,
teclado y móvil. La aceptación manual del desarrollador se registra en las tareas terminadas.
Esto no afirma ejecución de la matriz automatizada completa de etapa 5 ni entrega mediante
un proveedor SMTP real. No hay lint configurado. No se desplegó a producción.

Para repetir los controles desde la raíz:

```sh
npm ci
npm run db:generate
npm run typecheck --workspace=back
npm run typecheck --workspace=front
npm test
```

Las integraciones backend exigen `TEST_DATABASE_URL` de una base **exclusiva de pruebas**;
sin ella se omiten, por lo que un resultado unitario no demuestra persistencia. Las pruebas
SMTP necesitan su buzón de prueba. Instrucciones de migración, SMTP y Playwright con sus puertos
y configuración aislada en [back/OVERVIEW.md](./back/OVERVIEW.md) y
[front/OVERVIEW.md](./front/OVERVIEW.md). No apuntar los tests a la base del equipo.

## Integración de esta entrega

Los cambios se acumulan en `feature/auth` mediante commits atómicos en español. `desarrollo`
es una rama protegida: el desarrollador realiza el push de la rama feature y prepara una
única PR hacia `desarrollo` con todos los commits. No se requiere una PR por cada commit. Ver
[flujo Git](./docs/standards/git-workflow.md) para distinguir este flujo del de ramas de feature.

## Documentación

Lo esencial vive en [`docs/`](./docs/) — estándares bajo `docs/standards/` y documentación de
diseño técnico bajo `docs/tdd/`. Seguimos el principio de **lean documentation** de las
metodologías ágiles: la documentación hay que mantenerla y eso cuesta tiempo, así que solo
documentamos lo que realmente necesitamos, cuando lo necesitamos, en vez de adelantar todo de
entrada. Por ahora, seguir la convención definida alcanza.

## Trabajar con Agentes

Este repo define tres agentes por dominio (backend, frontend, testing). Ver
[agents/OVERVIEW.md](./agents/OVERVIEW.md) para su alcance y la metodología de delegación de
tareas.

## Contribuir

Ver [CONTRIBUTING.md](./CONTRIBUTING.md) para nuestro workflow, convenciones de commit y reglas de documentación por carpeta.

## Equipo

Ver [TEAM_CHARTER.md](./TEAM_CHARTER.md) para roles del equipo, acuerdos de trabajo y proceso de toma de decisiones.

## Licencia

_A definir_
