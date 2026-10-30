# TASK-043: Rediseño visual de materias, cursadas, comisiones y administración (PR4b de TASK-037)

Estado: Terminada (2026-10-25). Revisión manual y cambio en `ui/FormField` aprobados por Tiago. Depende de TASK-042 (contrato en
el front), TASK-038 (Dialog), TASK-047 (recarga del listado) y TASK-048 (formularios separados),
implementadas según Tiago el 2026-10-25. TASK-049 (`useIsAdmin`) se absorbe en esta tarea. TASK-035
se quitó como dependencia: no existe ningún archivo con ese número.
Fecha: 2026-10-25

## Objetivo

Llevar las pantallas que TASK-042 dejó funcionando con el estilo viejo al diseño del canvas
[Style Guide 2026-UTN-GRUPO-01](https://claude.ai/code/artifact/03813bcf-cf74-4f04-9a27-1d75610bcb6a),
página "Page 2". Solo cambia lo visual y la estructura de los componentes; los datos y los
contratos ya están.

## Contexto verificado (2026-10-25)

- Artboards de "Page 2" según TASK-037 §7:
  - Materias: listado con vista de admin; modal "Nueva materia" en escritorio y móvil.
  - Detalle de materia (rediseño).
  - Cursada: comisiones (rediseño).
  - Comisión: detalle (rediseño).
  - Administración en escritorio y móvil.
  - Los datos de los artboards son de ejemplo.
- `docs/tasks/pendient/TASK-038-front-primitiva-dialog.md`: primitiva Dialog (modal en escritorio,
  hoja inferior en móvil). Depende de TASK-035. Ninguna de las dos está implementada al 2026-10-25.
  - Actualización (relevamiento 2026-10-25): `front/src/components/ui/Dialog.tsx` ya existe sin
    commitear (props `open`, `onClose`, `title`, `description?`, `busy?`, `children`; `<dialog>`
    nativo con `showModal()`, Escape, `data-autofocus` y devolución del foco). Nadie la usa todavía.
    El archivo de TASK-038 está en `finished/` pero su encabezado sigue diciendo "Pendiente".
  - No existe ningún archivo de TASK-035 en `docs/tasks/`.
- TASK-034 dejó `MateriasList` con tokens de diseño. Los estándares de estilo están en
  `docs/standards/frontend-estilos.md` y `frontend-componentes.md`.
- `.agents/test.md`: las capturas visuales de Playwright se regeneran solo desde Linux.

## Relevamiento de artboards (paso 1, a confirmar por Tiago)

Leído del canvas el 2026-10-25. El shell (header + "Tu espacio") ya lo resuelven `AppShell` y
`SidebarNav`; no se toca. Los datos son de ejemplo.

| Artboard | Componente | Cambios concretos |
|---|---|---|
| `MateriasAdmin` (listado, vista admin) | `MateriasList` | Cabecera con botón "Nueva materia" (solo admin) junto al h1; abre el Dialog. Filtros en un panel: "Carrera" como grilla 3×2 de botones con inicial (`aria-pressed`), búsqueda, y "Año de la carrera" en chips con "Todos los años" y "Electivas" separado por borde. Resultados: una sección por año con h2 + insignia numérica + "N materias", filas clickeables de 56 px con chevron y etiquetas ("Común a las 5 carreras", "Solo Sistemas", "Nueva" tras el alta). Paginación Anterior / "Página 1 de 2" / Siguiente. Notice de éxito tras crear. |
| `ModalNuevaMateria` (escritorio) | `MateriaForm` dentro de `Dialog` | Título "Nueva materia", descripción "El nombre no puede repetirse.". Aviso `role="alert"` arriba para duplicado. Campos: nombre (hint "Hasta 150 caracteres."), fieldset de carreras con casillas e inicial, año (select), nivel de electiva solo si Electiva. Errores por campo con prefijo "Error:". Pie: Cancelar + enviar ("Guardando…" con `aria-busy`). |
| `ModalNuevaMateriaMobile` (390) | ídem | Hoja inferior con asa; botones apilados, acción principal ("Crear materia") primero. Lo resuelve el CSS del Dialog. |
| `MateriaDetalle` | `MateriaDetail` + `CursadasList` | Barra "Volver" + breadcrumb. h1 con insignias (año, cantidad de cursadas, "Activa" solo admin) y botón "Editar materia" (admin). Sección "Cursadas" con botón "Nueva cursada" (admin), agrupada por año, cada fila = cuatrimestre + detalle + letras de carrera + "Ver comisiones". Estado vacío con texto extra para admin. Sección "Historial de cambios" (solo admin) como línea de tiempo con actor, fecha, campo y Antes → Ahora, y "Ver cambios anteriores". Desaparecen las cards "Datos de la materia" y "Auditoría". |
| `CursadaDetalle` | `ComisionesList` | Volver + breadcrumb. Eyebrow con la materia, h1 período, insignias (comisiones, carreras, profesores). Sección "Comisiones" con botón "Nueva comisión" (admin), filtro por carrera en chips, filas con avatar de letra, nombre, carrera, profesores con cargo e "Inactiva". Estado vacío. Columna "Otros períodos" con el actual marcado. |
| `ComisionDetalle` | `ComisionDetail` | Volver + breadcrumb. Eyebrow "materia · período", h1 "Comisión S-31", insignias (carrera, "Activa" admin). Columna principal: "Profesores" (avatar con iniciales + cargo) con botón "Asignar profesor" (admin); "Experiencias de esta comisión" con "Próximamente" y estado vacío; aviso de edición/baja no disponible (admin). Columna lateral: "Datos de la comisión" como `<dl>` (solo admin) y "Otras comisiones" con la actual marcada. |
| `Artboard-sxpc` / `AdminMobile` | `AdminPanel` | h1 + descripción. "Oferta académica": 4 tarjetas Materias → Cursadas → Comisiones ← Profesores, cada una con Nueva + Ver todas y la dependencia ("Usa una materia existente"). "Cuentas y moderación": Usuarios registrados (+ Revisar reportes, fuera de alcance por D2). Móvil: tarjetas apiladas con flechas verticales y anclas "Oferta académica" / "Cuentas". |

Preguntas que bloquean el paso 2:

1. **Historial en el detalle**: el artboard lo muestra solo para admin y con nombre del actor. Hoy
   es visible para todos y muestra `actorId`. Eso es TASK-045 y TASK-046: ¿se esperan o el
   rediseño mantiene el comportamiento actual con el estilo nuevo?
   **Decidido (Tiago, 2026-10-25):** se mantiene el comportamiento actual (visible para todos,
   `actorId`) con el estilo de línea de tiempo del artboard. Visibilidad y nombre del actor quedan
   para TASK-045 y TASK-046.
2. **Botones de alta en detalle** ("Nueva cursada", "Nueva comisión", "Asignar profesor"): el
   artboard dice que la materia o cursada "ya va a venir elegida". ¿Navegan a las páginas de alta
   con el valor precargado por query, o se abren en Dialog? Ninguna de las dos cosas existe hoy.
   **Decidido (2026-10-25, Tiago delegó la elección):** navegan a las páginas de alta existentes con
   query (`/home/admin/cursadas/nueva?materiaId=…`, `/home/admin/comisiones/nueva?cursadaId=…`);
   `AltaCursada` y `AltaComision` leen el parámetro como valor inicial del select. No depende de
   TASK-048; pasar a Dialog queda para cuando exista. "Asignar profesor" lleva al formulario de
   asignación que ya está en `ComisionDetail` (ancla + foco), sin pantalla nueva.
3. **Botones sin destino**: "Ver todas" de Cursadas y Comisiones y "Nuevo/Ver todos" de Profesores
   en Administración no tienen pantalla de listado propia (salvo profesores). ¿Se omiten?
   **Decidido (Tiago, 2026-10-25):** se dejan todos los botones. El back no tiene listados globales
   de cursadas ni de comisiones (solo `materias/:id/cursadas` y `cursadas/:id/comisiones`), y crear
   uno queda fuera de alcance. Por eso "Ver todas" de Cursadas y de Comisiones lleva a
   `/home/materias`, que es la entrada de la jerarquía. Profesores usa `/home/admin/profesores/nuevo`
   y `/home/admin/profesores`.
4. **Asignación de profesores en `ComisionDetail`**: hoy el admin edita cargo y quita en línea; el
   artboard solo muestra la lista y un botón. ¿Se conserva la edición en línea?
   **Decidido (Tiago, 2026-10-25):** sí. Para admin cada fila conserva el select de cargo y el botón
   "Quitar", con el estilo de fila del artboard (avatar con iniciales, nombre, cargo).
5. **Dependencias**: TASK-047, TASK-048 y TASK-049 siguen pendientes y TASK-035 no existe. ¿Se
   implementan antes o se quitan como dependencias de esta tarea?
   **Decidido (Tiago, 2026-10-25):** 046 y 047 están hechas; 048 se implementa dentro de esta tarea
   (`front/src/hooks/useIsAdmin.ts` + `front/tests/use-is-admin.spec.tsx`, alcance de TASK-049 §2).

## Decisiones

- Tarea aparte de TASK-042 (decidido el 2026-10-25), para que el cambio de contrato y el visual se
  revisen por separado.
- El modal "Nueva materia" usa la primitiva Dialog de TASK-038. Hoy el alta es una página
  (`/home/admin/materias/nueva`): la página queda como respaldo hasta que el modal la reemplace en
  el listado.
- No se agregan dependencias ni componentes globales nuevos fuera de los que definan TASK-035 y TASK-038.

## Alcance

Se confirma en el paso 1. Archivos esperados:
- `front/src/components/academic/MateriasList.tsx` y `.module.css`, `MateriaDetail.tsx`,
  `CursadasList.tsx`, `ComisionesList.tsx`, `ComisionDetail.tsx` y sus estilos.
- `front/src/components/admin/MateriaForm.tsx` (dentro del Dialog), `AdminPanel.tsx`, `AltaCursada.tsx`, `AltaComision.tsx`.
- Tests de componentes afectados (agente `test`) y capturas visuales (regeneradas en Linux).

## Fuera de alcance

- Cambios de contrato, servicios o esquemas (TASK-042).
- La primitiva Dialog en sí (TASK-038) y los tokens (TASK-035).
- Back.
- Experiencias (D2: "Próximamente").

## Pasos

1. Relevamiento: el coordinador lee el canvas (herramienta Artifact, acción `read`) y anota en esta
   tarea una tabla artboard → componente → cambios concretos (jerarquía, tokens, estados vacíos,
   móvil). Tiago la confirma.
2. Test: specs de estructura y accesibilidad que fallan primero por pantalla (roles, encabezados,
   etiquetas de casillas, foco del Dialog).
3. Front: una pantalla por commit, en el orden listado → modal → detalle de materia → cursada →
   comisión → administración.
4. Verificación completa y chequeos de deriva.

## Criterio de "listo"

Automático (desde la raíz):

```powershell
npm run lint --workspace=front
npm run typecheck --workspace=front
npm run test --workspace=front
npm run build --workspace=front
```

- Chequeos `rg` de deriva de `.agents/front.md` sin hallazgos (tokens, botones sin clase,
  `<h1>` fuera de `PageHeader`).
- `npm run test:e2e --workspace=front` en local; las capturas se regeneran en Linux.

Manual (Tiago):
- Cada pantalla comparada contra su artboard en escritorio y en 375 px de ancho.
- El modal "Nueva materia" abre, atrapa el foco, cierra con Escape y en móvil se ve como hoja inferior.
- Que no se rompa: todos los flujos manuales de TASK-042.

## Skills para la implementación

- `ponytail`.
- `impeccable:impeccable` o `frontend-design:frontend-design` para la ejecución visual (opcional, a
  criterio del coordinador).
- Agentes `front` y `test`. Estándares `docs/standards/frontend-*.md`.

## Riesgos y preguntas abiertas

- El detalle por pantalla no está relevado todavía (paso 1). Sin esa tabla la tarea no cumple el
  gate y no se delega.
- Los subagentes pueden no tener acceso a la herramienta Artifact: el relevamiento lo hace la
  sesión principal y lo deja escrito acá.
- Depende de dos tareas de front sin implementar (TASK-035 y TASK-038).

## Al cerrar

- `front/OVERVIEW.md` si cambia la estructura de pantallas.
- `CHANGELOG.md`; mover a `finished/`.

## Resultado

Implementado el 2026-10-25. Tiago revisó las pantallas y aprobó el cambio en `ui/FormField`.

- Automático: lint, typecheck, `test` (273/273) y build en verde. Las capturas de Playwright no se
  regeneraron porque eso se hace en Linux.
- `useIsAdmin` (TASK-049) en `front/src/hooks/useIsAdmin.ts`. Las pantallas ya no comparan el rol a
  mano.
- Se toca un área sensible fuera de lo previsto: `ui/FormField.tsx` recibe `defaultValue` opcional
  (aplicado con ref) y `"use client"`. Lo necesita la precarga por query de las altas.
- Omitido:
  - "Otros períodos" en la cursada: hace falta una consulta nueva.
  - Contadores de la cabecera de materia y cursada: el dato vive dentro de `PaginatedListView`.
  - Etiqueta "Nueva" después del alta.
  - Anclas de Administración en móvil.
  - Estilo de error del formulario del modal: hint de 150 caracteres, prefijo "Error:" y alerta
    de duplicado.
  - Algunos textos quedaron como texto plano en lugar de pastilla porque los tests existentes
    fijan esa forma.
