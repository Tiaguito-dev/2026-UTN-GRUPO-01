# TASK-038: Primitiva Dialog (modal en escritorio, hoja inferior en móvil)

Estado: Pendiente. Decisiones 1 a 6 propuestas, a aprobar antes de pasar a `in-progress/`.
Depende de TASK-035 (normalización de tokens). Sin dependencias de back.
Fecha: 2026-10-25

## 1. Contexto y objetivo

El rediseño "Alta en modal desde el listado" (canvas *Style Guide 2026-UTN-GRUPO-01*, Page 2) crea
materias desde un modal sobre el listado. Hoy no existe ningún modal, overlay ni backdrop en
`front/src` (búsqueda sin resultados) y `components/ui/` no tiene una primitiva equivalente.

Artboards de referencia:

- `ModalNuevaMateria.dc.html` (escritorio 1280): modal centrado de 512px, borde `--border`, radio 24px,
  sombra `0 14px 35px` al 12 %, fondo oscurecido `rgb(23 35 61 / 45%)`, título `h2` + descripción
  enlazados con `aria-labelledby`/`aria-describedby`, botón "Cerrar" de 44px con `aria-label`,
  pie con Cancelar + acción principal separado por un borde superior. Estados del selector: vacío,
  electiva, error de validación, nombre duplicado (aviso `role="alert"` arriba del formulario) y
  guardando (`aria-busy`, botón "Guardando…").
- `ModalNuevaMateriaMobile.dc.html` (móvil 390): hoja anclada abajo, radio 24px solo arriba, asa
  decorativa de 40×4px, sombra hacia arriba, botones apilados con la acción principal primero.

Objetivo: una primitiva genérica `Dialog` en `components/ui/` sobre el `<dialog>` nativo con
`showModal()`, que resuelva foco, Escape, fondo inerte y devolución del foco sin dependencias nuevas.
El contenido (formulario, estados) lo aporta quien la usa.

> Esta tarea crea un componente reutilizable global y agrega tokens a `styles/tokens.css`, que
> `AGENTS.md` lista como área sensible. Esta tarea es la autorización explícita para hacerlo, dentro
> del alcance de la sección 2. Justificación: la primitiva la van a consumir al menos el alta de
> materias y las altas de cursada y comisión del rediseño; hacerla dentro de cada pantalla duplicaría
> la gestión de foco, que es la parte frágil.

## 2. Alcance

### 2.1 Componente

`front/src/components/ui/Dialog.tsx`:

| Prop | Tipo | Uso |
|---|---|---|
| `open` | `boolean` | Controlado por el padre. `true` llama a `showModal()`, `false` a `close()`. |
| `onClose` | `() => void` | Se llama al cerrar por Escape, por el botón "Cerrar" o por `close()`. |
| `title` | `string` | Se renderiza como `h2`; su `id` (de `useId`) va a `aria-labelledby`. |
| `description?` | `ReactNode` | `p` enlazado con `aria-describedby`. |
| `busy?` | `boolean` | Mientras es `true`, Escape y "Cerrar" no cierran (decisión 4). |
| `children` | `ReactNode` | Cuerpo (formulario, avisos). |

- El botón "Cerrar" usa el ícono X como SVG `aria-hidden` y `aria-label="Cerrar"`; área táctil de 44px.
- El foco inicial va al primer control enfocable del cuerpo (comportamiento nativo de `showModal()`);
  si el cuerpo pide otro, usa `autoFocus`.
- Al cerrar, el foco vuelve al elemento que tenía el foco antes de abrir: se guarda
  `document.activeElement` al abrir y se restaura en `close` (respaldo explícito del comportamiento
  nativo, que no todos los navegadores aplican igual).

### 2.2 Estilos y tokens

- `front/src/styles/components/dialog.css` (capa `components`) + `@import` en `app/globals.css`.
- Escritorio: centrado, `width: min(32rem, 100% - var(--space-8))`, `max-height` con scroll interno,
  `--radius-xl`, `--shadow-popover`, padding `--space-8`.
- Móvil (`max-width: 600px`, breakpoint existente): anclado abajo, ancho completo, radio solo
  superior, asa decorativa (pseudo-elemento), sombra hacia arriba.
- `::backdrop` con el token de fondo oscurecido.
- `body:has(dialog[open])` bloquea el scroll del fondo.

Tokens nuevos en `styles/tokens.css` (no hay equivalentes hoy):

| Token | Valor | Por qué |
|---|---|---|
| `--z-modal` | `40` | El `<dialog>` modal va al *top layer* y no necesita z-index, pero el token deja explícita la escala (`--z-header: 30`) para cualquier capa propia del modal y evita literales. |
| `--backdrop` | `rgb(var(--shadow-rgb) / 45%)` | Color del fondo oscurecido del artboard; no existe ningún token de overlay. |
| `--shadow-sheet` | `0 -14px 35px rgb(var(--shadow-rgb) / 12%)` | La hoja móvil proyecta la sombra hacia arriba; `--shadow-popover` la proyecta hacia abajo. |

### 2.3 Tests y documentación

- `front/tests/ui-dialog.spec.tsx` (jsdom). jsdom no implementa `showModal()`/`close()`: el spec
  agrega un stub mínimo en `beforeAll` (marca `open` y dispara `close`/`cancel`), sin dependencias.
- `docs/standards/frontend-componentes.md`: agregar `Dialog` al inventario de primitivas con su regla
  de uso (un solo `h2` de título, acción principal al final en escritorio y primero en móvil).
- `docs/standards/frontend-pantallas.md`: agregar la fila "Alta en modal" (cuándo usar modal y cuándo
  página: el modal solo para formularios cortos que vuelven al mismo listado).

## 3. Fuera de alcance

- Consumir el Dialog en `MateriasList` o en cualquier pantalla (va en la tarea del rediseño del listado).
- Los estados del formulario (vacío, electiva, error, duplicado, guardando): son del formulario
  (TASK-048), no de la primitiva.
- Diálogos de confirmación o alertas (`role="alertdialog"`): no los pide ningún artboard.
- Animaciones de entrada y salida.

## 4. Decisiones de diseño

1. **`<dialog>` nativo con `showModal()` (propuesta).** Da *top layer*, fondo inerte, foco atrapado y
   evento `cancel` con Escape sin código propio ni dependencias. Alternativa descartada: `div` con
   `role="dialog"` + trampa de foco manual; más código y más superficie de error.
2. **Componente controlado por `open` (propuesta).** El padre decide cuándo abrir y cuándo cerrar
   (por ejemplo, cerrar en `onSuccess` del formulario). Encaja con el callback de TASK-048.
3. **Clic en el fondo no cierra (propuesta).** El artboard no lo define y un clic accidental perdería
   un formulario a medio completar. Cierran Escape, "Cerrar" y "Cancelar".
4. **`busy` bloquea el cierre (propuesta).** Mientras se guarda, cerrar dejaría una petición en vuelo
   sin destino visible. Se cancela el evento `cancel` (Escape) y se deshabilita "Cerrar".
5. **Hoja inferior por CSS, no por otro componente (propuesta).** Es la misma primitiva con otra
   presentación bajo 600px; un solo componente, una sola gestión de foco.
6. **El pie de acciones lo arma quien usa el Dialog (propuesta).** El formulario ya tiene sus botones;
   la primitiva solo da la clase `dialog-actions` para el orden y el borde superior.

## 5. Criterios de aceptación

- `components/ui/Dialog.tsx` no importa servicios, tipos de dominio ni roles.
- `dialog.css` usa solo tokens de `tokens.css` (los literales permitidos son tamaños de caja y el
  breakpoint de 600px).
- Casos de `ui-dialog.spec.tsx` en verde:
  - con `open` el diálogo queda abierto, tiene nombre accesible igual a `title` y descripción;
  - Escape llama a `onClose`;
  - con `busy` Escape no llama a `onClose` y "Cerrar" está deshabilitado;
  - "Cerrar" llama a `onClose`;
  - al pasar `open` a `false` el foco vuelve al botón que lo abrió;
  - el foco inicial cae dentro del diálogo.
- `npm run lint --workspace=front`, `npm run typecheck --workspace=front` y
  `npm run test --workspace=front` pasan.
- `npm run test:e2e --workspace=front -- tests/visual.browser.spec.mjs --ignore-snapshots` sigue en
  verde (la tarea no cambia ninguna pantalla existente).

## 6. Validación

Pendiente de ejecución.

### Pruebas manuales para el desarrollador

Sin consumidor todavía, la verificación visual y con axe del modal se hace en la tarea del rediseño
del listado de materias, que agrega `alta-materia-modal` a `SCREENS` (390 y 1280) y su captura de
referencia (regenerada solo en Linux). En esta tarea, revisar el spec y probar en un navegador con un
consumidor temporal no commiteado: Tab no sale del modal, Escape cierra, el foco vuelve al botón.

## 7. Riesgos

- jsdom sin `showModal()`: el stub del spec puede divergir del navegador real; la prueba real de foco
  queda en Playwright con el primer consumidor.
- Chrome ignora un segundo `preventDefault` de `cancel` si el usuario aprieta Escape repetido sin
  interactuar; con `busy` el diálogo podría cerrarse. Mitigación: `onClose` ignora el cierre si
  `busy` y vuelve a llamar a `showModal()`.
- `::backdrop` hereda custom properties solo desde Chrome 122 / Firefox 120 / Safari 17.4; en
  navegadores más viejos el fondo queda sin oscurecer (degradación aceptable).
