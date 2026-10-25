# TASK-024: Escalas de tokens de diseño en el frontend, sin cambio visual

Estado: Finalizada el 2026-10-21. Decisiones 1 a 4 confirmadas por el desarrollador el 2026-10-21. Depende de TASK-023.
Fecha: 2026-10-21

## 1. Contexto y objetivo

`front/src/app/globals.css` define 17 variables en `:root` (líneas 1-7), todas de color. Todo lo
demás está escrito a mano. Inventario del 2026-10-21 sobre `desarrollo` (`253c650`):

| Propiedad | Valores distintos | Detalle |
|---|---|---|
| Espaciado (`margin`, `padding`, `gap`, offsets) | 32 | `1rem` ×27, `1.5rem` ×21, `.75rem` ×16, `2rem` ×12, `.5rem` ×10, y 27 valores con 1 a 5 usos |
| `border-radius` | 10 | 50%, 2rem, 1.5rem, 1.1rem, 1rem, .8rem, .75rem, .7rem, .55rem, .5rem |
| `font-size` | 19 | `.9rem` ×11, `.8rem` ×10, más 17 valores y 6 `clamp()` distintos |
| `font-weight` | 4 | 600, 650, 700, 750 |
| Sombras | 3 | literales `rgb(23 35 61 / …)` en las líneas 24, 82, 99 y 146: repiten el valor de `--text` |
| Medidas del layout | 2 | header `5.5rem` (líneas 29 y 32) y sidebar `15rem` (líneas 32 y 41), cada una escrita dos veces |
| `z-index` | 5 | 1, 3, 10, 20, 30 |

Consecuencia: cada pantalla nueva elige un valor "parecido" y la deriva crece (ya conviven
`.7rem`, `.75rem` y `.8rem` como radio de controles). Además, para cambiar la altura del header hay
que tocar dos reglas a la vez, y si se toca solo una el sidebar queda tapado.

Objetivo: agregar escalas de tokens y reemplazar los literales que coinciden exactamente con
algún valor de la escala, **sin que cambie ningún píxel**. Los valores que no coinciden con la
escala se dejan como están y se listan para normalizarlos en una tarea posterior. Normalizar sí
cambia el aspecto, así que necesita su propia revisión visual.

Es la Etapa 1 del plan de refactorización del frontend. La Etapa 0 es TASK-023, que agrega lint,
CI y la línea base de capturas con la que se verifica esta tarea.

## 2. Alcance

Un solo archivo de producto: `front/src/app/globals.css`.

1. **Agregar al bloque `:root`** las escalas de la sección 4 (decisión 2), agrupadas y con un
   comentario por grupo.
2. **Reemplazar cada literal que coincida exactamente** con un valor de escala por su
   `var(--…)`. Una coincidencia aproximada no alcanza: si el valor no es idéntico, se deja.
3. **Sombras:** agregar `--shadow-rgb: 23 35 61` y expresar las tres sombras como
   `rgb(var(--shadow-rgb) / N%)`, con el mismo desplazamiento, desenfoque y opacidad de hoy.
4. **Layout:** reemplazar las dos apariciones de `5.5rem` por `var(--header-h)`, las dos de
   `15rem` por `var(--sidebar-w)` y las dos de `72rem` por `var(--content-max)`. Estos tres sí
   se reemplazan aunque estén dentro de `calc()`/`min()` (línea 15 y línea 98), porque el
   objetivo es justamente acoplar las reglas que deben coincidir.
5. **Valores fuera de escala:** dejarlos literales. Al final del bloque de tokens va un único
   comentario que remite a esta tarea, sin un comentario por línea. En la sección 6 se lista
   cada valor que quedó con su línea.
6. **Breakpoints:** las media queries no aceptan variables CSS. Se documentan como comentario
   (`/* breakpoints: 800px shell, 600px landing y auth */`) junto a los tokens.

## 3. Fuera de alcance

- Cambiar cualquier valor, aunque esté "casi" en la escala (`.8rem`, `.7rem`, `1.1rem`,
  `.85rem`, …). Es la normalización, y va en otra tarea.
- `line-height`, `letter-spacing` y transiciones: tienen pocos usos y casi todos únicos. Se
  revisan en la normalización.
- Los `z-index` locales del carrusel (1 y 3): ordenan tarjetas dentro de su propio contexto y no
  compiten con el resto de la página.
- Modo oscuro. Las sombras quedan preparadas, pero el tema no se toca.
- Dividir `globals.css` en archivos o capas `@layer`: es la Etapa 2.
- Cualquier archivo `.tsx`.

## 4. Decisiones de diseño

1. **Solo se reemplaza lo que coincide exactamente; lo demás queda literal.** Es lo
   único compatible con "cero cambio visual". Crear un token para cada uno de los 32 valores de
   espaciado institucionalizaría la deriva en vez de corregirla.
2. **Nombres de las escalas:**
   - Espaciado numérico en múltiplos de 4px: `--space-N` vale `N × .25rem`.
     `--space-1` .25rem, `--space-2` .5rem, `--space-3` .75rem, `--space-4` 1rem, `--space-5`
     1.25rem, `--space-6` 1.5rem, `--space-8` 2rem, `--space-10` 2.5rem, `--space-12` 3rem,
     `--space-16` 4rem. Cubre unos 100 de los 140 usos.
   - Radio: `--radius-sm` .5rem, `--radius-md` .75rem, `--radius-lg` 1rem, `--radius-xl`
     1.5rem, `--radius-pill` 2rem, `--radius-round` 50%.
   - Texto: `--text-xs` .75rem, `--text-sm` .8rem, `--text-md` .9rem, `--text-base` 1rem,
     `--text-xl` 1.5rem, `--text-2xl` 2rem.
   - Peso: `--weight-medium` 600, `--weight-semibold` 650, `--weight-bold` 700, `--weight-heavy`
     750. Los cuatro valores actuales tienen token; unificarlos es parte de la normalización.
   - Sombra: `--shadow-popover` (menú de cuenta, 12%), `--shadow-card` (perfil y auth, 6%),
     `--shadow-floating` (tarjetas del carrusel, 8%).
   - Layout: `--header-h` 5.5rem, `--sidebar-w` 15rem, `--content-max` 72rem.
   - Capas: `--z-skip-link` 10, `--z-popover` 20, `--z-header` 30.

   El espaciado usa números porque es una escala densa y aritmética, donde `--space-6` dice
   cuánto mide. Radio y texto usan tallas porque tienen pocos escalones y se eligen por rol.
3. **Los tokens viven en el `:root` de `globals.css`.** Moverlos a un `tokens.css`
   ahora mezclaría esta tarea con la Etapa 2, que reorganiza los archivos de estilos.
4. **Se verifica contra la línea base de TASK-023.** "Sin cambio visual" necesita
   capturas de antes y después. Por eso esta tarea no empieza hasta que TASK-023 tenga
   `visual.browser.spec.mjs` funcionando. Alternativa descartada: revisar a ojo, que no detecta
   un desvío de pocos píxeles.
5. **`calc()` y `clamp()` con literales adentro no se tocan** (por ejemplo,
   `calc(100% + .65rem)` o `clamp(1.25rem, 3vw, 2rem)`). Reemplazar solo una parte de una
   expresión fluida la vuelve más difícil de leer sin ganar consistencia. Se revisan en la
   normalización. Única excepción: los tres tokens de layout del punto 2.4.

## 5. Criterios de aceptación

- `git diff --stat origin/desarrollo` muestra cambios solo en `front/src/app/globals.css` y en
  esta tarea.
- El spec visual de TASK-023 pasa sin regenerar capturas: cero diferencias en todas las
  pantallas y anchos.
- Fuera de `:root` ya no aparece ningún literal que coincida con un valor de escala, salvo
  dentro de `calc()`/`clamp()`. Se comprueba con:
  - `grep -nE 'rgb\(' front/src/app/globals.css`, que solo debe mostrar líneas de `:root`.
  - `grep -nE '(^|[^-])(5\.5rem|15rem|72rem)' front/src/app/globals.css`, que solo debe
    mostrar `:root`.
  - Un grep por cada valor de la escala de espaciado, radio y texto, cuyas coincidencias
    restantes deben estar todas dentro de `calc()`/`clamp()`.
- `npm run lint`, `typecheck`, `test` y `build` del workspace `front` pasan, igual que en
  TASK-023.
- La sección 6 lista cada valor fuera de escala que quedó, con su línea, como entrada para la
  tarea de normalización.

## 6. Validación

Ejecutada el 2026-10-21 sobre `3ca4d80` (TASK-023 incluida). Solo cambia
`front/src/app/globals.css`: 16 líneas de tokens en `:root` y 99 reglas que pasan a `var(--…)`.

**Spec visual en la máquina del desarrollador (contra las capturas versionadas, Chrome de
sistema).** Con el cambio aplicado y el front construido con
`NEXT_PUBLIC_API_URL=http://localhost:3301 NEXT_PUBLIC_ALLOW_LOCAL_HTTP=true`, landing, inicio,
materias, alta-materia y perfil coinciden sin diferencias en 390 y 1280 px (10 de 12 capturas).
Fallan solo `login-390` y `login-1280` (unos 1.100 a 1.300 px, ratio 0.01). La causa es el link
"¿No verificaste tu correo? Solicitar un nuevo enlace" (`AccountForm.tsx`), que entró con el #12
y no está en las capturas del #13. La captura de login ya estaba desactualizada antes de esta
tarea. Hay que regenerar esas dos capturas en un commit aparte.

**Spec visual en el entorno de la nube (verificación previa).** La línea base commiteada no pasa en ese entorno *sin* el cambio: no hay Google
Chrome de sistema y se usó el Chromium 141 de Playwright como ejecutable del canal `chrome`
(config local fuera del repo con `launchOptions.executablePath`). Las 12 capturas difieren por
render (por ejemplo, `landing-1280`: 1748 px de alto contra 1749 px, 2 % de píxeles), no por la
tarea. Por eso no se regeneraron las capturas versionadas. Se hizo esto:

1. Con el código sin cambios, se generó una línea base local fuera del repo
   (`snapshotPathTemplate` en un directorio temporal, `--update-snapshots`). Una segunda corrida
   sin cambios también dio cero diferencias, así que el render es determinista.
2. Con el cambio aplicado y `next build` regenerado: las 12 capturas (6 pantallas × 390 y
   1280 px) coinciden con esa línea base y no hay ninguna diferencia.

Entorno: Postgres 16 local con migraciones aplicadas, `back` compilado, un receptor SMTP mínimo
en el puerto 1025 y el front compilado con `NEXT_PUBLIC_API_URL=http://localhost:3301`. En cada
corrida, la prueba "1280px › pantallas internas" queda en rojo por el `afterAll`:
`prisma.user.deleteMany()` viola `EmailVerificationCredential_userId_fkey`. Es un fallo de
limpieza que ya estaba antes de esta tarea (TASK-022 agregó la tabla y el spec no la borra) y
no tiene que ver con las capturas.

**Greps de la sección 5.**

- `rgb\(`: solo la línea 16 (`:root`).
- `(^|[^-])(5\.5rem|15rem|72rem)`: muestra la línea 18 (`:root`) y dos falsos positivos. La 108
  es `1.15rem`. La 162 es `calc(50% - 15rem)`, que es la mitad del ancho de la tarjeta del
  carrusel y no el sidebar, así que no debe acoplarse a `--sidebar-w`.
- Valores de escala: no queda ningún literal de espaciado, radio, tamaño de texto, peso o
  `z-index` global en esas propiedades. Las coincidencias restantes de `.5rem`, `1rem`,
  `1.25rem`, `1.5rem`, `2rem`, `2.5rem`, `3rem`, `4rem` y `50%` están dentro de
  `calc()`/`clamp()`/`min()`/`max()`, son el margen negativo `-.5rem` (línea 97) o son medidas
  de caja (`width`, `height`, `min-height`, `flex-basis`), que no son espaciado ni entran en
  esta tarea. `.8rem` aparece fuera de `font-size` como padding/radio/margen, que no son de la
  escala de texto.

**Comandos del workspace `front`.** `lint`: 0 errores (13 advertencias que ya estaban, todas en
archivos `.mjs`/`.tsx`). `typecheck`: sin errores. `test`: 9 archivos y 111 pruebas aprobadas.
`build` con `NEXT_PUBLIC_API_URL=https://api.example.invalid` (como en CI): compila.

### Pruebas manuales para el desarrollador

- Recorrer en el navegador landing, login, inicio, materias hasta comisiones, una alta, usuarios
  y perfil, en escritorio y en un ancho de celular. Nada tiene que verse distinto.
- En DevTools, inspeccionar el header y el sidebar. Cambiar `--header-h` en `:root` tiene que
  mover los dos juntos: es la prueba de que quedaron acoplados por el token y no por casualidad.

### Valores fuera de escala

Las líneas corresponden a `globals.css` después de esta tarea.

| Valor | Propiedad | Línea | Valor de escala más cercano |
|---|---|---|---|
| `-6rem` | `top` (skip link oculto) | 29 | ninguno (offset negativo para ocultarlo) |
| `1.2rem` | `padding` (header) | 31 | `--space-5` (1.25rem) |
| `.7rem` | `gap` (marca) | 32 | `--space-3` (.75rem) |
| `.35rem` | `padding` (nav) | 35 | `--space-1` (.25rem) |
| `.55rem` | `border-radius` (menú de cuenta) | 41 | `--radius-sm` (.5rem) |
| `.85rem` | `font-size` (aviso en menú) | 44 | `--text-sm` o `--text-md` (equidistantes) |
| `.8rem` | `padding` (sidebar) | 52 | `--space-3` (.75rem) |
| `.35rem` | `gap` (sidebar móvil) | 69 | `--space-1` |
| `.6rem` / `.4rem` | `padding` / `gap` (sidebar móvil) | 71 | `--space-2` (.5rem) |
| `.6rem` | `margin-bottom` (título sidebar móvil) | 72 | `--space-2` |
| `.4rem` | `gap` (breadcrumb) | 76 | `--space-2` |
| `.4rem` | `margin-left` (separador breadcrumb) | 77 | `--space-2` |
| `.3rem` | `padding-block` (breadcrumb) | 78 | `--space-1` |
| `.8rem` | `border-radius` (lista académica) | 86 | `--radius-md` (.75rem) |
| `.35rem` | `margin` (detalle en lista) | 92 | `--space-1` |
| `-.5rem` | `margin` (intro de cuenta) | 97 | `--space-2` en negativo |
| `1.1rem` / `1.35rem` | `border-radius` / `font-size` (avatar) | 102 | `--radius-lg` / `--text-xl` |
| `.2rem` | `padding` (rol del perfil) | 103 | `--space-1` |
| `1.15rem` | `font-size` (opciones del perfil) | 108 | `--text-base` (1rem) |
| `1.35rem` | `margin-block` (campo) | 121 | `--space-5` (1.25rem) |
| `.45rem` | `margin-bottom` (label) | 122 | `--space-2` |
| `.7rem` | `border-radius` (input) | 123 | `--radius-md` |
| `.85rem` / `.45rem` | `font-size` / `margin` (hint, error) | 126 | `--text-sm`/`--text-md` / `--space-2` |
| `.85rem` / `.8rem 1.4rem` | `gap` / `padding` (botón) | 128 | `--space-3` / `--space-3 --space-6` |
| `.7rem` | `border-radius` (aviso) | 134 | `--radius-md` |
| `.8rem` | `border-radius` (`dl`) | 139 | `--radius-md` |
| `.85rem` | `font-size` (`dt`) | 140 | `--text-sm` o `--text-md` |
| `4.5rem` | `padding-bottom` (hero) | 145 | `--space-16` (4rem) |
| `.6rem` | `gap` (eyebrow) | 146 | `--space-2` |
| `.95rem` | `font-size` (encabezado de sección) | 158 | `--text-md` o `--text-base` |
| `.65rem` | `padding` (badge) | 169 | `--space-3` |
| `.68rem` / `.55rem` | `font-size` / `margin` (categoría) | 170 | `--text-xs` / `--space-2` |
| `1.8rem` | `font-size` (título de tarjeta) | 171 | `--text-2xl` (2rem) |
| `.95rem` | `font-size` (descripción de tarjeta) | 172 | `--text-md` o `--text-base` |
| `1.1rem` | `gap` (controles del carrusel) | 174 | `--space-4` (1rem) |
| `1.3rem` | `font-size` (flecha del carrusel) | 175 | `--text-xl` (1.5rem) |
| `.1rem` | `gap` (puntos del carrusel) | 176 | `--space-1` |
| `.8rem` | `margin-top` (estado del carrusel) | 181 | `--space-3` |
| `3.5rem` | `padding-top` (hero móvil) | 188 | `--space-12` o `--space-16` (equidistantes) |
| `.65rem` | `gap` (acciones del hero móvil) | 189 | `--space-3` |
| `1.55rem` | `font-size` (título de tarjeta móvil) | 195 | `--text-xl` |

Literales dentro de expresiones, sin tocar por la decisión 5: líneas 31 (`max(1.5rem, …)`), 40
(`calc(100% + .65rem)`, `min(18rem, calc(100vw - 3rem))`), 57, 59, 61, 63, 84, 98, 115, 145,
148, 150 y 157 (`clamp()`), 114 (`min(100% - 3rem, …)`) y 162 (`calc(50% - 15rem)`). También
quedan literales `left: 5%` (línea 193), los `z-index` locales 1 y 3 del carrusel (163 a 165) y
las medidas de caja (`width`, `height`, `min-height`, `max-width`, `flex-basis`), que no forman
parte de ninguna escala de esta tarea.
