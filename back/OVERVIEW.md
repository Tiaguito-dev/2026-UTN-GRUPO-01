# Backend

API HTTP escrita en TypeScript con NestJS. PostgreSQL es la base de datos relacional y Prisma
ORM concentra el esquema, las migraciones y el acceso tipado a datos.

## Estructura

- `src/`: módulos, controllers y services de NestJS.
- `src/infrastructure/prisma/`: módulo global de acceso a datos.
- `prisma/schema.prisma`: contrato de datos; los modelos se agregan con cada módulo funcional.
- `prisma/migrations/`: migraciones versionadas generadas por Prisma.
- `tests/`: pruebas automatizadas del backend.

## Contratos iniciales

- `GET /health`: responde `{ "status": "ok", "service": "back" }` cuando la API está activa.
- `DATABASE_URL`: conexión PostgreSQL utilizada por Prisma.
- `BACKEND_PORT`: puerto HTTP opcional; el valor predeterminado es `3001`.

## Comandos

- `npm run dev:back`: inicia NestJS en desarrollo desde la raíz.
- `npm run build --workspace=back`: genera Prisma Client y compila el backend.
- `npm test --workspace=back`: ejecuta las pruebas con Vitest.
- `npm run db:generate`: regenera Prisma Client.
- `npm run db:migrate`: crea y aplica una migración de desarrollo.
- `npm run db:studio`: abre Prisma Studio.

Todavía no existen modelos de dominio. Cada módulo debe documentar sus endpoints, payloads,
reglas, relaciones, estados, errores, permisos e historial.
