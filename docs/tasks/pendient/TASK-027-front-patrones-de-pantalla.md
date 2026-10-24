# TASK-027: Patrones de pantalla en el frontend (encabezado, listados paginados y formularios)

Estado: Pendiente. Decisiones 1 a 4 propuestas, a confirmar por el desarrollador antes de mover
la tarea a `in-progress/`. Depende de TASK-023 y TASK-026.
Fecha: 2026-10-21

## 1. Contexto y objetivo

Los hooks de datos se extrajeron, pero la estructura de cada pantalla se sigue copiando.
Inventario sobre `desarrollo` (`253c650`):

- **Encabezado con foco, repetido diez veces.** Cada pantalla crea `headingRef`, un `useEffect`
  que hace `focus()`, `tabIndex={-1}` y un id para anunciar el cambio de pantalla (la intención
  está documentada en `globals.css:64-67`). Aparece en `InicioSection.tsx:12-17`,
  `UpcomingSection.tsx:11-16`, `MateriasList.tsx:13-21`, `CursadasList.tsx:13-22`,
  `ComisionesList.tsx:19-34`, `AdminPanel.tsx:16-20`, `AltaForm.tsx:40-88`,
  `UsuariosList.tsx:17-25`, `AccountPanel.tsx:10-15` y `AccountForm.tsx:25-38`. Las copias ya
  divergen:
  - las dependencias del efecto son `[]`, `[id]`, `[materiaId]` o `[cursadaId]`;
  - Inicio y Próximamente no envuelven la pantalla en `<section aria-labelledby>` y comparten
    el id `system-heading`;
  - el eyebrow aparece en dos pantallas y el breadcrumb en seis.
- **Listados paginados, cuatro copias.** `MateriasList.tsx:13-38`, `CursadasList.tsx:13-47`,
  `ComisionesList.tsx:19-55` y `UsuariosList.tsx:17-44` repiten la misma secuencia: encabezado,
  `useUrlPageParam`, `usePaginatedFetch`, el mismo `handlePageChange`, las ramas de carga, error,
  vacío y datos, la lista y `Pagination`. Solo difieren en cómo se renderiza cada ítem, en los
  textos, en el manejo de `notFound` (Cursadas y Comisiones) y en el total que muestra Usuarios.
- **La página tiene dos fuentes de verdad.** `useUrlPageParam.ts:9` lee `?page` una sola vez,
  como valor inicial, y `usePaginatedFetch.ts:10` guarda la página en su propio estado. Si la URL
  cambia sin que el componente se remonte, por ejemplo al tocar "Materias" en el sidebar estando
  en la página 3, la lista no vuelve a la página 1. Además, cambiar `resetKey` hace
  `setPage(1)` pero deja `?page` en la URL (`usePaginatedFetch.ts:18-20`).
- **Estado de fetch con campos sueltos.** `usePaginatedFetch` devuelve `status`, `result`,
  `error` y `notFound` por separado, y cada consumidor verifica `status === "ready" && result`.
  `useAllPages` usa otra convención: `items === null` significa "cargando".
- **`useSearchParams` sin `<Suspense>`.** `useUrlPageParam.ts:8` funciona hoy solo porque
  `RequireAuth` no renderiza a los hijos durante el prerender, ya que el estado inicial es
  `"checking"` (`AuthProvider.tsx:24`).
- **Lógica de formulario duplicada.** `AccountForm.tsx:27-123` y `AltaForm.tsx:41-84` repiten:
  ref anti doble envío, `busy`, errores por campo, error y éxito, foco al primer inválido, foco
  al aviso, y `try/catch/finally` con mensaje de respaldo. `AltaForm.tsx:21-26` lo reconoce en
  su comentario.
- **Formularios sin tipos que unan campos y valores.** `AltaField.name` es `string` y
  `onSubmit` recibe `Record<string, string>` (`AltaForm.tsx:9-19, 38`), por lo que
  `AltaCursada.tsx:37` necesita castear `values.cuatrimestre as Cuatrimestre`. Un error de tipeo
  en `values.nombreCompeto` compila y falla en ejecución.

Objetivo: que una pantalla nueva (por ejemplo, Profesores) se arme combinando `PageHeader`,
`PaginatedListView` y `useFormSubmission`, sin copiar otra pantalla. También que la URL sea la
única fuente de la página actual.

Es la Etapa 4 del plan de refactorización del frontend. Usa las primitivas de TASK-026 y se
apoya en los tests de caracterización de TASK-023.

> Modifica hooks compartidos, que `AGENTS.md` lista como área sensible. Esta tarea es la
> autorización explícita para hacerlo, dentro del alcance de la sección 2.

## 2. Alcance

Tres bloques, cada uno en su propio PR, en este orden (decisión 1).

### Bloque A: `PageHeader`

- `components/ui/PageHeader.tsx` con props `title`, `description?`, `eyebrow?`, `breadcrumb?`,
  `focusKey?` y `align?: "start" | "center"`.
  - Genera el id con `useId` y lo devuelve para que la pantalla lo use en
    `<section aria-labelledby>`.
  - Mueve el foco al `h1` al montar y cada vez que cambia `focusKey`.
  - La variante `align="center"` cubre el título dentro de `.auth-card` y del perfil.
- `hooks/useFocusOnMount.ts`: el efecto de foco sin JSX, para los casos que no usan
  `PageHeader`.
- Reemplazar las diez copias. Cada pantalla conserva su eyebrow, su breadcrumb y su texto tal
  como están hoy (decisión 2). Inicio y Próximamente pasan a tener `<section aria-labelledby>`
  y dejan de compartir id.

### Bloque B: listados paginados

- `hooks/useUrlPagination.ts`: lee `page` de `useSearchParams` en cada render, sin estado propio.
  Expone `page` y `setPage(n)`. `setPage(1)` borra el parámetro. Navega con `router.replace`,
  igual que hoy (decisión 3).
- `hooks/usePaginatedFetch.ts` pasa a devolver un `AsyncState<PaginatedResult<T>>`
  discriminado:
  `{ status: "loading" } | { status: "ready"; data } | { status: "error"; error; notFound }`.
  Recibe la página desde afuera y ya no guarda la suya. Se borra el efecto de `resetKey`, porque
  la página sale de la URL.
- `hooks/useAllPages.ts` adopta el mismo `AsyncState<T[]>`. Se actualiza `opciones.tsx` (en
  `bloqueoDeOpciones`, `items === null` pasa a ser `status === "loading"`).
- `components/ui/PaginatedListView.tsx`: arma encabezado, estados y paginación. Props:
  `fetchPage`, `resetKey`, `renderItem`, `getKey`, `emptyMessage`, `notFoundAction?`,
  `summary?(total)` y las props de `PageHeader`. Renderiza `LoadingState`, `Notice` con
  "Reintentar", `EmptyState`, la lista dentro de `Card` y `Pagination`.
- Migrar `MateriasList`, `CursadasList`, `ComisionesList` y `UsuariosList` de a uno, cada uno en
  su commit. Cada componente queda con su `fetchPage`, su `renderItem` y sus textos.
- Envolver en `<Suspense>` las cuatro páginas de `app/` que montan un listado. El fallback es el
  mismo `LoadingState` que la lista muestra al cargar.
- Borrar `hooks/useUrlPageParam.ts`.

### Bloque C: formularios

- `hooks/useFormSubmission.ts<K extends string>`: recibe `validate(values): Partial<Record<K,
  string>>` y `onSubmit(values: Record<K, string>)`. Devuelve `busy`, `errors`, `error`,
  `success`, `setSuccess` y un `handleSubmit` que hace lo que hoy hacen los dos formularios:
  lee `FormData`, valida, enfoca el primer inválido, bloquea el doble envío y captura el error con
  el mensaje de respaldo. El foco al aviso de error lo resuelve `Notice focusOnShow` (TASK-026).
- `AltaForm<K extends string>`: `fields: AltaField<K>[]` y `onSubmit(values: Record<K, string>)`.
  Las cuatro altas declaran sus nombres de campo como literales. `AltaCursada` reemplaza el
  cast por una validación que estreche el tipo (`isCuatrimestre(value)`).
- `AccountForm` usa `useFormSubmission`. Conserva sus cinco modos y su lógica propia (token de
  reset, redirecciones, `returnTo`). Partirlo en un componente por modo queda fuera.

### Tests y documentación

- Actualizar los tests de caracterización de TASK-023 donde el comportamiento cambia a
  propósito (sección 5), con un comentario que diga qué cambió.
- Tests nuevos: `useUrlPagination` (lee de la URL, `setPage(1)` borra el parámetro, conserva
  otros parámetros), `PaginatedListView` (cuatro estados, `notFoundAction`, `summary`),
  `PageHeader` (foco al montar y al cambiar `focusKey`), `useFormSubmission` (doble envío, foco
  al primer inválido, error con mensaje de respaldo) y un test de tipos que confirme que
  `values.campoInexistente` no compila.
- `front/OVERVIEW.md`: sección "Cómo armar una pantalla" con los tres patrones.

## 3. Fuera de alcance

- Quitar `?nombre`, `?anio` y `?cuatrimestre` de la URL del drill-down: necesita endpoints de
  detalle en el backend (Etapa 5).
- Cualquier cambio visual, incluido unificar dónde aparecen eyebrow y breadcrumb. Eso es
  consistencia de pantallas (Etapa 6).
- Pantallas de guard y acceso denegado (Etapa 6).
- Partir `AccountForm` por modo.
- Validación de formularios con esquemas compartidos con el backend (Etapa 5).
- `FeatureCarousel` y `SiteHeader`, que no son pantallas.

## 4. Decisiones de diseño

1. **Una tarea en tres PRs: encabezado, listados y formularios (propuesta).** Los tres bloques
   son independientes entre sí y tocan archivos distintos. Revisarlos juntos sería un PR de
   unos 20 archivos con tres tipos de cambio mezclados. Van en el orden A, B, C porque B y C usan
   `PageHeader`.
2. **La estructura se unifica y el aspecto no (propuesta).** Todas las pantallas pasan a tener el
   mismo armado (`section` con `aria-labelledby`, id único y foco gestionado), pero cada una
   conserva el eyebrow, el breadcrumb y los textos que tiene hoy. Decidir que todas las pantallas
   internas lleven breadcrumb es una decisión de diseño de la Etapa 6.
3. **La URL es la única fuente de la página, y se sigue navegando con `replace` (propuesta).**
   Esto corrige el desfase de la sección 1 sin cambiar cómo funciona el botón atrás: hoy no pasa
   por las páginas de la lista, y sigue sin pasar. Alternativa: navegar con `push`, para que atrás
   recorra las páginas. Cambia la experiencia de navegación, así que conviene decidirlo con
   producto aparte.
4. **`AsyncState` discriminado para los dos hooks de datos (propuesta).** Con una unión
   discriminada, TypeScript impide leer `data` sin haber verificado `status === "ready"`, y el
   estado "error con el resultado anterior" deja de poder representarse. Usar la misma forma en
   `usePaginatedFetch` y `useAllPages` elimina la segunda convención.
5. **Cambios de comportamiento buscados, y solo estos:**
   - tocar la sección del sidebar en la que ya se está vuelve a la página 1;
   - cambiar de recurso (por ejemplo, de materia) borra `?page`;
   - desaparece la petición extra con la página anterior al cambiar de recurso.

   Cualquier otro cambio de comportamiento es una regresión.

## 5. Criterios de aceptación

- `grep -rn 'headingRef' front/src` no devuelve resultados: todo usa `PageHeader` o
  `useFocusOnMount`.
- `grep -rn 'handlePageChange\|useUrlPageParam' front/src` no devuelve resultados.
- `grep -rn 'as Cuatrimestre' front/src` no devuelve resultados.
- `MateriasList`, `CursadasList`, `ComisionesList` y `UsuariosList` tienen menos de 40 líneas
  cada uno y no contienen ramas de estado propias.
- En `AltaMateria`, escribir `values.nombr` es un error de compilación (`npm run typecheck`
  falla si se introduce).
- Los tests de caracterización de TASK-023 pasan. Las únicas excepciones son los que fijaban
  los comportamientos de la decisión 5: se actualizan y llevan un comentario.
- Los tests nuevos de la sección 2 pasan.
- El spec visual de TASK-023 pasa sin regenerar capturas.
- Los 12 e2e de `auth.browser.spec.mjs` pasan: `AccountForm` cambió por dentro.
- `npm run lint`, `typecheck`, `test` y `build` del workspace `front` pasan. Con ESLint activo,
  `react-hooks/exhaustive-deps` no reporta nada en los hooks nuevos, y se borran las dos
  directivas `eslint-disable` actuales.

## 6. Validación

Pendiente de ejecución.

### Pruebas manuales para el desarrollador

- Materias: ir a la página 2 con "Siguiente". La URL muestra `?page=2`. Recargar mantiene la
  página 2. Tocar "Materias" en el sidebar vuelve a la página 1 y quita `?page`.
- Entrar a una materia y luego a otra desde la lista: la segunda arranca en la página 1.
- Con el backend apagado, abrir Materias: aparece el error con "Reintentar". Prender el backend
  y tocar "Reintentar": carga la lista.
- Abrir una cursada con un id inexistente en la URL: aparece el enlace para volver a las
  cursadas, no "Reintentar".
- Usuarios: el total de cuentas sigue arriba de la lista.
- Las cuatro altas: errores por campo con foco al primero, doble clic en "Crear" envía una sola
  vez, el éxito limpia el formulario, y un nombre duplicado muestra el error del servidor con
  foco.
- Login, registro, recuperación, reset y cambio de contraseña: mismo recorrido que antes.
- Con un lector de pantalla (u observando el foco con Tab), cada cambio de pantalla anuncia el
  título nuevo.

## 7. Riesgos

1. **El componente puede remontarse o no al navegar.** Cómo se comporta el App Router con la
   misma ruta y distinto `searchParams` determina si el bug de la sección 1 aparece hoy en cada
   caso. Leer la página de la URL en cada render lo resuelve en ambos escenarios. Igual hay que
   confirmar con la prueba manual del sidebar.
2. **`AccountForm` es auth.** Es el formulario más delicado: token de reset en memoria,
   coordinación entre pestañas, redirecciones. El bloque C se apoya en los 12 e2e de auth y no
   cambia nada de `services/auth.ts`.
3. **Tipos genéricos en componentes.** `AltaForm<K>` necesita que TypeScript infiera `K` de
   `fields`. Si la inferencia no alcanza, se declaran los nombres con `as const` en cada alta.
   No se vuelve a `string`.
