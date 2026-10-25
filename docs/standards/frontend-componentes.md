# Frontend: Componentes

Estándar para componentes, utilidades y nombres de `front/src`. Sale de
[TASK-029](../tasks/finished/TASK-029-front-primitivas-de-ui.md) (primitivas) y
[TASK-030](../tasks/finished/TASK-030-front-patrones-de-pantalla.md) (encabezado y listados).

## Regla 1: `components/ui/` no sabe nada del negocio

| Carpeta | Qué va | Puede importar |
|---|---|---|
| `components/ui/` | Primitivas genéricas: no nombran materias, cuentas ni roles. | `lib/`, hooks genéricos (`useFocusOnMount`, `usePaginatedFetch`) y el tipo `PaginatedResult` de `services/pagination`. Nunca `services/<módulo>`, `types/` de dominio ni `components/<módulo>/`. |
| `components/<módulo>/` | Componentes de un módulo: `home/`, `academic/`, `admin/`, `auth/`. `admin/` reúne las pantallas de `/home/admin/**`, aunque consuman servicios de `academic` o `users`. | Todo lo anterior, más servicios, tipos y validaciones de su módulo. |

Un componente nuevo va en la carpeta de su módulo. Pasa a `ui/` solo cuando otro módulo lo
necesita y se le puede quitar todo el dominio; si no, se queda en su módulo aunque se reuse
dentro de él (por ejemplo `AltaForm` en `admin/`). Al moverlo se actualizan los imports; no se
deja una reexportación en la ruta vieja.

**Por qué:** `Breadcrumb` y `Pagination` vivían en `academic/` y los importaba `admin/`. Una
primitiva con dominio adentro arrastra ese dominio a cada pantalla que la usa.

## Regla 2: si existe la primitiva, se usa la primitiva

| Primitiva | Cuándo usarla | Cuándo no |
|---|---|---|
| `Card` | Superficie con borde. `variant`: `panel` (contenido de una sección o formulario), `empty` (bloque vacío grande), `profile` (perfil), `auth` (formularios públicos de cuenta). `as` cambia el elemento. | Tarjetas del carrusel de la landing (`.feature-card`, con posicionamiento 3D propio). |
| `Notice` | Aviso de error (`role="alert"`), éxito o advertencia (`role="status"`), con `tone`. `focusOnShow` mueve el foco al aviso al aparecer. | `focusOnShow` en errores de carga de un listado: el `alert` ya se anuncia, y robar el foco interrumpe el teclado. Se usa solo en errores de envío. |
| `EmptyState` | Listado sin resultados: mensaje y `action` en línea dentro de un panel. Con `symbol`/`title`/`badge`, el bloque de Inicio y Próximamente. | Un error: eso es `Notice`. |
| `Badge` | Etiqueta corta, `tone`: `role` (rol de la cuenta), `upcoming` (Próximamente), `solid` (fondo primario con texto blanco), `soft` (fondo suave con texto primario) u `outline` (superficie con borde y texto atenuado). Los mapeos de dominio (ej. cargo a tono) viven en `lib/format/`. | Texto que no es una etiqueta. |
| `FormField` | Campo con `label`, `input` (`type`, `autoComplete`, `numeric`) o `<select>` (`options`), `hint` y `error` enlazados con `aria-describedby` y `aria-invalid`. | Controles que no son de un formulario de datos, como los chips de filtro de Materias. |
| `FilterChips` | Grupo de chips de selección única con `aria-pressed` (`label`, `options: { value, label }[]`, `value`, `onChange`, `labelHidden?`). | Multiselección (para eso se usan checkboxes) o listas que no son de filtrado. |
| `Breadcrumb` | Ubicación actual, como lista de `{ label, href? }`. Se pasa por `PageHeader`. | Pantallas sin nivel padre (ver [frontend-pantallas.md](./frontend-pantallas.md#encabezado)). |
| `BackLink` | Enlace "Volver" con destino accesible (`{ href, label }`). Se pasa a `PageHeader` por la prop `back` o se usa suelto en pantallas con nivel padre. | Botones de volver atrás en el historial (va a un destino conocido, no `router.back()`). |
| `Pagination` | Anterior/Siguiente de un listado paginado. | Directamente en una pantalla de listado: ya la incluye `PaginatedListView`. |
| `PageHeader` | Encabezado de toda pantalla interna: `id`, `title`, `description?`, `eyebrow?`, `breadcrumb?`, `back?`, `focusKey?`. | Títulos de subsección (`h2`). |
| `Dialog` | Modal sobre `<dialog>` con `showModal()` (hoja inferior bajo 600px), controlado por `open` y `onClose`. `title` es el único `h2` y da el nombre accesible; `description?` lo describe; `busy` impide cerrar por Escape o "Cerrar". El foco inicial va al primer control del cuerpo; otro control se marca con `data-autofocus`, no con `autoFocus` de React, que enfoca al montar, antes de `showModal()`, y se pierde. El pie lo arma quien lo usa con `.dialog-actions`: la acción principal va al final en el DOM, así queda al final en escritorio y primera en móvil. Clic en el fondo no cierra. | Confirmaciones o alertas (`role="alertdialog"`) y formularios largos o que no vuelven al mismo listado (ver [frontend-pantallas.md](./frontend-pantallas.md#alta-en-modal)). |
| `PaginatedListView` | Estados de un listado paginado: carga, error con Reintentar (o `notFoundAction` ante un 404), vacío (`empty`) y paginación. `children` recibe la página. | Listados con la página en estado local, como el historial de una materia: ahí se usa `usePaginatedFetch` directo. |
| `RowLink` | Fila clickeable que actúa como un único enlace (`href`, `children`, `detail?`, `trailing?`, `current?`). Todo el `li` es un enlace con chevron SVG decorativo (`aria-hidden`) y estados hover/foco. | Filas con más de una acción interactiva o controles anidados (botones, selects, etc.). |

No hay componente `Button`: un botón es un `<button>` con la clase `.button` (más
`button-secondary` o `submit`), ver la regla 3 de [frontend-estilos.md](./frontend-estilos.md).

Una variante nueva de una primitiva se agrega a la primitiva, con su clase en
`styles/components/`; no se arma la misma estructura a mano en la pantalla. **Por qué:** cuatro
listados y dos formularios con el mismo markup copiado eran el problema que resolvió TASK-029.
Cambiar una primitiva cambia todas las pantallas; cambiar una copia, una sola.

## Regla 3: formatos y textos repetidos tienen un solo lugar

- `lib/format/` formatea valores para mostrar: `periodo.ts` (`periodoLabel`,
  `CUATRIMESTRE_LABEL`), `role.ts` (`ROLE_LABEL`) y `cargo.ts` (`CARGO_LABEL`, `CARGO_TONE`,
  `cargoLabel`). Un enum del dominio se traduce con un `Record<Enum, string>` acá, no con un ternario
  en el componente.
- `lib/messages.ts` reúne los textos de interfaz que aparecen en dos o más archivos
  (`SESSION_CHECK_FAILED`, `LOGOUT_UNCONFIRMED`, `SELECT_PLACEHOLDER`). Un texto que aparece en un
  solo archivo se queda en su componente.

**Por qué:** la etiqueta de rol estaba escrita tres veces con un ternario. Un catálogo con todos
los textos, en cambio, aleja el copy del componente sin ganar nada mientras no haya traducción
(TASK-029, decisión 4).

## Regla 4: dominio en español, genérico en inglés

- Lo que nombra algo del negocio va en español: `MateriasList`, `AltaForm`, `useMateria`,
  `listarMaterias`, `periodoLabel`.
- Lo que no sabe nada del negocio va en inglés: `Card`, `Notice`, `PageHeader`,
  `useUrlPagination`, `usePaginatedFetch`, `.button`, `.card-panel`.
- Las carpetas de módulo usan el nombre del módulo del back (`academic`, `auth`), y las clases CSS
  de un módulo llevan su prefijo (`.academic-list`).
- Documentación, textos visibles y commits van en español
  ([git-workflow.md](./git-workflow.md)).

**Por qué:** es el criterio que ya seguía el código. Pasar todo a inglés obliga a traducir
términos como "cursada" o "comisión", que no tienen un equivalente claro.

## Referencia

`front/src/components/ui/`, `front/src/lib/`, `front/src/components/admin/AltaForm.tsx`.
