# Frontend: Estilos

Estándar para todo CSS nuevo o modificado de `front/`. Sale de
[TASK-027](../tasks/finished/TASK-027-front-tokens-de-diseno.md) (tokens) y
[TASK-028](../tasks/finished/TASK-028-front-cascada-css-controlada.md) (capas).

## Regla 1: toda regla vive en una capa

`front/src/app/globals.css` solo declara el orden de capas y los `@import`; no tiene reglas:

```css
@layer reset, tokens, base, layout, components, utilities;
@import "../styles/reset.css";
/* … un @import por archivo de src/styles/ */
```

Cada archivo de `front/src/styles/` envuelve todas sus reglas en su `@layer`. **Por qué:** una
regla sin capa le gana a todas las que tienen capa, sin importar la especificidad. Con capas, una
regla de `components` le gana a una de `base` sin overrides ni selectores más largos.

## Regla 2: un archivo por área

| Archivo | Capa | Qué va |
|---|---|---|
| `styles/reset.css` | `reset` | Reset del navegador. |
| `styles/tokens.css` | `tokens` | El `:root` con todos los tokens (tabla abajo). |
| `styles/base.css` | `base` | Selectores de elemento (regla 3). |
| `styles/layout.css` | `layout` | Header, sidebar, contenido y `.page`. |
| `styles/components/<área>.css` | `components` | Un archivo por área: `button`, `notice`, `form`, `breadcrumb`, `pagination`, `card`, `badge`, `account-menu`, `landing`, `academic`. |

Un área nueva es un archivo nuevo en `styles/components/` más su `@import` en `globals.css`. Los
estilos de una primitiva de `components/ui/` van en el archivo de su nombre (`.card` en
`card.css`). **Por qué:** quien busca el estilo de algo lo encuentra por el nombre del archivo, y
un `@import` fuera de orden se detecta al leer `globals.css`.

## Regla 3: los selectores de elemento solo llevan tipografía y reset

En `base.css`, un selector de elemento (`button`, `nav`, `h1`, `dl`…) no define `background`,
`border`, `padding`, `width`, `display` ni `text-align`. El aspecto de componente va en una clase:
un `<button>` sin clase no se ve como botón; usa `.button`, `.button button-secondary` o
`.button submit`. Las únicas excepciones son `input, select`, `label` y `hr`, listadas en la
sección 6 de TASK-028 y en el comentario de cabecera de `base.css`.

**Por qué:** un estilo en un selector de elemento lo hereda cada elemento nuevo de ese tipo, y
cada componente que no lo quiere tiene que deshacerlo. Ese era el origen de los overrides que
borró TASK-028.

`button:disabled` muestra el cursor "no permitido". El reloj de espera es solo para el envío en
curso, que se marca con `aria-busy` en el formulario o en el botón.

## Regla 4: si hay token, se usa el token

Un valor que coincide con un token se escribe como `var(--…)`, nunca como literal. Un valor
nuevo se elige de la escala; si ninguno sirve, la tarea que lo necesita agrega el token y explica
por qué.

| Grupo | Tokens |
|---|---|
| Espacio | `--space-N` vale `N × .25rem`: `--space-1` .25rem, `-2` .5rem, `-3` .75rem, `-4` 1rem, `-5` 1.25rem, `-6` 1.5rem, `-8` 2rem, `-10` 2.5rem, `-12` 3rem, `-16` 4rem |
| Radio | `--radius-sm` .5rem, `--radius-md` .75rem, `--radius-lg` 1rem, `--radius-xl` 1.5rem, `--radius-pill` 2rem, `--radius-round` 50% |
| Texto | `--text-xs` .75rem (mínimo, ver [frontend-pantallas.md](./frontend-pantallas.md#accesibilidad)), `--text-sm` .8rem, `--text-md` .9rem, `--text-base` 1rem, `--text-xl` 1.5rem, `--text-2xl` 2rem |
| Peso | `--weight-medium` 600, `--weight-semibold` 650, `--weight-bold` 700, `--weight-heavy` 750 |
| Sombra | `--shadow-popover`, `--shadow-card`, `--shadow-floating`; todas sobre `--shadow-rgb` (el tono de `--text`) |
| Layout | `--header-h` 5.5rem, `--sidebar-w` 15rem, `--content-max` 72rem |
| Capas (`z-index`) | `--z-skip-link` 10, `--z-popover` 20, `--z-header` 30 |
| Color | `--primary`, `--primary-hover`, `--accent`, `--link`, `--surface`, `--background`, `--text`, `--muted`, `--border`, `--input-border`, `--soft-blue`, y `--error`, `--success`, `--warning` con su `-background` |

Excepciones, todas de TASK-027 (decisión 5):

- Literales dentro de `calc()`, `clamp()`, `min()` y `max()`. Los tokens de layout sí se usan
  ahí, porque su objetivo es acoplar las reglas que tienen que coincidir.
- Medidas de caja (`width`, `height`, `min-height`, `max-width`, `flex-basis`): no tienen escala.
- Breakpoints: las media queries no aceptan variables. Se usan `800px` (shell) y `600px` (landing
  y auth), como documenta el comentario de `tokens.css`.
- Los valores fuera de escala que ya existen, listados en la sección 6 de TASK-027. No se copian
  a código nuevo: esperan su tarea de normalización.

**Por qué:** cada pantalla que elige un valor "parecido" agranda la deriva (llegaron a convivir
`.7rem`, `.75rem` y `.8rem` como radio de controles). Con el token, cambiar un valor cambia todas
las pantallas a la vez, y dos reglas que deben coincidir, como header y sidebar, no se desfasan.

## CSS Modules

Hay uno solo, `components/academic/MateriasList.module.css`. Un CSS Module no lleva capa, así que
le gana a todas. Un componente nuevo usa una clase en `styles/components/`, no un módulo: adoptar
CSS Modules es una decisión abierta (TASK-028, decisión 1) que necesita su propia tarea. Si se
toca un módulo existente, también usa tokens.

## Referencia

`front/src/app/globals.css`, `front/src/styles/tokens.css`, `front/src/styles/base.css`.
