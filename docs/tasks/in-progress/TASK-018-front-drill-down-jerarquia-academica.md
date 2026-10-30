# TASK-018: Frontend — drill-down de jerarquía académica (HU-04, solo lectura)

Estado: Implementado y verificado contra el backend real (governance UX/UI aprobada); validación
manual del equipo pendiente.
Fecha: 2026-10-10

## 0. Verificación y correcciones posteriores a la implementación inicial

La implementación del agente `front` tenía un bug real que rompía el tercer nivel del
drill-down al 100%: `periodoLabel` estaba definida en `CursadasList.tsx` (módulo `"use client"`)
y se llamaba desde `generateMetadata` del Server Component de la página de Comisiones — Next.js
no permite invocar una función de un módulo cliente desde el servidor (React error #441). Se
movió a `front/src/components/academic/periodo.ts`, un módulo neutral sin directiva de cliente.

La auditoría de governance UX/UI encontró además 6 hallazgos IMPORTANT, todos resueltos:
- Paginación no se conservaba en la URL al volver de un detalle → nuevo hook
  `front/src/hooks/useUrlPageParam.ts`, usado en las 3 listas.
- Estados vacíos sin acción siguiente → se agregó un link de vuelta al nivel anterior en cada uno.
- El mensaje de error de red prometía un reintento que no existía → `usePaginatedFetch` expone
  `retry()`, con un botón "Reintentar" en los 3 componentes (mismo patrón que `RequireAuth`).
- Mensajes 404 sin acción correctiva → `usePaginatedFetch` expone `notFound` (basado en
  `HttpError.status === 404`); se muestra un link de vuelta en vez de "Reintentar" cuando aplica.
- Área táctil del breadcrumb por debajo de 24px en mobile → `padding-block`/`min-height` en
  `.breadcrumb a`.
- `.pagination` sin `flex-wrap`, riesgo de overflow en mobile → agregado.

Verificado dos veces de punta a punta con Playwright contra el stack Docker real (registro con
dominio institucional, login, navegación por los 3 niveles y por breadcrumb, con datos sembrados
directamente vía Prisma y limpiados después, sin dejar residuos). 75/75 tests, typecheck limpio.

## 1. Contexto y objetivo

TASK-014 cerró el backend de HU-04 Escenario 1 (Materia → Cursada → Comisión, 3 endpoints
protegidos por sesión). Esta tarea cubre el frontend: pantallas para que un estudiante
autenticado navegue esa jerarquía real, consumiendo esos 3 endpoints ya verificados.

## 2. Alcance

- `front/src/app/home/materias/page.tsx` — listado de Materias.
- `front/src/app/home/materias/[materiaId]/page.tsx` — Cursadas de una Materia.
- `front/src/app/home/materias/[materiaId]/cursadas/[cursadaId]/page.tsx` — Comisiones de una
  Cursada.
- `front/src/services/academic.ts` — cliente para los 3 endpoints.
- Reemplazo del placeholder "Materias" de `SystemHome.tsx` por un `Link` a `/home/materias`
  (las demás secciones del menú no se tocan).
- Estilos nuevos mínimos en `globals.css` para lista/tabla, breadcrumb y paginación (no existían
  clases reutilizables para esto).

## 3. Fuera de alcance

- Cualquier archivo de `back/`.
- HU-05 (validación de profesores/comisiones) y HU-11 (CRUD admin) — pendientes, no son parte de
  esta tarea.
- Secciones "Profesores", "Experiencias", "Comunidad" de `SystemHome.tsx`.
- Tests — quedan a cargo del agente de Testing (`.agents/test.md`); este agente solo corre la
  suite existente para confirmar que no se rompe.
- Dependencias nuevas.

## 4. Decisiones de diseño

1. **Rutas anidadas reales de Next.js**, no el switcher de `useState` que usa hoy `SystemHome`
   — cada nivel de la jerarquía es una URL navegable y recargable, con su propio título de
   pestaña y comportamiento de breadcrumb/back del navegador.
2. **El nombre de la Materia viaja por query param entre niveles** (`?nombre=...`), no por un
   fetch adicional: el backend no expone un detalle de Materia por id (solo el listado paginado),
   así que reconstruirlo exigiría traer todas las páginas del listado y buscar por id — más
   costoso y más código que pasar el valor que el usuario ya vio en la pantalla anterior.
   Limitación conocida y aceptada: si se accede directo a `/home/materias/:id` sin pasar por el
   listado (link externo, refresh con query perdido), el breadcrumb muestra una etiqueta
   genérica ("Materia") en vez del nombre real — la lista de Cursadas funciona igual porque solo
   depende del `materiaId` de la URL, no del nombre. Mismo criterio para `anio`/`cuatrimestre` al
   bajar a Comisiones.
3. **Fetching 100% client-side**, mismo patrón que `AccountForm`/`AccountPanel`: cada `page.tsx`
   es un Server Component fino que solo pone `metadata.title` y envuelve `RequireAuth` + un
   Client Component que hace el fetch. Motivo: la sesión vive en una cookie `HttpOnly` que el
   runtime de Next no reenvía automáticamente a este backend (`services/http.ts` ya documenta
   que "no credentials are available to JavaScript"); traer datos protegidos en el servidor
   exigiría un mecanismo de forwarding de cookies que no existe hoy y que esta tarea no agrega.
4. **`services/academic.ts` son funciones sueltas, no una clase con estado** (a diferencia de
   `AuthService`): los 3 métodos son GETs protegidos sin estado propio — reutilizan
   `getAuthService().protectedGet()` para heredar gratis el reintento tras 401 por refresh que ya
   tiene `AuthService`. Una clase nueva solo agregaría ceremonia sin un estado real que guardar.
5. **Breadcrumb y paginación son componentes chicos propios** (`components/academic/`), sin
   librería nueva — paginación es prev/next + "página X de Y" calculado de `total`/`pageSize`,
   breadcrumb es una lista de `Link`s.

## 5. Criterios de aceptación

- Un usuario autenticado puede ir de `/home/materias` a una Materia, de ahí a una Cursada, y ver
  sus Comisiones, con breadcrumb correcto en cada nivel.
- Cada pantalla tiene estados explícitos: cargando, vacío, error (404 con mensaje claro; 401 lo
  cubre `RequireAuth`/`AuthService` ya existentes).
- Paginación funcional en los 3 listados cuando `total > pageSize`.
- Foco en el `<h1>` al entrar a cada nivel (mismo patrón que `SystemHome`).
- `npm run typecheck --workspace=front` y `npm run test --workspace=front` sin romper nada
  existente.

## 6. Validación

Ver evidencia al pie del archivo (typecheck + test) una vez implementado.
