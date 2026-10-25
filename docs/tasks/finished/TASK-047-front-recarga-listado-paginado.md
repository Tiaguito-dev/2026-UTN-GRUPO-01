# TASK-047: Recarga desde afuera en PaginatedListView / usePaginatedFetch

Estado: Terminado. Decisión 1 aprobada e implementada el 2026-10-25.
Sin dependencias de back ni de otras tareas.
Fecha: 2026-10-25

## 1. Contexto y objetivo

En el rediseño "Alta en modal desde el listado" (`MateriasAdmin.dc.html`, `ModalNuevaMateria.dc.html`)
la materia se crea en un modal y el listado de abajo tiene que mostrarla sin navegar. Hoy el alta
navega con `?successMessage=` y la página destino vuelve a montar el listado.

Estado actual (rama `desarrollo`):

- `front/src/hooks/usePaginatedFetch.ts`: el efecto depende de
  `request = JSON.stringify([resetKey, page, retryToken])`. `fetchPage` va envuelto en
  `useEffectEvent`, así que cambiar solo el cierre no vuelve a pedir datos.
- `front/src/components/ui/PaginatedListView.tsx` recibe `resetKey` y lo pasa al hook. `retry` es
  interno (solo lo usa el botón "Reintentar").
- `MateriasList` resuelve los filtros remontando `MateriasResults` con una `key` compuesta.

Objetivo: que un padre pueda pedir "volvé a cargar esta página" después de crear algo, con una API
explícita y documentada.

> Esta tarea modifica un hook compartido y una primitiva global (`AGENTS.md`, áreas sensibles). Esta
> tarea es la autorización explícita, dentro del alcance de la sección 2. Justificación: el refresco
> desde afuera lo necesitan todos los listados que tengan alta en modal (materias, cursadas,
> comisiones); resolverlo con `key` en cada pantalla desmonta el árbol y pierde el foco.

## 2. Alcance

- `usePaginatedFetch(resetKey, fetchPage, page, refreshKey = 0)`: `refreshKey` entra en `request`.
  Cambiarlo vuelve a pedir la misma página sin desmontar.
- `PaginatedListView`: prop opcional `refreshKey?: number` que se pasa al hook.
- `front/tests/ui-paginated-list-view.spec.tsx`: casos nuevos (sección 5).
- `docs/standards/frontend-pantallas.md`, sección de listados: "Después de crear o editar desde un
  modal, el padre incrementa `refreshKey`; no se remonta con `key` ni se navega."

## 3. Fuera de alcance

- Mantener los datos viejos en pantalla mientras recarga (hoy cualquier petición nueva muestra
  "Cargando…"); si el rediseño lo pide, va en su propia tarea.
- Volver a la página 1 tras crear: lo decide la pantalla, la página viene de `useUrlPagination`.
- Usar `refreshKey` en alguna pantalla (va con el rediseño del listado de materias).

## 4. Decisiones de diseño

1. **Parámetro `refreshKey` en vez de reutilizar `resetKey` (propuesta).** Técnicamente
   `resetKey={`materias-${n}`}` ya provoca la recarga, pero mezcla dos significados (qué recurso y
   cuándo refrescar) y obliga a cada pantalla a armar strings. Un número aparte es explícito y cuesta
   una línea en el hook. Alternativa descartada: exponer `retry` por `ref`; más código y un patrón
   imperativo que el proyecto no usa.

## 5. Casos de prueba y criterios de aceptación

Vitest + Testing Library (`ui-paginated-list-view.spec.tsx`, jsdom):

- cambiar `refreshKey` vuelve a llamar a `fetchPage` con la misma página y muestra los datos nuevos;
- re-renderizar con el mismo `refreshKey` no vuelve a pedir datos;
- una respuesta vieja que llega después de un `refreshKey` nuevo se descarta;
- sin `refreshKey`, el comportamiento actual no cambia (los casos existentes siguen en verde,
  incluida la tabla de `listados.spec.tsx`).

Criterios:

- `npm run lint --workspace=front`, `npm run typecheck --workspace=front` y
  `npm run test --workspace=front` pasan.
- Sin cambios visibles: no hay captura de Playwright nueva ni regenerada.

## 6. Validación

Ejecutada el 2026-10-25 con resultado exitoso:

- `npm run lint --workspace=front`: 0 errores, 0 advertencias.
- `npm run typecheck --workspace=front`: limpio (tsc en `src/` y `tests/`).
- `npm run test --workspace=front`: 24 archivos pasados, 241 tests pasados (incluidos los 3 casos de `refreshKey` en `ui-paginated-list-view.spec.tsx`).
- `npm run build --workspace=front`: compilación exitosa de Next.js en producción (23 rutas generadas).

### Pruebas manuales para el desarrollador

Ninguna visible en esta tarea. No se tiene que romper: paginar, filtrar y "Reintentar" en
`/home/materias` y en los listados de administración.

## 7. Riesgos

- Bajo. El único riesgo es cambiar la forma de `request` y romper la detección de respuestas
  viejas; lo cubre el tercer caso de prueba.

## Resultado

Implementado. `usePaginatedFetch` y `PaginatedListView` soportan `refreshKey?: number` para refetchear sin desmontar. Documentado en `docs/standards/frontend-pantallas.md`.
