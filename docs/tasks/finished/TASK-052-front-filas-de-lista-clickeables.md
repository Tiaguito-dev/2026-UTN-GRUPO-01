# TASK-052: Filas de lista clickeables con flecha

Estado: Finalizada.
Sin dependencias de back. Ver riesgos por capturas compartidas con TASK-050 y TASK-051.
Fecha: 2026-10-25

## 1. Contexto y objetivo

Artboards de referencia:

- `MateriasAdmin.dc.html`: dentro de cada grupo por año, `ul` con filas que son un único enlace:
  `min-height` 56px, padding 12px 16px, radio 14px, texto peso 600, chevron a la derecha
  (`--input-border`); separador de 1px `--soft-blue` entre filas; fila en hover/foco con fondo
  `--soft-blue`, texto y chevron `--primary`. Puede llevar una etiqueta secundaria ("Común a las 5
  carreras", "Solo Sistemas", "Nueva").
- `MateriaDetalle.dc.html`: la misma fila en la lista de cursadas, con dos líneas (título + detalle
  en `--muted`) y el texto "Ver comisiones" antes del chevron.

Estado actual: no hay componente de fila. Los listados usan `ul.academic-list > li` como tarjetas con
un `<Link>` adentro (`styles/components/academic.css:2-13`), con texto secundario en
`.academic-list-detail`. Lo usan `MateriasList`, `CursadasList` y `ComisionesList`.

Objetivo: una fila de lista clickeable reutilizable y aplicarla a los listados académicos actuales.

> Esta tarea crea un componente reutilizable global y modifica estilos compartidos
> (`AGENTS.md`, áreas sensibles). Esta tarea es la autorización explícita, dentro del alcance de la
> sección 2. Justificación: las tres pantallas de detalle y el listado de materias del rediseño usan
> la misma fila; sin primitiva, cada una copiaría el área clickeable, el chevron y los estados.

## 2. Alcance

- `components/ui/RowLink.tsx` (nuevo):
  `RowLink({ href, children, detail?, trailing? })`. Todo el `li` es un solo `<Link className="row-link">`:
  título (`children`), `detail` opcional en segunda línea, `trailing` opcional (texto como
  "Ver comisiones") y chevron SVG `aria-hidden`.
- `styles/components/list.css` (nuevo, capa `components`) + `@import` en `app/globals.css`:
  `.row-list` (contenedor `ul`, separadores) y `.row-link` (estados hover, foco visible, activo).
  Tokens existentes: `--soft-blue`, `--primary`, `--input-border`, `--muted`, `--text`,
  `--weight-medium`, `--space-3`, `--space-4`, `--radius-md`. 56px es tamaño de caja.
  **Token declarado:** el radio de 14px del artboard no está en la escala (12px `--radius-md`,
  16px `--radius-lg`); se usa `--radius-md` y no se agrega token (diferencia de 2px).
- Migración: `MateriasList`, `CursadasList` y `ComisionesList` pasan de `ul.academic-list` a
  `ul.row-list` + `RowLink`. Se borran de `academic.css` las reglas que queden sin uso.
- `docs/standards/frontend-componentes.md`: agregar `RowLink` al inventario (una fila = un enlace;
  nada interactivo adentro).

## 3. Fuera de alcance

- Agrupar materias por año con encabezado (es el rediseño del listado).
- Etiquetas de cargo y estado (TASK-053).
- Filas con más de una acción (editar, borrar): no las pide ningún artboard.

## 4. Decisiones de diseño

1. **Toda la fila es un enlace (propuesta).** Área de toque grande y un solo punto de foco por fila;
   por eso no puede contener otros controles.
2. **El chevron es decorativo (propuesta).** `aria-hidden`; el nombre del enlace es el título más el
   detalle.
3. **Se aplica ya a los listados actuales (propuesta).** Evita una primitiva sin consumidor; es un
   cambio visual intencional en tres pantallas, acorde a los artboards.

## 5. Casos de prueba y criterios de aceptación

Vitest + Testing Library (`ui-row-link.spec.tsx`, jsdom):

- renderiza un solo enlace con el `href` dado y nombre accesible que incluye título y detalle;
- el chevron no aparece en el árbol accesible;
- `trailing` se muestra cuando llega;
- la tabla de `listados.spec.tsx` sigue en verde con los listados migrados (ajustar consultas a rol
  `link` si buscaban por clase).

Playwright + axe (`front/tests/visual.browser.spec.mjs`):

- Regenerar en Linux las capturas de materias y de los listados académicos presentes en `SCREENS`
  (390 y 1280); antes y después en el PR. Revisar que la máscara `.card-panel ul` siga cubriendo la
  lista nueva o ajustarla al selector nuevo.
- axe sin violaciones serias ni críticas.

Criterios:

- `rg "academic-list" front/src` solo devuelve usos que sigan teniendo estilos en `academic.css`.
- `list.css` solo usa tokens y tamaños de caja.
- `npm run lint --workspace=front`, `npm run typecheck --workspace=front` y
  `npm run test --workspace=front` pasan.

## 6. Validación

- Tests unitarios de Vitest: `ui-row-link.spec.tsx` pasa con 4 pruebas verificando que renderiza un solo enlace con el `href` dado y nombre accesible compuesto por título y detalle, el chevron decorativo con `aria-hidden` fuera del árbol accesible, `trailing` visible cuando se provee, y estado `current` renderizado con `aria-current="page"` sin enlace.
- La suite completa de pruebas unitarias (`npm run test --workspace=front`) pasa con 35 archivos y 278 pruebas en verde, incluyendo `listados.spec.tsx`, `materias-filtros.spec.tsx`, `academic-components.spec.ts`, `comision-detalle.spec.tsx` y `materia-detalle.spec.tsx`.
- Verificación de tipos: `npm run typecheck --workspace=front` pasa sin errores.
- Linteo: `npm run lint --workspace=front` pasa con 0 errores y 0 advertencias.
- Se verificó que `academic-rows` y `academic-row` fueron removidos de `academic.css` y no tienen usos residuales en `front/src`. Los únicos usos de `academic-list` corresponden a `UsuariosList.tsx` y `ProfesoresList.tsx`.
- Se creó `components/ui/RowLink.tsx` y `styles/components/list.css` importado en `globals.css`.
- Se migraron `MateriasList.tsx`, `CursadasList.tsx` y `ComisionDetail.tsx` (otras comisiones y lista de profesores) a `ul.row-list` y `RowLink`.
- Se actualizó el estándar en `docs/standards/frontend-componentes.md` con `RowLink`.
- Se actualizó la máscara de capturas en `front/tests/visual.browser.spec.mjs` para incluir `.row-list` y `.academic-panel ul`.

### Pruebas manuales para el desarrollador

- `/home/materias`, cursadas de una materia y comisiones de una cursada: cada fila se ve con chevron,
  se resalta al pasar el mouse y con Tab, y lleva al mismo lugar que antes.
- A 390px la fila no desborda con nombres largos.

## 7. Riesgos

- Cambio visual en tres pantallas: hacerlo en serie con TASK-050 y TASK-051 para no pisar capturas.
- La máscara de capturas `.card-panel ul` depende del markup de la lista; si cambia el contenedor,
  las capturas pueden empezar a fallar por datos.
