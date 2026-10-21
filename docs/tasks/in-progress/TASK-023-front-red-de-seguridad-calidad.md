# TASK-023: Red de seguridad de calidad del frontend (lint, CI y tests de caracterización)

Estado: En curso. Lint, CI, tests de caracterización y documentación implementados y verificados en
local; falta generar la línea base visual (necesita una base de pruebas) y ver el workflow en un PR.
Decisiones 1 a 4 confirmadas por el desarrollador el 2026-10-21.
Fecha: 2026-10-21

## 1. Contexto y objetivo

Una auditoría de calidad del frontend sobre `desarrollo` (commit `253c650`) encontró problemas de
diseño de componentes, estilos y tipado que conviene refactorizar: tokens que cubren solo color,
estilos globales por elemento que se pisan entre sí, cuatro listados y dos formularios con lógica
duplicada. Antes de tocar nada de eso hace falta poder detectar regresiones. Hoy no se puede:

- **No hay lint.** `front/package.json` no tiene ESLint ni script `lint`; no existe ningún
  `eslint.config.*`. `front/OVERVIEW.md` lo declara: "No hay lint configurado".
  `hooks/useAllPages.ts:39` y `hooks/usePaginatedFetch.ts:36` tienen directivas
  `eslint-disable-next-line react-hooks/exhaustive-deps` que hoy no hacen nada.
- **No hay CI.** No existe `.github/`. Ningún PR corre typecheck, tests ni build del front.
  `render.yaml` solo compila el backend.
- **Los tests de componentes no prueban comportamiento.** `front/tests/vitest.config.mjs` usa
  `environment: "node"` y los componentes se prueban con `renderToStaticMarkup`: no corren
  efectos, foco ni clics. No tienen tests `AltaForm`, `components/admin/opciones.tsx`, las altas,
  `UsuariosList`, `SidebarNav`, `SiteHeader`, `FeatureCarousel` ni los hooks de paginación.
- **El e2e cubre solo cuenta y sesión.** Los 12 casos de `front/tests/auth.browser.spec.mjs` no
  recorren materias ni administración, y no hay chequeo automático de accesibilidad.

Objetivo: dejar lint, CI y tests de caracterización funcionando **sin cambiar el comportamiento
ni el aspecto de la aplicación**, para que las refactorizaciones siguientes se puedan verificar.

Un test de caracterización describe lo que el código hace hoy, no lo que debería hacer. Si
encuentra un comportamiento dudoso, lo fija tal como está y lo anota; el arreglo va en otra tarea.

## 2. Alcance

1. **ESLint en `front/`.**
   - Config plana `front/eslint.config.mjs` con la configuración de Next (`core-web-vitals`),
     `react-hooks` y `jsx-a11y`, y `reportUnusedDisableDirectives` activo.
   - Script `"lint": "eslint ."` en `front/package.json`.
   - Severidad inicial según la decisión 2. `react-hooks/rules-of-hooks` es error desde el
     principio, porque violarla siempre es un bug.
   - Registrar en la sección 6 la cantidad de advertencias del primer `npm run lint`.
2. **Workflow de CI** `.github/workflows/front.yml`.
   - Se dispara en `pull_request` hacia `desarrollo` y `main` y en `push` a `desarrollo`, cuando
     cambian `front/**`, `package.json`, `package-lock.json` o el propio workflow.
   - Node desde `.nvmrc`, `npm ci` en la raíz, y luego
     `typecheck`, `lint`, `test` y `build` del workspace `front`.
   - `build` recibe un `NEXT_PUBLIC_API_URL` ficticio con HTTPS: `services/http.ts` lo valida en
     el navegador, no durante el build.
3. **Entorno de tests de interacción**.
   - Dependencias de desarrollo `jsdom`, `@testing-library/react` y `@testing-library/user-event`.
   - Cada spec nuevo declara `// @vitest-environment jsdom`; `vitest.config.mjs` sigue en `node`
     para que los specs actuales no cambien.
4. **Tests de caracterización** en `front/tests/`, mockeando servicios y `next/navigation`:
   - `MateriasList` y `UsuariosList`: carga → datos, error → "Reintentar" vuelve a pedir, vacío,
     clic en "Siguiente" llama a `router.replace` con `?page=2`, foco en el `h1` al montar.
   - `AltaForm`: errores por campo y foco al primer inválido; doble envío bloqueado; éxito limpia
     el formulario y muestra el aviso; error del backend aparece y recibe foco; `blocked`
     deshabilita el envío.
   - `bloqueoDeOpciones` (función pura): prioridad error → cargando → vacío → `null`.
   - `SiteHeader`: abre y cierra el menú, Escape devuelve el foco al botón, clic afuera cierra.
   - `SidebarNav`: `aria-current` según la ruta (incluido el drill-down de materias) y sección
     Administración visible solo para ADMIN con sesión confirmada.
   - `usePaginatedFetch`: cambiar `resetKey` vuelve a página 1. `useAllPages`: junta varias
     páginas y se detiene en el tope de 20.
5. **Accesibilidad y línea base visual en el e2e**.
   - Dependencia de desarrollo `@axe-core/playwright`.
   - Spec nuevo `front/tests/visual.browser.spec.mjs` sobre el harness existente: landing, login,
     inicio, materias, una alta y perfil, en 390px y 1280px. Por cada pantalla, una captura con
     `toHaveScreenshot` y un análisis axe que falla ante violaciones `serious` o `critical`.
6. **Documentación.** Actualizar en `front/OVERVIEW.md` la sección "Comandos" (agregar `lint`)
   y quitar "No hay lint configurado". Registrar la estrategia de testing elegida en
   `.agents/test.md`.

## 3. Fuera de alcance

- Corregir lo que el lint o axe encuentren. Se registra en la sección 6 y se resuelve en tareas
  posteriores (tokens, cascada CSS, primitivas de UI).
- Cualquier cambio en `front/src/`. La única excepción: si un test no se puede escribir sin un
  cambio en el código, se detiene la tarea y se consulta.
- Prettier, EditorConfig o cualquier reformateo masivo: generaría un diff enorme justo antes de
  refactorizar.
- Lint y CI del backend.
- Correr el e2e en CI: necesita Postgres y el buzón SMTP del harness. Sigue siendo local.
- Deploy desde CI. El autodeploy de Render y Vercel no cambia (ver TASK-021).

## 4. Decisiones de diseño

1. **CI con GitHub Actions, solo de verificación.** TASK-021 dejó "CI/CD propio" fuera
   de su alcance porque el autodeploy alcanzaba para desplegar. Acá el problema es otro: nada
   impide mergear con el build o los tests rotos. Se agrega un workflow que verifica y no
   despliega. Alternativa descartada: un script local `npm run check`, que depende de que cada
   persona se acuerde de correrlo.
2. **ESLint arranca en advertencias.** Con reglas en error, el primer PR tendría que
   arreglar todo el código existente, que es justamente lo que esta tarea no hace. Las reglas
   quedan en `warn`, salvo `rules-of-hooks`, y una tarea posterior las pasa a `error`.
3. **jsdom + Testing Library para interacción.** `AGENTS.md` pide justificar cada
   dependencia nueva. Esta se justifica porque `renderToStaticMarkup` no puede probar foco, clics
   ni efectos, que es lo que más se va a tocar. Alternativa descartada: probar todo con Playwright,
   más lento y dependiente de la base de datos para cada caso.
4. **Capturas versionadas y generadas solo en Linux + Chromium.** Las capturas cambian
   según el sistema operativo y las fuentes instaladas. Se versionan en el repo para que la línea
   base sea compartida, pero se regeneran (`--update-snapshots`) únicamente desde Linux. El
   resto del equipo puede correr el spec y revisar el diff, sin sobrescribir las capturas.
5. **Specs de interacción en jsdom por archivo, no global.** Mantiene intactos los specs
   existentes, que dependen del entorno `node` (por ejemplo `academic-service.spec.ts` con
   `vi.stubGlobal("fetch")`).
6. **Antes de configurar ESLint se lee la guía de la versión instalada.** `front/AGENTS.md` avisa
   que esta versión de Next tiene cambios incompatibles. La forma de integrar la config de Next
   se toma de `node_modules/next/dist/docs/`, no de memoria.

## 5. Criterios de aceptación

- `npm run lint --workspace=front` termina con código 0. Las advertencias quedan contadas en la
  sección 6.
- `npm run typecheck --workspace=front`, `npm run test --workspace=front` y
  `npm run build --workspace=front` pasan.
- Un PR de prueba contra `desarrollo` muestra el workflow en verde. Romper a propósito un test
  en una rama descartable lo pone en rojo.
- Los tests de la sección 2.4 existen y pasan contra el código actual, sin cambios en
  `front/src/`.
- `git diff --stat origin/desarrollo -- front/src` está vacío.
- El spec visual genera la línea base en Linux, y una segunda corrida sin cambios no muestra
  diferencias.
- axe no reporta violaciones `serious` ni `critical`. Si las reporta, se listan en la sección 6 y
  el spec las marca como conocidas hasta su tarea de corrección.
- `front/OVERVIEW.md` y `.agents/test.md` reflejan los comandos y la estrategia nuevos.

## 6. Validación

Ejecutada el 2026-10-21 sobre `desarrollo` (`253c650`), en local.

| Comando | Resultado |
|---|---|
| `npm run lint --workspace=front` | Código 0. 0 errores, 12 advertencias (detalle abajo). |
| `npm run typecheck --workspace=front` | Pasa. |
| `npm run test --workspace=front` | 108 tests en 8 archivos, todos pasan (4 archivos nuevos, 33 tests nuevos). |
| `npm run build --workspace=front` con `NEXT_PUBLIC_API_URL=https://api.example.invalid` | Pasa. |
| `git diff --stat desarrollo -- front/src` | Vacío. |

### Dependencias agregadas

`eslint` 9, `eslint-config-next` ~16.3.8 (misma línea que `next`), `eslint-plugin-jsx-a11y`,
`jsdom`, `@testing-library/react`, `@testing-library/dom` (dependencia par obligatoria de
`@testing-library/react`), `@testing-library/user-event` y `@axe-core/playwright`. Todas de
desarrollo. `eslint-config-next` 16.3.8 todavía no admite ESLint 10, por eso npm resolvió la 9.

`npm audit` reporta 5 vulnerabilidades altas, todas en la cadena
`eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces` (denegación de
servicio con patrones glob anidados). Solo corre en lint, sobre patrones del propio repo; no llega
al build ni al runtime. Se revisa al actualizar `eslint-config-next`.

### Configuración de ESLint

`front/eslint.config.mjs` toma `eslint-config-next/core-web-vitals` (que ya incluye `react`,
`react-hooks` y el plugin `jsx-a11y`) y suma las reglas recomendadas de `jsx-a11y`. Todas las
reglas se bajan a `warn` con una función que recorre la config, salvo
`react-hooks/rules-of-hooks`, que queda en `error`. `reportUnusedDisableDirectives` está en
`warn`: las dos directivas `exhaustive-deps` de los hooks de paginación ahora sí suprimen una
regla activa, así que no se reportan.

### Advertencias del primer `npm run lint` (12)

| Regla | Cantidad | Dónde |
|---|---|---|
| `react-hooks/set-state-in-effect` | 4 | `AccountForm.tsx:45`, `AuthProvider.tsx:77`, `useAllPages.ts:21`, `usePaginatedFetch.ts:24` |
| `react-hooks/refs` | 4 | `AccountForm.tsx:141` |
| `jsx-a11y/no-noninteractive-element-interactions` | 1 | `FeatureCarousel.tsx:23` |
| `jsx-a11y/no-noninteractive-tabindex` | 1 | `FeatureCarousel.tsx:23` |
| `react/no-children-prop` | 1 | `tests/auth-navigation.spec.ts:13` |
| `@next/next/no-assign-module-variable` | 1 | `tests/backend-harness.mjs:52` |

Se corrigen en tareas posteriores, como indica la sección 3.

### Tests de caracterización

- `tests/listados.spec.tsx`: `MateriasList` y `UsuariosList` (carga, error y Reintentar, vacío,
  Siguiente con `router.replace` a `?page=2`, foco en el `h1`).
- `tests/alta-form.spec.tsx`: `AltaForm` y `bloqueoDeOpciones`.
- `tests/navegacion.spec.tsx`: `SiteHeader` y `SidebarNav`.
- `tests/paginacion-hooks.spec.tsx`: `usePaginatedFetch` y `useAllPages`.

Comportamiento dudoso fijado tal como está: al cambiar `resetKey`, `usePaginatedFetch` pide
primero el recurso nuevo en la página vieja y después en la 1 (llamadas `[3, 3, 1]`). La
respuesta vieja se descarta, pero la petición de más ocurre. Queda para la tarea de patrones de
pantalla.

`next/link` se reemplaza por un `<a>` (`tests/support/next-link.tsx`) para no depender del
contexto del App Router.

### Pendiente

- Línea base visual y axe: `tests/visual.browser.spec.mjs` está escrito, pero no se ejecutó:
  necesita `TEST_DATABASE_URL`, que no está configurada en esta máquina. Al correrlo por primera
  vez hay que generar las capturas con `--update-snapshots`, correrlo de nuevo sin cambios y
  listar en `KNOWN_VIOLATIONS` (y acá) lo que axe reporte como `serious` o `critical`.
- Workflow de CI: se valida al abrir el PR (verde) y con una rama descartable con un test roto
  (rojo).

### Pruebas manuales para el desarrollador

- Correr `npm run dev:front` y recorrer landing, login, inicio, materias (drill-down hasta
  comisiones), una alta y perfil. Nada tiene que verse ni comportarse distinto que antes.
- Abrir el PR y confirmar que el check del workflow aparece y queda en verde.
- Revisar las capturas generadas: deben mostrar las pantallas completas, sin estados de carga.
