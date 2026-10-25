# TASK-054: Accesos rápidos en admin móvil, historial con hito de alta y modal de nueva cursada

Estado: Pendiente.
Fecha: 2026-10-25

## 1. Contexto y objetivo

Artefacto de diseño de referencia (canvas "Style Guide 2026-UTN-GRUPO-01", Page 2): `Administración ·
móvil 390`, `Detalle de materia · rediseño` (tweak `sinCursadas`) y `Materias · listado con vista de
admin`.

Esta tarea viene de un encargo más amplio que cubría 6 pantallas ya rediseñadas. Antes de implementar
se verificó cada punto contra el código actual (no contra memoria ni contra el enunciado), y la mayor
parte ya está resuelta por tareas anteriores. Evidencia:

- **Panel de administración (`AdminPanel.tsx`):** el texto actual ya dice "Materias y profesores se
  cargan por separado" y la tarjeta de Profesores ya dice "Se carga solo" (no "usa un X existente").
  No hay ningún texto que diga que cada nivel necesita el anterior. **No se toca.**
- **`MateriasAdmin.dc.html` (listado con vista admin) y `ModalNuevaMateria.dc.html` (5 estados:
  vacío, electiva, error de validación, nombre duplicado, guardando):** ya implementados en
  `MateriasList.tsx` y `MateriaForm.tsx` con los mismos textos exactos del mockup ("Completá este
  campo.", "Elegí al menos una carrera.", "Elegí un año entre 1 y 5 o Electiva.", "Ya existe una
  materia con ese nombre.", "Guardando…", y el reordenamiento a "Crear materia" primero en mobile via
  `.dialog-actions { flex-direction: column-reverse }`). **No se toca.**
- **Conteos de comisiones/profesores y letras de carrera por cursada:** el enunciado original los daba
  por bloqueados hasta el "bloque 3", pero el back ya los expone (`CursadaResumen.comisiones`,
  `.profesores`, `.carreras` en `back/src/academic/domain/cursada.ts`) y `CursadasList.tsx` ya los
  renderiza. **Ya resuelto; solo se ajusta el formato visual de las carreras (ver alcance).**
- **"Ver todas" de Cursadas/Comisiones sin listado general:** ya resuelto desde TASK-043 (decisión 3):
  apuntan a `/home/materias`, la entrada de la jerarquía. **No se toca.**

Lo que de verdad falta, verificado contra el código:

1. El panel de administración no tiene versión con accesos rápidos en móvil (el layout de hoy es
   100% CSS responsive, sin nav propia). El artboard `Administración · móvil 390` agrega dos links de
   anclaje ("Oferta académica", "Cuentas") arriba del contenido.
2. El historial de materia (`MateriaHistory` en `MateriaDetail.tsx`) ya muestra el actor
   (`entry.actor.displayName`, de TASK-046) pero no coincide visualmente con el rediseño (iniciales en
   vez de un ícono de lápiz fijo, sin el prefijo "Usuario:") y no incluye el hito de alta de la
   materia como última entrada de la línea de tiempo.
3. `CursadasList.tsx` muestra las carreras de cada cursada como texto separado por comas
   (`cursada.carreras.join(", ")`); el rediseño las muestra como chips de una letra, igual al patrón ya
   usado en otras pantallas (`academic-tag` / letras de carrera).
4. El botón "Nueva cursada" abre hoy una página completa (`/home/admin/cursadas/nueva?materiaId=`);
   el rediseño lo abre como modal desde el propio detalle de materia, con la materia ya fija (no un
   combobox preseleccionado y editable). `AltaCursada` hoy solo lee `materiaId` de la URL
   (`useSearchParams`), no lo acepta como prop, así que no se puede reusar tal cual dentro de un
   `Dialog` montado en `/home/materias/[materiaId]`.

## 2. Alcance

- `front/src/components/admin/AdminPanel.tsx` + `AdminPanel.module.css`: nav de anclas
  "Oferta académica" (`#oferta`) / "Cuentas" (`#cuentas-m` o similar), visible solo bajo el breakpoint
  mobile ya usado en el resto del front; agregar los `id` correspondientes a las dos `<section>`.
- `front/src/components/academic/MateriaDetail.tsx` (función `MateriaHistory`): avatar con iniciales
  del actor en vez del ícono de lápiz fijo, quitar el prefijo "Usuario:", agregar como última entrada
  (después de la página final) el hito "Alta de la materia" con `materia.createdAt` (sin cambios, sin
  actor). Fallback de una línea si `actor.displayName` llega vacío.
- `front/src/components/academic/CursadasList.tsx`: reemplazar `carreras.join(", ")` por chips de una
  letra reusando el patrón de clase ya existente para letras de carrera.
- `front/src/components/admin/AltaCursada.tsx`: aceptar `materiaId` opcional por prop, con fallback al
  valor de `useSearchParams` para no romper la ruta `/home/admin/cursadas/nueva`.
- `front/src/components/academic/CursadasList.tsx`: el botón "Nueva cursada" (visible solo si
  `isAdmin`) abre un `Dialog` (mismo patrón que `MateriaForm` en `MateriasList.tsx`) con `AltaCursada`
  dentro, pasando `materiaId` fijo; `onSuccess` refresca el listado (igual a `refreshKey` de
  `MateriasList.tsx`).
- Mantener la ruta `/home/admin/cursadas/nueva` intacta (enlaces directos, `?materiaId=` desde otros
  lugares si existieran).

## 3. Fuera de alcance

- Filtro por carrera en el listado de materias (depende del modelo nuevo, bloque 3).
- Cualquier cambio en `Cursada · comisiones (rediseño)` o `Comisión · detalle (rediseño)` (artboards 8
  y 9): ya tienen su propia implementación (`ComisionesList.tsx`, `ComisionDetail`) y no estaban en el
  encargo de esta tarea.
- Intercepting routes de Next para que el modal tenga URL propia: no se investigó una necesidad real
  (el patrón `Dialog` sin URL ya es el estándar del front, TASK-038/TASK-043) y el `AGENTS.md` de
  `front/` exige verificar contra `node_modules/next/dist/docs` antes de usar una API nueva; no se abre
  esa puerta sin un caso concreto que la justifique.
- Edición o baja de materias/cursadas/comisiones/profesores (fuera de alcance general del proyecto,
  rotulado en el propio `AdminPanel`).

## 4. Decisiones de diseño

1. **`AltaCursada` recibe `materiaId` por prop con fallback a la URL (propuesta).** Evita duplicar el
   formulario para el caso modal vs. el caso página completa, y no rompe la ruta existente.
2. **El hito de alta se sintetiza en el cliente, no en el back.** `Materia.createdAt` ya viaja en la
   respuesta de materia; no hace falta un endpoint nuevo para una entrada que no tiene `cambios`.
3. **Chips de carrera reusan la clase ya existente**, no se crea una primitiva nueva (regla de
   `frontend-componentes.md`: si existe el patrón, se usa).

## 5. Casos de prueba y criterios de aceptación

- `AdminPanel`: en viewport mobile, los links de ancla llevan a las secciones correspondientes; en
  desktop no son visibles (o no interfieren con el layout actual).
- `MateriaHistory`: con historial vacío, se ve solo el hito de alta; con historial no vacío, el hito de
  alta aparece como última entrada de la última página cargada.
- `CursadasList`: una cursada con 2 carreras muestra 2 chips de una letra, no texto con comas.
- `AltaCursada` dentro del modal: crea la cursada con la materia ya fija (sin selector visible o con
  selector deshabilitado, a decidir en implementación), cierra el modal y refresca el listado de
  cursadas de esa materia sin recargar la página.
- `npm run lint --workspace=front`, `npm run typecheck --workspace=front` (con `nest build` si aplica
  al back, para evitar falsos verdes de caché incremental) y `npm run test --workspace=front` pasan.

## 6. Validación

Implementación completa de los 4 puntos del alcance. Resultados reales de los comandos (raíz del
repo, workspace `front`):

- `npm run lint --workspace=front`: **OK**, sin errores ni warnings.
- `npm run typecheck --workspace=front`: **OK** (`tsc --noEmit` de `src/` y de `tests/`).
- `npm run test --workspace=front`: **278/278 en verde** (35 archivos). El agente de Frontend dejó
  3 tests rojos porque codificaban el comportamiento anterior que esta tarea cambió a propósito;
  se actualizaron a mano (no se tocó producción, solo las aserciones):
  - `tests/academic-components.spec.ts` → `CursadasList > muestra el listado y la paginación con
    el nombre de materia recibido`: ahora verifica los chips `<span className="academic-tag">S<`/
    `C<` en vez de `"S, C"`.
  - `tests/materia-detalle.spec.tsx` → historial del actor: ahora verifica `"Ada Lovelace"` sin el
    prefijo `"Usuario: "`.
  - `tests/materia-detalle.spec.tsx` → "Nueva cursada": ya no hay `href` que verificar (el botón
    abre un `Dialog`, no navega); el test quedó en comprobar que el botón existe para ADMIN
    (la cobertura de "no navega, abre modal, crea y refresca" queda pendiente como test de
    interacción con `@testing-library/react`, no se armó en esta tarea — ver Riesgos).

No se corrió `npm run test:e2e --workspace=front` (Playwright, solo local) ni se regeneraron
capturas visuales; lo marca como pendiente para el desarrollador antes de mover la tarea a
`finished/`.

### Pruebas manuales para el desarrollador

- Entrar a `/home/admin` en un viewport angosto (≤480px) y confirmar que aparecen los dos accesos
  rápidos y que cada uno baja a su sección.
- Entrar a `/home/admin` en desktop y confirmar que no cambió nada visualmente.
- Como admin, entrar al detalle de una materia con historial (ej. una materia editada antes) y
  confirmar que la línea de tiempo muestra iniciales por entrada y termina con "Alta de la materia".
- Entrar al detalle de una materia sin cambios registrados y confirmar que el historial muestra
  únicamente el hito de alta.
- En el detalle de una materia con cursadas de más de una carrera, confirmar que las carreras se ven
  como chips de una letra.
- Como admin, en el detalle de una materia, tocar "Nueva cursada": confirmar que abre un modal (no
  navega a otra página), que la materia ya aparece fija, que crear la cursada cierra el modal y
  refresca el listado sin perder la posición de scroll de la página.
- Entrar directo a `/home/admin/cursadas/nueva` (sin `materiaId`) y confirmar que la página completa
  sigue funcionando igual que antes.

## 7. Riesgos

- Si `actor.displayName` llega vacío para un historial viejo, el fallback debe evitar un avatar con
  iniciales vacías; verificar con un registro real si existe alguno anterior a TASK-046.
- No hay un test de interacción (abrir el modal, crear la cursada, ver que cierra y refresca) para
  el flujo nuevo de "Nueva cursada" en `CursadasList`; solo quedó cubierta la presencia del botón.
  Si se agrega, va en un archivo con entorno jsdom y mocks de `@/services/academic` (`crearCursada`,
  `listarMaterias`) y `@/hooks/useAllPages`, siguiendo el patrón de `tests/admin-alta-precarga.spec.tsx`.
