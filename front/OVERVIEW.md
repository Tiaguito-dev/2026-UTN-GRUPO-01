# Frontend

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

- `/`: pantalla inicial para verificar el arranque de Next.js.
- `NEXT_PUBLIC_API_URL`: URL pública del backend.

## Comandos

- `npm run dev:front`: inicia Next.js en desarrollo desde la raíz.
- `npm run build --workspace=front`: genera el build de producción.
- `npm run start --workspace=front`: sirve el build de producción.

Todavía no existen módulos funcionales. Cada módulo debe documentar vistas, componentes,
services, hooks, permisos y validaciones.
