# TASK-048: Separar MateriaForm y AltaForm de su página (callback onSuccess)

Estado: Terminado. Decisiones 1 a 4 aprobadas e implementadas el 2026-10-25.
Sin dependencias de back. Puede hacerse en paralelo con TASK-038.
Fecha: 2026-10-25

## 1. Contexto y objetivo

El rediseño usa el mismo formulario en página y en modal (`ModalNuevaMateria.dc.html`,
`ModalNuevaMateriaMobile.dc.html`; en `MateriaDetalle.dc.html` y `CursadaDetalle.dc.html` aparecen
"Nueva cursada" y "Nueva comisión" como botones dentro del detalle). Hoy los formularios incluyen su
envoltorio de página:

- `front/src/components/admin/MateriaForm.tsx` (`{ materia?, detailHref? }`): renderiza
  `section` + `PageHeader` (h1, breadcrumb) + `Card panel` + formulario + "Volver" en edición, y al
  terminar hace `router.push(target + "?successMessage=…")` (líneas 48-50). La usan `AltaMateria.tsx`
  y `EditarMateria.tsx`.
- `front/src/components/admin/AltaForm.tsx` (`{ breadcrumb, heading, description, fields,
  submitLabel, blocked?, filter?, onSubmit }`): renderiza su encabezado con breadcrumb y h1; al
  terminar no navega, hace `form.reset()` y muestra un `Notice` de éxito en el lugar. La usan
  `AltaProfesor`, `AltaCursada` y `AltaComision`.
- Los destinos leen el mensaje de la URL (`MateriasList.tsx:25`, `MateriaDetail.tsx:32`).

Objetivo: separar el cuerpo del formulario del envoltorio de página y agregar `onSuccess`, de forma
que las pantallas actuales se vean y se comporten igual y que el rediseño pueda montar el cuerpo
dentro de un `Dialog` (TASK-038).

> `AltaForm` es un componente reutilizado por tres pantallas de administración. Esta tarea es la
> autorización explícita para modificarlo, dentro del alcance de la sección 2. Justificación: sin
> esta separación el modal tendría que duplicar validación, envío y manejo de errores.

## 2. Alcance

| Archivo | Cambio |
|---|---|
| `components/admin/MateriaForm.tsx` | Queda solo el cuerpo: campos, validación, `useFormSubmission`, `Notice` de error, botones. Props: `{ materia?, onSuccess(result), onCancel? }`. Sin `PageHeader`, sin `router`. |
| `components/admin/MateriaFormPage.tsx` (nuevo) | Envoltorio actual: `section`, `PageHeader`, `Card panel`, "Volver" en edición y el `router.push` con `successMessage` dentro de su `onSuccess`. |
| `AltaMateria.tsx`, `EditarMateria.tsx` | Usan `MateriaFormPage`. |
| `components/admin/AltaForm.tsx` | Mismo corte: `AltaFormFields` (cuerpo, con `onSuccess?(message)`) y `AltaForm` (envoltorio con encabezado; si no recibe `onSuccess` mantiene reset + `Notice` en el lugar). |
| `AltaProfesor`, `AltaCursada`, `AltaComision` | Sin cambios de comportamiento; solo ajustes de import si hace falta. |

- El cuerpo en modo modal no renderiza h1 ni breadcrumb; el título lo da el `Dialog`.
- El botón "Cancelar" se muestra solo si llega `onCancel`.
- Los textos de éxito (`Materia creada: …`) siguen en un solo lugar, el que hoy los arma.

Tests:

- Caracterizar primero (`frontend-tests.md`, "caracterizar antes de refactorizar"): specs de
  comportamiento actual de `MateriaForm` y `AltaForm` antes de cortar, y que sigan en verde después.

## 3. Fuera de alcance

- Montar los formularios en un modal (rediseño del listado).
- Cambiar el mecanismo `?successMessage=` de las páginas, o limpiar el parámetro de la URL.
- Estados visuales nuevos del artboard (tiles de carreras con checkbox, bloque de electiva en caja):
  son del rediseño del formulario de materia.
- El aviso "Ya existe una materia con ese nombre" como texto específico: hoy llega del back por el
  catálogo de errores; si hace falta un texto distinto se decide en el rediseño.

## 4. Decisiones de diseño

1. **Componente de cuerpo + componente de página (propuesta).** Composición en vez de un flag
   `variant="modal"` que ramifique el render; cada pieza tiene una sola responsabilidad.
2. **`onSuccess` recibe el resultado (propuesta).** `MateriaForm` pasa la materia creada o editada;
   `AltaFormFields` pasa el mensaje que hoy devuelve `onSubmit`. La página decide navegar; el modal
   decide cerrar e incrementar `refreshKey` (TASK-047).
3. **Mismo nombre para el cuerpo `MateriaForm` (propuesta).** Los consumidores actuales pasan a
   `MateriaFormPage`; el nombre corto queda para el uso más reutilizable.
4. **Sin cambios visibles (propuesta).** Es un refactor: las capturas existentes no se regeneran.

## 5. Casos de prueba y criterios de aceptación

Vitest + Testing Library (jsdom, servicios y `next/navigation` mockeados):

- `admin-materia-form.spec.tsx`: al guardar con éxito llama a `onSuccess` con la materia y no
  navega; con error del servidor muestra `Notice` de error con foco y no llama a `onSuccess`;
  "Cancelar" aparece solo con `onCancel` y lo llama; el cuerpo no renderiza `h1`.
- `admin-materia-form-page.spec.tsx`: crear navega a `/home/materias?successMessage=Materia%20creada…`;
  editar navega a `detailHref` con `&` o `?` según corresponda (caso con query existente).
- `admin-alta-form.spec.tsx`: sin `onSuccess` resetea y muestra el aviso de éxito; con `onSuccess`
  lo llama con el mensaje.

Criterios:

- `MateriaForm.tsx` y `AltaFormFields` no importan `next/navigation` ni `PageHeader`.
- `npm run lint --workspace=front`, `npm run typecheck --workspace=front` y
  `npm run test --workspace=front` pasan.
- `npm run test:e2e --workspace=front -- tests/visual.browser.spec.mjs` (Linux) sin diferencias en
  `alta-materia-*` ni en las demás capturas; en otros sistemas, `--ignore-snapshots` en verde y axe
  sin violaciones nuevas.

## 6. Validación

Ejecutada el 2026-10-25 con resultado exitoso:

- `npm run lint --workspace=front`: 0 errores, 0 advertencias.
- `npm run typecheck --workspace=front`: limpio en `src/` y `tests/`.
- `npm run test --workspace=front`: 27 archivos pasados, 252 tests pasados (incluidos `admin-materia-form.spec.tsx`, `admin-materia-form-page.spec.tsx` y `admin-alta-form.spec.tsx`).
- `npm run build --workspace=front`: build de producción de Next.js exitoso (23 rutas generadas).
- `MateriaForm.tsx` y `AltaFormFields` libres de imports de `next/navigation` y `PageHeader`.

### Pruebas manuales para el desarrollador

- Crear una materia desde `/home/admin/materias/nueva`: vuelve al listado con el aviso verde.
- Editar una materia desde su detalle: vuelve al detalle con "Materia actualizada correctamente.".
- Crear profesor, cursada y comisión desde Administración: el formulario se limpia y muestra el aviso.
- Un error del servidor (nombre repetido) muestra el aviso rojo con foco.

## 7. Riesgos

- Es el cambio con más superficie del bloque: cinco pantallas de administración. Mitigación:
  caracterización previa y capturas sin regenerar.
- `MateriaForm` toca la misma zona que el rediseño del formulario de materia; si ese rediseño
  arranca antes, se hace sobre el cuerpo ya separado.

## Resultado

Implementado. `MateriaForm` y `AltaFormFields` operan como cuerpos puros de formulario con callback `onSuccess` y `onCancel` opcional, desacoplados del layout de página (`PageHeader`, `section`, `router.push`). `MateriaFormPage` y `AltaForm` conservan el envoltorio y navegación para las páginas existentes.
