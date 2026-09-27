# 2026-UTN-GRUPO-01

> Descripción breve de qué hace este proyecto y para quién.

## Estado

Etapa temprana con el stack tecnológico inicializado y sin módulos funcionales todavía.

## Tecnologías

- Lenguaje: TypeScript.
- Backend: NestJS sobre Node.js (despliegue en Render).
- Frontend: Next.js con App Router y React (despliegue en Vercel).
- Persistencia: PostgreSQL con Prisma ORM (local con Docker Compose, nube con Neon).
- Gestión de paquetes: npm workspaces.

## Infraestructura y Despliegue en la Nube

Para publicar el MVP en Internet con costo cero se adoptó una arquitectura desacoplada:
- **Frontend:** Vercel (Next.js con CDN global).
- **Backend:** Render (Web Service Node.js para proceso continuo de NestJS).
- **Base de Datos:** Neon (PostgreSQL Serverless administrado).
- **Desarrollo local:** Docker Compose para persistencia aislada sin conexión a Internet.

Ver detalles y justificación en [TDD-INFRA-CLOUD-H1.md](./docs/tdd/TDD-INFRA-CLOUD-H1.md).

## Estructura del Repositorio

Ver [index.md](./index.md) para un mapa completo de las carpetas y archivos de este repositorio.

## Primeros pasos

1. Usar Node.js 22.22.3 y npm 10.
2. Ejecutar `npm install` desde la raíz.
3. Copiar `.env.example` como `.env` y adaptar sus valores al entorno local.
4. Iniciar PostgreSQL con `docker compose up -d postgres` cuando no se use otra instalación.
5. Ejecutar `npm run db:generate`.
6. Iniciar backend con `npm run dev:back` y frontend con `npm run dev:front`.

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
