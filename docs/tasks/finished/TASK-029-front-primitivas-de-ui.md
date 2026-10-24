# TASK-026: Primitivas de UI compartidas en el frontend

Estado: Pendiente. Decisiones 1 a 4 propuestas, a confirmar por el desarrollador antes de mover
la tarea a `in-progress/`. Depende de TASK-023 y TASK-025.
Fecha: 2026-10-21

## 1. Contexto y objetivo

El frontend no tiene una capa de componentes de UI genéricos. Lo que se reutiliza se reutiliza
copiando clases o importando desde un módulo de dominio. Inventario sobre `desarrollo`
(`253c650`):

- **Paneles y tarjetas.** Cinco clases casi iguales (superficie, borde, radio 1.5rem, padding
  fluido), cada una con su padding y su sombra: `.system-empty`, `.academic-panel`,
  `.profile-card`, `.auth-card` y `.feature-card`. `.academic-panel` se usa también fuera de lo
  académico: en `AdminPanel.tsx:22` y `AltaForm.tsx:90` (envuelve un formulario), y en
  `UsuariosList.tsx:31,33`.
- **Avisos.** `.notice` aparece en 11 lugares con elementos distintos. Va como `<p>` en
  `MateriasList.tsx:24`, `CursadasList.tsx:25`, `ComisionesList.tsx:37`, `UsuariosList.tsx:28`,
  `AccountForm.tsx:132` y `RequireGuest.tsx:20`. Va como `<div>` en `opciones.tsx:20-24`,
  `AltaForm.tsx:92-93` y `AccountForm.tsx:133-134`. Solo `AltaForm` y `AccountForm` mueven el
  foco al error.
- **Estados vacíos.** En los 4 listados son un `<p>` dentro de `.academic-panel`; en Inicio y
  Próximamente, un bloque `.system-empty` con símbolo, título y acción.
- **Badges.** `.profile-role` (badge del perfil) se usa como badge de rol en
  `UsuariosList.tsx:37`, y `.upcoming-badge` del carrusel en `UpcomingSection.tsx:20`.
- **Campos de formulario.** El mismo armado de label, input/select, hint, error y
  `aria-describedby` aparece en `AccountForm.tsx:16-18` (componente `Field`) y en
  `AltaForm.tsx:96-110` (inline). El filtro de materia de `AltaComision.tsx:20-27` lo vuelve a
  escribir a mano y sin la estructura de error.
- **Componentes genéricos en un módulo de dominio.** `Breadcrumb` y `Pagination` están en
  `components/academic/`, pero los importan `AltaForm.tsx:5` y `UsuariosList.tsx:8-9`.
  `periodo.ts` también vive en `components/academic/`, y lo importan una página de `app/` y dos
  altas.
- **Etiqueta de rol duplicada.** `role === "ADMIN" ? "Administrador" : "Usuario"` está en
  `AccountPanel.tsx:18`, `:19` y `UsuariosList.tsx:37`. El caso análogo ya está bien resuelto con
  `CUATRIMESTRE_LABEL: Record<Cuatrimestre, string>` (`periodo.ts:3`).
- **Textos repetidos.** "No pudimos comprobar tu sesión. Intentá nuevamente." aparece en
  `AuthProvider.tsx:35`, `RequireAuth.tsx:20` y `RequireGuest.tsx:21`; el aviso de cierre de
  sesión fallido, en `AuthProvider.tsx:99` y `LogoutButton.tsx:20`; "Elegí una opción", en
  `AltaForm.tsx:103` y `AltaComision.tsx:23`.
- **Tipo con dos orígenes.** `usePaginatedFetch.ts:3` importa `PaginatedResult` desde
  `services/academic` (que lo reexporta en `academic.ts:11`), y `useAllPages.ts:3` lo importa
  desde `services/pagination`, que es donde está definido.

Objetivo: crear `components/ui/` y `lib/` con las primitivas que estos patrones piden, y migrar a
ellas todos los consumidores actuales, **sin cambio visual ni de comportamiento**. Profesores,
Experiencias, Reseñas y Comunidad se van a construir sobre estas piezas en vez de copiar
pantallas.

Es la Etapa 3 del plan de refactorización del frontend. Requiere los estilos ya ordenados por
capas (TASK-025) y la línea base de capturas y los tests de caracterización (TASK-023).

> Crea y modifica componentes reutilizables globales, que `AGENTS.md` lista como área sensible.
> Esta tarea es la autorización explícita para hacerlo, dentro del alcance de la sección 2.

## 2. Alcance

### 2.1 Primitivas nuevas en `front/src/components/ui/`

| Componente | Reemplaza | Props mínimas |
|---|---|---|
| `Card` | `.academic-panel`, `.system-empty`, `.profile-card`, `.auth-card` | `variant: "panel" \| "empty" \| "profile" \| "auth"`, `as?`, `children` |
| `Notice` | los 11 `.notice` | `tone: "error" \| "success" \| "warning"`, `focusOnShow?: boolean`, `children` |
| `EmptyState` | vacíos de los 4 listados y de Inicio/Próximamente | `children` (mensaje), `action?`, `symbol?`, `title?`, `badge?` |
| `Badge` | `.profile-role`, `.upcoming-badge` | `tone: "role" \| "upcoming"`, `children` |
| `FormField` | `Field` de `AccountForm`, campo inline de `AltaForm`, filtro de `AltaComision` | `name`, `label`, `hint?`, `error?` y `input` (`type`, `autoComplete`, `numeric`) u `options` |
| `Breadcrumb` | se **mueve** desde `components/academic/` | sin cambios |
| `Pagination` | se **mueve** desde `components/academic/` | sin cambios |

- `Card` respeta el padding, el ancho máximo y la sombra que hoy tiene cada clase. La variante
  `feature` no se crea: `.feature-card` tiene posicionamiento 3D propio y sigue en el carrusel.
- `Notice` renderiza siempre un `<div>`. El rol sale del tono: `alert` para `error` y `status`
  para el resto. Con `focusOnShow` toma `tabIndex={-1}` y recibe el foco al aparecer, que es lo
  que `AltaForm` y `AccountForm` hacen hoy a mano con `errorRef`.
- Los estilos de cada primitiva van en `src/styles/components/` (estructura de TASK-025), con
  nombres neutros: `.card`, `.card-panel`, `.card-empty`, `.badge`, `.badge-role`, etc. Las
  clases viejas se borran cuando no les queda ningún consumidor.

### 2.2 Utilidades nuevas en `front/src/lib/`

- `lib/format/periodo.ts`: se **mueve** `periodo.ts` sin cambios.
- `lib/format/role.ts`: `ROLE_LABEL: Record<Role, string>` con `ADMIN: "Administrador"` y
  `USER: "Usuario"`.
- `lib/messages.ts`: constantes para los textos que se repiten en dos o más archivos (decisión
  4). Cubre como mínimo los tres casos de la sección 1.

### 2.3 Migración de consumidores

Un commit por módulo, en este orden: `home/`, `academic/`, `admin/`, `auth/`.

- Reemplazar cada `className` de la sección 1 por la primitiva correspondiente.
- `AccountForm`: borrar `Field` y usar `FormField`. `AltaForm`: reemplazar el campo inline.
  `AltaComision`: el filtro de materia pasa a `FormField` y queda con la misma estructura que el
  resto. No recibe validación: no forma parte del alta (`AltaComision.tsx:14-15`).
- `AccountPanel` y `UsuariosList` usan `ROLE_LABEL`.
- Imports: `usePaginatedFetch` importa `PaginatedResult` desde `services/pagination`. Se borra
  la reexportación de `services/academic.ts:11` si no queda ningún consumidor.
- Actualizar los imports de `tests/academic-components.spec.ts` a las rutas nuevas. No se dejan
  reexportaciones en las rutas viejas.

### 2.4 Tests y documentación

- Un spec por primitiva (`tests/ui-*.spec.ts`, en jsdom según TASK-023): rol y elemento de
  `Notice` por tono, foco con `focusOnShow`, `aria-describedby` e `aria-invalid` de `FormField`
  con y sin hint o error, variantes de `Card`, y `EmptyState` con y sin acción.
- `front/OVERVIEW.md`: actualizar la sección "Estructura" con `components/ui/` y `lib/`, más una
  tabla corta de primitivas que diga cuándo usar cada una.

## 3. Fuera de alcance

- Unificar los paddings, anchos y sombras de las variantes de `Card`, o cualquier otro cambio
  visual. Va en la tarea de normalización de tokens.
- `PageHeader`, foco del título y esqueleto de listados (`PaginatedListView`): son de la Etapa 4.
- Lógica de envío de formularios (`useFormSubmission`): es de la Etapa 4. Acá solo se extrae el
  markup del campo.
- Pantallas de guard (`RequireAuth`, el estado de error temporal de `RequireGuest`) y acceso
  denegado: adoptar `Notice` o `Card` ahí agrega un recuadro que hoy no existe. Se resuelven en
  la Etapa 6.
- Un componente `Button`: con `.button` y `.button-secondary` de TASK-025 alcanza por ahora.
- Mensajes que aparecen una sola vez, que se quedan en su componente.

## 4. Decisiones de diseño

1. **Sin cambio visual: las variantes reproducen lo que hay (propuesta).** Unificar los cinco
   paneles es el objetivo final, pero hacerlo en la misma tarea que la migración mezcla "moví el
   componente" con "cambié el diseño", y una regresión no se podría atribuir a ninguno de los dos.
   La normalización queda como paso aparte, sobre primitivas ya centralizadas, donde cambiar un
   valor actualiza todas las pantallas a la vez.
2. **`components/ui/` y `lib/`, con nombres en inglés para lo genérico (propuesta).** Hoy el
   criterio implícito es dominio en español (`AltaForm`, `listarMaterias`) e infraestructura en
   inglés (`usePaginatedFetch`, `SidebarNav`). Las primitivas son infraestructura y siguen ese
   criterio. Se escribe en `front/OVERVIEW.md` para que deje de ser implícito.
3. **`Notice` siempre es `<div>` y el foco es opcional con una prop (propuesta).** El elemento
   no cambia nada visible, porque `.notice` fija sus propios márgenes. Se conserva qué avisos
   reciben foco y cuáles no, para que no cambie lo que anuncia el lector de pantalla. Decidir si
   los errores de los listados también deberían recibir foco es un cambio de comportamiento, y
   va en la Etapa 6.
4. **El catálogo de mensajes cubre solo lo repetido (propuesta).** Un catálogo con todos los
   textos aleja el copy del componente que lo muestra y no gana nada mientras no haya traducción.
   Entra lo que aparece en dos o más archivos.
5. **Mover sin reexportar.** Dejar `components/academic/Breadcrumb.ts` reexportando desde `ui/`
   mantendría vivo el camino equivocado. Se actualizan todos los imports, que son pocos y quedan
   verificados por `typecheck`.

## 5. Criterios de aceptación

- Existen `components/ui/{Card,Notice,EmptyState,Badge,FormField,Breadcrumb,Pagination}.tsx`,
  `lib/format/{periodo,role}.ts` y `lib/messages.ts`.
- Estas búsquedas no devuelven resultados en `front/src`:
  - `grep -rn 'className="notice' front/src` (todos los avisos usan `Notice`, salvo los guards
    de la sección 3, que se listan en la sección 6).
  - `grep -rn 'academic-panel\|profile-role\|upcoming-badge' front/src`.
  - `grep -rn '"Administrador" : "Usuario"' front/src`.
  - `grep -rn 'components/academic/\(Breadcrumb\|Pagination\|periodo\)' front tests`.
- El spec visual de TASK-023 pasa **sin regenerar capturas**.
- Los tests de caracterización de TASK-023 pasan sin cambios, salvo los imports.
- Los specs nuevos de `tests/ui-*.spec.ts` pasan.
- `npm run lint`, `typecheck`, `test` y `build` del workspace `front` pasan.
- `front/OVERVIEW.md` documenta `components/ui/`, `lib/`, la tabla de primitivas y el criterio de
  idioma.

## 6. Validación

Pendiente de ejecución.

### Pruebas manuales para el desarrollador

- Recorrer Inicio, Profesores (Próximamente), Materias hasta Comisiones, Administración, las
  cuatro altas, Usuarios, Perfil, login, registro y recuperación. Nada tiene que verse distinto.
- En una alta, enviar el formulario vacío: los errores aparecen por campo y el foco va al
  primero. Después forzar un error del servidor (por ejemplo, un nombre duplicado): el aviso rojo
  aparece y recibe el foco, igual que antes.
- Con el backend apagado, abrir Materias: el error con "Reintentar" se ve igual que antes y no
  roba el foco.
- En Nueva comisión, el filtro de materia sigue cambiando las cursadas disponibles.

### Avisos que siguen con `className="notice"` (completar al implementar)

- `VerifyEmail.tsx:38`: no coincide con la búsqueda (`className={`notice ...`}`), pero sigue
  armando la clase a mano. Tiene un estado `pending` sin tono (`notice` solo, sin color) que
  `Notice` no contempla, y mueve el foco cuando el estado deja de ser `pending` con el aviso ya
  montado, no al aparecer. Migrarlo pide un tono neutro o cambiar cuándo recibe el foco.
- Guards de la sección 3: `RequireAuth` y el error temporal de `RequireGuest` no usan `.notice`
  (son `<p role="alert">`), así que no figuran en la búsqueda y siguen igual.
