# Frontend: Pantallas

Estándar para armar o modificar una pantalla de `front/`. Sale de
[TASK-030](../tasks/finished/TASK-030-front-patrones-de-pantalla.md) (patrones),
[TASK-031](../tasks/finished/TASK-031-contratos-front-back-academico.md) (contratos) y
[TASK-032](../tasks/finished/TASK-032-front-consistencia-y-accesibilidad.md) (encabezado, shell y
accesibilidad). Las primitivas que se nombran acá están en
[frontend-componentes.md](./frontend-componentes.md).

Una pantalla nueva se arma combinando estas piezas, no copiando otra pantalla. Al final está el
[checklist](#checklist-de-pantalla-nueva) que se tilda en el PR.

## La página de `app/`

`app/**/page.tsx` es delgada: exporta `metadata` con `title: "<Pantalla> | Profesor Butchery"` y
renderiza un componente de `components/<módulo>/`. Si el componente lee la URL con
`useSearchParams` (también a través de `useUrlPagination`), la página lo envuelve en `<Suspense>`
con el mismo mensaje de carga que muestra el componente:

```tsx
export const metadata: Metadata = { title: "Usuarios registrados | Profesor Butchery" };
export default function UsuariosPage() {
  return <Suspense fallback={<p role="status">Cargando usuarios…</p>}><UsuariosList /></Suspense>;
}
```

**Por qué:** en una ruta prerenderizada, `useSearchParams` hace que Next renderice en el cliente
todo el árbol hasta el `Suspense` más cercano; con el límite en la página, el resto se prerenderiza.
En desarrollo no se nota, porque las rutas se renderizan a pedido.
Un título que depende de un dato del backend lo actualiza el componente con `document.title`
cuando llega el detalle (`ComisionesList`).

## Shell y guards

- `/home/**` y `/account/**` usan `components/home/AppShell.tsx` desde su `layout.tsx`: aporta el
  `<main>`, `RequireAuth` (sesión y aviso de coordinación, una sola vez) y `SidebarNav`.
- La autorización por rol va en el layout del segmento con `RequireRole`
  (`app/home/admin/layout.tsx` usa `roles={["ADMIN"]}`). Sin el rol, muestra "Acceso no
  permitido" dentro del shell. Una pantalla solo para ADMIN vive bajo `/home/admin/**`.
- Una página interna no se envuelve en guards ni en `<main>`.
- Las páginas públicas (login, registro, recuperación, verificación) tienen su propio
  `<main id="main-content" className="page">` con `Card variant="auth"`, y `RequireGuest` donde
  una cuenta autenticada no tiene que verlas.

**Por qué:** un guard por página repetía la comprobación de sesión y el aviso. En el layout, el
guard corre una vez, persiste al navegar y escribir la URL a mano no lo saltea. El backend sigue
siendo la autoridad de permisos.

## Encabezado

Toda pantalla interna es un `<section aria-labelledby>` con el id que crea `useId` y que recibe
`PageHeader`. El `h1` toma el foco al montar y cada vez que cambia `focusKey` (por ejemplo, el id
del recurso). Sin `PageHeader`, `useFocusOnMount(key)` devuelve la ref con el mismo efecto.

```tsx
const headingId = useId();
return <section aria-labelledby={headingId}>
  <PageHeader id={headingId} title="Usuarios registrados" description="…"
    breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Usuarios registrados" }]} />
  …
</section>;
```

| Elemento | Regla |
|---|---|
| `h1` | Siempre uno, vía `PageHeader`, con foco al montar. |
| Breadcrumb | Solo si la pantalla tiene al menos un nivel padre. Nunca de un solo ítem. |
| Eyebrow | Solo en pantallas informativas sin datos (Inicio y Próximamente). |
| "Volver" arriba | Sí, en pantallas de detalle con nivel padre, junto al breadcrumb y con `aria-label` que nombra el destino. Nunca al pie repitiendo el breadcrumb. En estados vacío y error se mantiene como salida principal. |

**Por qué:** con el foco en el `h1`, un lector de pantalla anuncia el cambio de pantalla. Un
breadcrumb de un ítem no orienta, y dos enlaces al mismo destino en la misma pantalla son ruido
(TASK-032, decisión 2). En móvil el breadcrumb hace wrap y queda lejos del pulgar; un objetivo
de 48px fijo arriba es la salida más rápida, y el pedido vino del desarrollador (TASK-050). Lo que
sigue prohibido es el duplicado al pie.

## Patrón 1: listado paginado

La página vive solo en la URL. `useUrlPagination` lee `?page` en cada render y `setPage` navega
con `router.replace`, conservando los demás parámetros (`setPage(1)` quita `page`).
`PaginatedListView` recibe esa página, pide los datos con `usePaginatedFetch` y resuelve carga,
error con Reintentar (o `notFoundAction` ante un 404), vacío y paginación. La pantalla no tiene
ramas de estado propias. `resetKey` nombra lo que se lista (si cambia, el listado vuelve a
cargar); el `action` del vacío es la salida (volver al panel) o lo que lo resuelve (cargar el
primero). Después de crear o editar desde un modal, el padre incrementa `refreshKey`; no se
remonta con `key` ni se navega. Ejemplo: `components/admin/UsuariosList.tsx`.

```tsx
const { page, setPage } = useUrlPagination();
<PaginatedListView resetKey="usuarios" page={page} onPageChange={setPage}
  fetchPage={(next) => listarUsuarios({ page: next })} loadingMessage="Cargando usuarios…"
  empty={<EmptyState action={<Link href="/home/admin">Volver al panel de administración</Link>}>Todavía no hay cuentas registradas.</EmptyState>}>
  {(result) => <Card variant="panel"><ul className="academic-list">{result.items.map(…)}</ul></Card>}
</PaginatedListView>
```

**Por qué:** con la página en el estado del componente y en la URL a la vez, las dos se
desfasaban. Leerla de la URL hace que recargar o compartir el enlace conserve la página. El
listado del back siempre pagina ([paginacion.md](./paginacion.md)).

## Patrón 2: detalle

El dato sale de un endpoint de detalle (`GET /materias/:id`, `GET /cursadas/:id`) a través de un
hook del módulo (`useMateria`, `useCursada`) que devuelve `{ <recurso>, error, notFound, retry }` y
descarta respuestas de un id anterior. Mientras carga, el título dice "Cargando…". Ante un error,
`Notice` con Reintentar, o con el enlace de vuelta si es un 404. La URL lleva solo ids y el
contexto del listado (página, filtros), nunca nombres. Ejemplo: `components/academic/ComisionesList.tsx`.

```tsx
const { cursada, error, notFound, retry } = useCursada(cursadaId);
const title = cursada ? periodoLabel(cursada.anio, cursada.cuatrimestre) : error ? "Período" : "Cargando…";
<section aria-labelledby={headingId}>
  <PageHeader id={headingId} title={title} focusKey={cursadaId} breadcrumb={[…]} />
  {error ? <Notice tone="error">{error} {notFound ? back : <button className="button" type="button" onClick={retry}>Reintentar</button>}</Notice> : null}
  {cursada ? <Card variant="panel">…</Card> : null}
</section>
```

Los hooks de listado devuelven un `AsyncState` discriminado (`loading`, `ready` con `data`,
`error` con `error` y `notFound`), exportado por `hooks/usePaginatedFetch.ts`; `useAllPages` usa
la misma forma para las opciones de los selects. Los hooks de detalle todavía no la adoptaron.

**Por qué:** un nombre que viaja en la URL se puede editar a mano y mostrar algo falso. Con el
detalle del backend, un enlace pegado desde otra pestaña muestra los datos reales (TASK-031,
decisión 2).

## Patrón 3: alta

Las altas del panel usan `AltaForm` (`components/admin/AltaForm.tsx`), que resuelve el envío con
`useFormSubmission`. Cada `AltaField<K>` declara su `name` como literal y `onSubmit` recibe
`values` con esas claves tipadas: `values.nombr` no compila. `onSubmit` devuelve el mensaje de
éxito. Ejemplo: `components/admin/AltaProfesor.tsx`.

```tsx
<AltaForm breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Nuevo profesor" }]}
  heading="Nuevo profesor" description="…" submitLabel="Crear profesor"
  fields={[{ name: "nombreCompleto", label: "Nombre completo", validate: (value) => validateNombre(value, MAX_NOMBRE_PROFESOR) }]}
  onSubmit={async (values) => { const p = await crearProfesor({ nombreCompleto: values.nombreCompleto.trim() }); return `Profesor creado: ${p.nombreCompleto}.`; }} />
```

Un formulario que no es un alta usa `useFormSubmission` directamente, con `FormField` por campo y
`<Notice tone="error" focusOnShow>` para el error de envío. El hook lee `FormData`, valida, enfoca
el primer campo inválido, ignora un segundo envío en curso y convierte la excepción en `error`.
El `<form>` lleva `noValidate` y `aria-busy={busy}`, y el botón de envío queda deshabilitado
mientras dura. Las validaciones de formulario viven en `validations/` y devuelven el mensaje en
español ([validacion-con-zod.md](./validacion-con-zod.md#frontend)).

**Por qué:** cada formulario reimplementaba el anti doble envío, el foco y el manejo de errores.
Los nombres tipados evitan que un error de tipeo compile y falle recién en ejecución.

### Alta en modal

| Cuándo | Cómo |
|---|---|
| Modal (`Dialog`) | Formulario corto que, al guardar, vuelve al mismo listado desde el que se abrió. `busy` del formulario va al `busy` del `Dialog`, y el padre lo cierra en el éxito. |
| Página propia | Formulario largo, con pasos, o que al guardar lleva a otra pantalla. Es el `AltaForm` de arriba. |

**Por qué:** el modal conserva el contexto del listado (filtros, página) sin navegar, pero un
formulario largo en un modal se corta en móvil y no tiene URL a la que volver
([TASK-038](../tasks/pendient/TASK-038-front-primitiva-dialog.md)).

## Datos

Todo servicio de `services/` valida la respuesta con su esquema de `services/schemas.ts`
(`protectedGet`/`protectedPost` reciben el esquema). Una respuesta con forma inesperada termina
en `HttpError(502)` con mensaje en español, que la pantalla muestra con Reintentar como cualquier
otro error. Detalle en [validacion-con-zod.md](./validacion-con-zod.md#frontend).

## Accesibilidad

- **Landmarks.** Un solo `<main>` por pantalla (lo pone `AppShell` o la página pública) y un solo
  landmark "Navegación principal", el `<nav>` del sidebar.
- **Un `h1`** por pantalla, con foco al montar (ver [Encabezado](#encabezado)).
- **Estados.** La carga se anuncia con `role="status"`; los errores, con `Notice tone="error"`
  (`role="alert"`). Solo el error de envío de un formulario recibe foco (`focusOnShow`).
- **Envío en curso** marcado con `aria-busy` en el formulario o el botón.
- **Texto mínimo** `.75rem` (`--text-xs`): ningún `font-size` menor.
- **axe** sin violaciones `serious` ni `critical` en las pantallas del spec visual (ver
  [frontend-tests.md](./frontend-tests.md#playwright-capturas-y-axe)).

**Por qué:** son los defectos que encontró la auditoría y corrigió TASK-032. axe y el spec visual
los vuelven a detectar si reaparecen.

## Checklist de pantalla nueva

Para copiar en la descripción del PR y tildar:

- [ ] La página de `app/` exporta `metadata.title` (`"<Pantalla> | Profesor Butchery"`) y
  renderiza un componente de `components/<módulo>/`.
- [ ] Si el componente usa `useSearchParams` o `useUrlPagination`, la página lo envuelve en
  `<Suspense>` con el mismo mensaje de carga.
- [ ] La página no se envuelve en guards ni en `<main>`. Si es solo para ADMIN, vive bajo
  `/home/admin/**`.
- [ ] `<section aria-labelledby>` con `useId` y `PageHeader`; un solo `h1`, con foco al montar.
- [ ] Breadcrumb solo si hay nivel padre, con "Volver" arriba (`back`) en pantallas de detalle;
  sin "Volver" al pie que repita el breadcrumb. Eyebrow solo si es informativa.
- [ ] Listado: `useUrlPagination` + `PaginatedListView`, sin ramas propias de carga o error.
- [ ] Carga, error (Reintentar, o Volver ante un 404) y vacío (`EmptyState`) cubiertos.
- [ ] Alta: `AltaForm` con nombres de campo literales; errores por campo con foco al primero y
  error de envío con `Notice focusOnShow`.
- [ ] El servicio valida la respuesta con un esquema de `services/schemas.ts`; los nombres que se
  muestran vienen del backend, y la URL lleva solo ids y contexto del listado.
- [ ] Usa las primitivas de `components/ui/` en vez de markup propio; cada `<button>` tiene
  `className="button"` (o una clase propia de componente).
- [ ] CSS nuevo con tokens y en una clase de `styles/components/`; textos repetidos en
  `lib/messages.ts` y formatos en `lib/format/`.
- [ ] Tests según [frontend-tests.md](./frontend-tests.md), y la ruta agregada a
  [front/OVERVIEW.md](../../front/OVERVIEW.md).

## Referencia

`front/src/components/admin/UsuariosList.tsx`, `front/src/components/academic/ComisionesList.tsx`,
`front/src/components/admin/AltaProfesor.tsx`, `front/src/components/home/AppShell.tsx`.
