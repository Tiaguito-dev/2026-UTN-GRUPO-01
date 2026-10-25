# Frontend: Tests

Estándar para los tests de `front/tests/`. Sale de
[TASK-023](../tasks/finished/TASK-023-front-red-de-seguridad-calidad.md). Los escribe el agente de
Testing ([.agents/test.md](../../.agents/test.md)).

## Regla 1: el entorno según lo que se prueba

| Qué se prueba | Herramienta | Archivo |
|---|---|---|
| Servicios, validaciones, funciones puras y markup estático (`renderToStaticMarkup`) | Vitest en entorno `node`, el de `front/tests/vitest.config.mjs` | `tests/<tema>.spec.ts` |
| Interacción: foco, clics, teclado, efectos, hooks | Vitest + jsdom + Testing Library (`@testing-library/react`, `user-event`) | `tests/<tema>.spec.tsx` |
| Recorridos reales contra el backend, capturas y axe | Playwright | `tests/<tema>.browser.spec.mjs` |

En un spec de interacción:

- La primera línea es `// @vitest-environment jsdom`. El entorno global sigue en `node`.
- Se mockean los servicios y `next/navigation`. `next/link` se reemplaza por
  `tests/support/next-link.tsx`, para no depender del contexto del App Router.
- Cada archivo llama a `afterEach(cleanup)`.
- Una primitiva nueva de `components/ui/` trae su spec `tests/ui-<primitiva>.spec.tsx`.
- Un listado paginado nuevo se agrega a la tabla de `tests/listados.spec.tsx`, que prueba carga,
  error con Reintentar, vacío, `?page` en la URL y foco en el `h1`.

**Por qué:** `renderToStaticMarkup` no corre efectos, foco ni clics, que es lo que más se toca en
una pantalla. jsdom por archivo, y no global, deja intactos los specs de `node` que dependen de
ese entorno (por ejemplo, `vi.stubGlobal("fetch")`). Playwright para todo sería más lento y
necesitaría la base de datos en cada caso.

## Regla 2: caracterizar antes de refactorizar

Antes de refactorizar código sin tests, se escribe un test de caracterización: describe lo que el
código hace hoy, no lo que debería hacer. Un comportamiento dudoso se fija tal como está, con un
comentario, y se corrige en otra tarea. Si la refactorización cambia un comportamiento a
propósito, el test se actualiza con un comentario que dice qué cambió.

**Por qué:** sin esa red, una refactorización no se puede verificar, y un arreglo mezclado con un
refactor no se puede atribuir.

## Regla 3: las reglas compartidas con el back se prueban de los dos lados

`tests/validation-parity.spec.ts` importa los validadores reales del back y corre la misma tabla
de casos contra los dos lados. Una regla de formulario nueva que también valida el back se agrega
a esa tabla. Detalle en [validacion-con-zod.md](./validacion-con-zod.md#frontend).

## Playwright: capturas y axe

- Corre solo en local (`npm run test:e2e --workspace=front`), con el harness de
  `tests/backend-harness.mjs`, una base exclusiva de pruebas en `TEST_DATABASE_URL` y el buzón SMTP.
  CI no lo corre. Levanta el build existente con `next start`: antes, `npm run build
  --workspace=front` con `NEXT_PUBLIC_API_URL=http://localhost:3301` y
  `NEXT_PUBLIC_ALLOW_LOCAL_HTTP=true`, o el login falla con "Falta configurar la conexión".
- Una pantalla cuyos datos cambian entre corridas fija la respuesta con `page.route` y
  `route.fulfill({ response: await route.fetch(), json })`, como `profesores` en el spec visual.
- `tests/visual.browser.spec.mjs` saca una captura por pantalla de `SCREENS` a 390px y 1280px y
  corre axe en cada una. Falla ante una violación `serious` o `critical`, y ante un breadcrumb de un
  solo ítem.
- **Cuándo agregar una captura:** al crear una pantalla principal o un estado de pantalla completa
  nuevo (como acceso denegado), se agrega a `SCREENS`. Una tarea que cambia el aspecto a propósito
  regenera las capturas afectadas y adjunta el antes y el después en el PR.
- **Regenerar la línea base** (`--update-snapshots`) solo desde Linux con el Google Chrome del
  sistema (`channel: "chrome"`): las capturas versionadas son `*-linux.png`. En otro sistema se
  corre con `--ignore-snapshots` para verificar axe y los recorridos sin tocar las capturas.
  Desde Windows o macOS, Linux se obtiene con Docker: la imagen
  `mcr.microsoft.com/playwright:v<versión de @playwright/test>-noble` más
  `npx playwright install --with-deps chrome`, con el repo copiado sin `node_modules` y
  `npm ci` adentro, y Postgres y Mailpit en la red del contenedor.
- **Versión de la línea base:** la actual se generó entera en TASK-033 con
  `mcr.microsoft.com/playwright:v1.64.0-noble` y Google Chrome 156.0.8078.47.
  `playwright install chrome` baja la estable del día: si `google-chrome --version` da otra,
  una diferencia de captura puede venir del navegador y no del cambio.
- **axe:** no hay lista de violaciones conocidas (TASK-032 la vació). Una violación nueva se
  corrige en la misma tarea. Si no se puede, entra a una lista de conocidas en el spec solo para
  esa pantalla, con la tarea que la va a corregir.

**Por qué:** las capturas cambian con el sistema operativo, las fuentes y la versión de Chrome.
Una sola plataforma de regeneración mantiene la línea base comparable para todo el equipo.

## Referencia

`front/tests/vitest.config.mjs`, `front/tests/ui-notice.spec.tsx`, `front/tests/visual.browser.spec.mjs`.
