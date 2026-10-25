# TASK-051: Chips de filtro reutilizables

Estado: Finalizada.
Sin dependencias de back. Ver riesgos por capturas compartidas con TASK-050 y TASK-052.
Fecha: 2026-10-25

## 1. Contexto y objetivo

Artboards de referencia:

- `MateriasAdmin.dc.html`: grupo "Año de la carrera" con chips de selección única: `button` con
  `aria-pressed`, `min-height` 44px, padding 8px 16px, radio de píldora (32px), texto 13.6px; sin
  presionar: borde `--border`, fondo `--surface`, color `--muted`; presionado: borde y fondo
  `--primary`, color blanco, sin sombra.
- `CursadaDetalle.dc.html`: mismo chip en un `div role="group" aria-label="Filtrar por carrera"`
  ("Todas las carreras", "Sistemas (S)", "Química (Q)").

Estado actual: los chips existen solo dentro de `MateriasList` (TASK-026):
`<button className={`button ${styles.chip}`} aria-pressed>` en `div role="group" aria-labelledby`, con
estilos en `components/academic/MateriasList.module.css:81-118` (único CSS Module del proyecto) y una
sombra fuera de escala en el estado presionado.

Objetivo: llevar el chip a una primitiva reutilizable, usarla en `MateriasList` y dejarla lista para
el filtro por carrera de la cursada.

> Esta tarea crea un componente reutilizable global y un archivo de estilos de primitiva
> (`AGENTS.md`, áreas sensibles). Esta tarea es la autorización explícita, dentro del alcance de la
> sección 2. Justificación: el mismo patrón (grupo + `aria-pressed`) aparece en al menos dos
> pantallas del rediseño; hoy vive en un CSS Module que el estándar pide no extender.

## 2. Alcance

- `components/ui/FilterChips.tsx` (nuevo):
  `FilterChips<V extends string>({ label, labelHidden?, options: { value: V; label: string }[], value: V, onChange(value: V) })`.
  Renderiza `div role="group"` nombrado por `label` (visible como `p` enlazado con
  `aria-labelledby`, o `aria-label` si `labelHidden`) y un `button type="button" className="chip"`
  con `aria-pressed` por opción.
- `styles/components/chip.css` (nuevo, capa `components`) + `@import` en `app/globals.css`.
  Tokens: `--border`, `--surface`, `--muted`, `--primary`, `--radius-pill`, `--space-2`, `--space-4`,
  `--text-sm`, foco visible con el anillo existente. 44px es tamaño de caja. Sin tokens nuevos.
- `components/academic/MateriasList.tsx`: el grupo "Año de la carrera" (y el de carrera, si hoy usa
  el mismo chip de píldora) pasa a `FilterChips`; se borran las reglas `.chip`/`.chips` del módulo.
- `docs/standards/frontend-componentes.md`: agregar `FilterChips` al inventario (selección única;
  para multiselección se usan checkboxes).

## 3. Fuera de alcance

- Las "tarjetas" de carrera con letra de `MateriasAdmin.dc.html` (52px, radio 14px, ícono con letra):
  son otra variante y van con el rediseño del listado de materias.
- Multiselección.
- Migrar el resto de `MateriasList.module.css` a `academic.css`.

## 4. Decisiones de diseño

1. **Componente, no solo clase CSS (propuesta).** La parte que se repite y se rompe es la semántica
   (`role="group"`, nombre del grupo, `aria-pressed`); un componente la fija una vez.
2. **Sin sombra en el estado presionado (propuesta).** El artboard no la tiene y el valor actual está
   fuera de escala. Es un cambio visual menor en `/home/materias`.
3. **Selección única controlada (propuesta).** Los dos usos del rediseño son de un valor; el estado
   lo guarda la pantalla (URL o estado local).

## 5. Casos de prueba y criterios de aceptación

Vitest + Testing Library (`ui-filter-chips.spec.tsx`, jsdom):

- el grupo tiene nombre accesible igual a `label` (visible y oculto);
- la opción de `value` tiene `aria-pressed="true"` y las demás `"false"`;
- clic en otra opción llama a `onChange` con su valor;
- clic en la opción ya presionada no llama a `onChange`;
- se recorre con Tab y se activa con Enter y Espacio.

Playwright + axe (`front/tests/visual.browser.spec.mjs`):

- Regenerar en Linux `materias-390` y `materias-1280`; antes y después en el PR.
- axe sin violaciones serias ni críticas.

Criterios:

- `MateriasList.module.css` ya no define `.chip` ni `.chips`.
- Los specs existentes de filtros de materias siguen en verde.
- `npm run lint --workspace=front`, `npm run typecheck --workspace=front` y
  `npm run test --workspace=front` pasan.

## 6. Validación

- Tests unitarios de Vitest: `ui-filter-chips.spec.tsx` pasa con 5 casos de prueba cubriendo nombre accesible (visible y oculto con `labelHidden`), selección única con `aria-pressed`, llamada a `onChange` sólo al presionar una opción distinta, y navegación/activación con teclado (`Tab`, `Enter`, `Espacio`).
- `materias-filtros.spec.tsx` (15 pruebas) y `academic-components.spec.ts` (24 pruebas) siguen pasando en verde.
- Verificación de tipos: `npm run typecheck --workspace=front` pasa sin errores.
- Linteo: `npm run lint --workspace=front` pasa con 0 errores y 0 advertencias.
- Se verificó que `MateriasList.module.css` ya no contiene reglas para `.chip` ni `.chips`.
- Se creó la primitiva `FilterChips` en `components/ui/FilterChips.tsx` y su hoja de estilos en `styles/components/chip.css` importada en `globals.css`.
- Se migró el filtro de año y nivel de electiva en `MateriasList.tsx` y el filtro de carrera en `ComisionesList.tsx` a `FilterChips`.
- Se actualizó el estándar en `docs/standards/frontend-componentes.md`.

### Pruebas manuales para el desarrollador

- `/home/materias`: elegir año y carrera; la URL y el listado cambian igual que antes; el chip
  presionado se ve en azul sin sombra.
- Con teclado: Tab llega a cada chip, Espacio lo presiona.

## 7. Riesgos

- Regenera las capturas de materias, igual que TASK-050 y TASK-052: hacerlas en serie.
- Si los specs de `MateriasList` buscan por clase del módulo, hay que pasarlos a consultas por rol.
