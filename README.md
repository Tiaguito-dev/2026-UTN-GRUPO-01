# 2026-UTN-GRUPO-01

Profesor Butchery busca compartir experiencias entre estudiantes para conocer mejor las
materias y los docentes de la carrera, y tomar decisiones con información de sus pares.

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
`docker-compose.yml` para producción — son independientes, no combinar con dos opciones `-f`.

Primera vez en desarrollo: copiar `.env.example` como `.env` y completar `POSTGRES_PASSWORD`
y `AUTH_JWT_SECRET` (clave aleatoria base64url de al menos 32 bytes, por ejemplo con
`node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))"`).
No versionar credenciales.

```sh
docker compose -f docker-compose.dev.yml --profile mail up --build --wait
```

- Aplicación: `http://localhost:8080`.
- Buzón Mailpit (recuperación de contraseña): `http://localhost:8025`.

Detalles de opciones, troubleshooting y despliegue en producción en
[infra/OVERVIEW.md](./infra/OVERVIEW.md).

## Verificación

```sh
npm ci
npm run db:generate
npm run typecheck --workspace=back
npm run typecheck --workspace=front
npm test
```

Las integraciones backend requieren `TEST_DATABASE_URL` de una base **exclusiva de pruebas**;
sin ella se omiten. Detalles de migraciones, SMTP y Playwright en
[back/OVERVIEW.md](./back/OVERVIEW.md) y [front/OVERVIEW.md](./front/OVERVIEW.md).

## Documentación

Lo esencial vive en [`docs/`](./docs/) — estándares bajo `docs/standards/` y decisiones de
diseño documentadas dentro de cada tarea bajo `docs/tasks/`. Seguimos el principio de **lean
documentation** de las metodologías ágiles: la documentación hay que mantenerla y eso cuesta
tiempo, así que solo documentamos lo que realmente necesitamos, cuando lo necesitamos, en vez
de adelantar todo de entrada.

## Trabajar con Agentes

Este repo define tres agentes por dominio (backend, frontend, testing). Ver
[.agents/OVERVIEW.md](./.agents/OVERVIEW.md) para su alcance y la metodología de delegación de
tareas.

## Contribuir

Ver [CONTRIBUTING.md](./CONTRIBUTING.md) para nuestro workflow, convenciones de commit y reglas de documentación por carpeta.

## Equipo

Ver [TEAM_CHARTER.md](./TEAM_CHARTER.md) para roles del equipo, acuerdos de trabajo y proceso de toma de decisiones.

## Licencia

_A definir_
