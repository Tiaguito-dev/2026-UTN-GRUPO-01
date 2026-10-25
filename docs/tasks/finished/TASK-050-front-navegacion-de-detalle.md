# TASK-050: Navegación de detalle: "Volver" + breadcrumb rediseñado

Estado: Finalizada.
Depende de TASK-049 (misma zona de `MateriaDetail.tsx`). Sin dependencias de back.
Fecha: 2026-10-25

## 1. Contexto y objetivo

Artboards de referencia: `MateriaDetalle.dc.html`, `CursadaDetalle.dc.html` y `ComisionDetalle.dc.html`.
Arriba del título, en una fila que hace `wrap`:

- **"Volver"**: enlace con ícono de flecha a la izquierda, `min-height` 48px, borde `--border`,
  radio 12px, fondo `--surface`, peso 650, y `aria-label` que nombra el destino
  ("Volver a Paradigmas de Programación").
- **Breadcrumb**: `nav aria-label="Ubicación actual"` con un `ol` dentro de una barra con borde
  `--border`, radio 12px, padding 4px y fondo `--surface`; cada nivel mide 38px de alto con radio 8px;
  separador chevron SVG; el nivel actual (`aria-current="page"`) va resaltado con fondo `--soft-blue`,
  color `--primary` y peso 650.

Estado actual:

- `components/ui/Breadcrumb.tsx` (`{ items: { label, href? }[] }`) y
  `styles/components/breadcrumb.css` (lista plana, separador `›`, actual en semibold). Lo usan
  `PageHeader` y `MateriaDetail` directo.
- "Volver" hoy es un `<Link>` suelto al pie: `MateriaDetail.tsx:41` (repite el breadcrumb),
  `CursadasList.tsx:20`, `ComisionesList.tsx:31`, `EditarMateria.tsx`, `MateriaForm.tsx:72`.
- `docs/standards/frontend-pantallas.md:69` lo prohíbe: *"Volver" al pie — No, si el breadcrumb ya
  lleva al mismo lugar*; y el checklist de la línea 181: *sin "Volver" que repita el breadcrumb*.

El desarrollador pidió el "Volver" explícitamente. Objetivo: rediseñar la primitiva `Breadcrumb`,
agregar el "Volver" arriba en las pantallas de detalle y actualizar el estándar.

> Esta tarea modifica componentes reutilizables globales (`Breadcrumb`, `PageHeader`) y estilos de
> una primitiva (`AGENTS.md`, áreas sensibles). Esta tarea es la autorización explícita, dentro del
> alcance de la sección 2. Justificación: el breadcrumb es uno solo para todo el sistema; rediseñarlo
> por pantalla rompería la consistencia que dejó TASK-032.

## 2. Alcance

### 2.1 Componentes

- `components/ui/Breadcrumb.tsx`: separador como SVG chevron `aria-hidden` (ya no `::after`).
  Misma API.
- `components/ui/BackLink.tsx` (nuevo): `{ href: string; label: string }` renderiza
  `<Link className="back-link" aria-label={`Volver a ${label}`}>` con ícono + "Volver".
- `components/ui/PageHeader.tsx`: prop opcional `back?: { href, label }`. Si llega, renderiza
  `BackLink` + `Breadcrumb` en una fila (`div.page-nav`) antes del título.

### 2.2 Estilos

- `styles/components/breadcrumb.css`: barra con borde, niveles de 38px, actual resaltado; foco
  visible en cada enlace.
- `.back-link` y `.page-nav` en el mismo archivo (son la misma zona de navegación).
- Tokens: todos existen (`--border`, `--surface`, `--soft-blue`, `--primary`, `--muted`,
  `--radius-md` 12px, `--radius-sm` 8px, `--weight-semibold`, `--weight-medium`, `--text-sm`). 38px y
  48px son tamaños de caja (excepción de `frontend-estilos.md`). No hace falta token nuevo.

### 2.3 Migración

- `MateriaDetail.tsx`: pasa `back` (al listado de origen, `backHref`) y elimina el "Volver" del pie.
- `ComisionesList.tsx` y `CursadasList.tsx` en modo página: `back` al nivel padre; se elimina el
  "Volver" del pie.
- Los "Volver" de estados vacío y de error (404, sin permiso) quedan como están.

### 2.4 Estándar

`docs/standards/frontend-pantallas.md`:

- Fila de la tabla de encabezado (línea 69): reemplazar por *"Volver" arriba — Sí, en pantallas de
  detalle con nivel padre, junto al breadcrumb y con `aria-label` que nombra el destino. Nunca al pie
  repitiendo el breadcrumb. En estados vacío y error se mantiene como salida principal.*
- Checklist (línea 181): actualizar en el mismo sentido.
- Porqué, escrito en el estándar: en móvil el breadcrumb hace `wrap` y queda lejos del pulgar; un
  objetivo de 48px fijo arriba es la salida más rápida, y el pedido vino del desarrollador. Lo que
  sigue prohibido es el duplicado al pie.

## 3. Fuera de alcance

- Pantalla de detalle de cursada o de comisión (no existen; dependen del modelo de TASK-037).
- Títulos con antetítulo ("Paradigmas de Programación" sobre "2do cuatrimestre 2026"): se resuelve
  con `eyebrow` de `PageHeader` en las tareas de esas pantallas.
- "Volver" con `router.back()`: el destino es siempre el nivel padre, conocido por la URL.

## 4. Decisiones de diseño

1. **"Volver" es un enlace, no un botón (propuesta).** Navega a una URL conocida (artboard: `<a>`);
   funciona con clic medio y no depende del historial.
2. **`aria-label` con el destino (propuesta).** "Volver" solo es ambiguo para lectores de pantalla;
   el artboard ya lo trae así.
3. **`BackLink` como primitiva y `back` en `PageHeader` (propuesta).** Las pantallas de detalle usan
   `PageHeader`; la prop evita que cada una arme la fila a mano. `BackLink` suelto sirve para
   `MateriaDetail`, que hoy no usa `PageHeader` (migrarlo a `PageHeader` queda fuera).
4. **El breadcrumb cambia en todas las pantallas a la vez (propuesta).** Es una primitiva global; el
   cambio visual alcanza a todas las capturas con breadcrumb.
5. **Separador SVG en el DOM (propuesta).** El artboard usa chevron; un `::after` con `content` no
   admite SVG con `currentColor` sin máscara. Va `aria-hidden`.

## 5. Casos de prueba y criterios de aceptación

Vitest + Testing Library:

- `ui-breadcrumb.spec.tsx` (nuevo): el último ítem es `aria-current="page"` y no es enlace; los demás
  son enlaces; los separadores no se anuncian (`aria-hidden`).
- `ui-back-link.spec.tsx` (nuevo): nombre accesible "Volver a <destino>", `href` correcto.
- `ui-page-header.spec.tsx`: con `back` renderiza el enlace antes del breadcrumb y del `h1`; sin
  `back` el render actual no cambia.

Playwright + axe (`front/tests/visual.browser.spec.mjs`):

- Regenerar en Linux las capturas que tienen breadcrumb (alta-materia y las de detalle presentes en
  `SCREENS`) a 390 y 1280; antes y después en el PR.
- Agregar a `SCREENS` el detalle de materia (`materia-detalle`) si todavía no está, a 390 y 1280.
- axe sin violaciones serias ni críticas; se mantiene la aserción de "ningún breadcrumb de un solo
  ítem".

Criterios:

- `rg "Volver" front/src/components/academic` no devuelve un "Volver" al pie que repita el breadcrumb.
- `breadcrumb.css` solo usa tokens y tamaños de caja.
- `npm run lint --workspace=front`, `npm run typecheck --workspace=front` y
  `npm run test --workspace=front` pasan.

## 6. Validación

- Tests unitarios de Vitest: `npm run test --workspace=front` pasa con 33 archivos y 269 pruebas, incluyendo `ui-breadcrumb.spec.tsx`, `ui-back-link.spec.tsx`, `ui-page-header.spec.tsx` y `materia-detalle.spec.tsx`.
- Verificación de tipos: `npm run typecheck --workspace=front` pasa sin errores.
- Linteo: `npm run lint --workspace=front` pasa con 0 errores y 0 advertencias.
- Se verificó que `rg "Volver" front/src/components/academic` no devuelve ningún enlace "Volver" redundante al pie repitiendo el breadcrumb. Solo se conservan las salidas para estados de error o no encontrado.
- Se implementó la primitiva `BackLink` con `aria-label="Volver a <destino>"` y la prop `back` en `PageHeader`, agrupando el botón y el breadcrumb dentro de `.page-nav`.
- Se rediseñó el breadcrumb con borde, niveles de 38px, separador SVG chevron `aria-hidden` y resaltado con `--soft-blue` y `--primary` para la página actual.
- Se actualizó el estándar en `docs/standards/frontend-pantallas.md` y `docs/standards/frontend-componentes.md`.

### Pruebas manuales para el desarrollador

- Detalle de materia a 1280 y 390: "Volver" y la barra de ubicación arriba, el nivel actual resaltado;
  en 390 la fila hace `wrap` sin desbordar.
- Tab recorre "Volver" y cada nivel con foco visible.
- Listado de comisiones: "Volver" lleva a la materia; ya no hay "Volver" al pie.
- No se tiene que romper: el 404 de materia sigue mostrando "Volver al listado de materias".

## 7. Riesgos

- Regenera capturas compartidas: si se mergea en paralelo con TASK-051 o TASK-052, conflictos en los
  PNG. Hacerlas en serie.
- Las capturas solo se regeneran en Linux (Docker `mcr.microsoft.com/playwright:v1.64.0-noble`).
- `MateriaDetail` no usa `PageHeader`; usar `BackLink` suelto ahí deja dos formas de armar la fila
  hasta que se migre.
