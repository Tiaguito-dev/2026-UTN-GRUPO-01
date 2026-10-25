# TASK-035: Normalización de tokens de color, layout, radios y tipografía secundaria

Estado: En progreso. Cambios de CSS y documentación aplicados; falta regenerar la línea base visual de Playwright (requiere `TEST_DATABASE_URL`) e inspeccionar en navegador. Decisiones de diseño tomadas y acordadas en `/grill-me` el 2026-10-25.
Depende de TASK-027 (tokens de diseño), TASK-028 (cascada CSS y capas), TASK-032 (consistencia y accesibilidad) y TASK-034 (tokens en MateriasList).
Fecha: 2026-10-25

## 1. Contexto y objetivo

Durante la revisión de estilos y consolidación de CSS Modules y capas surgieron cinco hallazgos de diseño pendientes de normalización (sección 6 de TASK-027 y exclusiones de TASK-034):
1. **Punto 02 (Color primario en sombra):** La sombra de los chips activos en `MateriasList.module.css` usa `rgb(18 64 201 / 14%)`. El valor `#1240C9` es `--primary`, pero al estar codificado como literal numérico no reacciona si el tema o color primario cambia.
2. **Punto 03 (Ancho de contenido duplicado):** `.system-content` en `layout.css` usa `max-width: 83rem` como literal no tokenizado, mientras que `--content-max` está fijado en `72rem` para páginas públicas y encabezado.
3. **Punto 04 (Dispersión de radios):** Convivían radios de `.7rem`, `.8rem`, `.55rem`, `.65rem` y `1.1rem` en inputs, alertas, listados académicos, paneles, avatares y menús, difiriendo por menos de 1px con los tokens oficiales (`--radius-sm: .5rem`, `--radius-md: .75rem`, `--radius-lg: 1rem`).
4. **Punto 05 (Tipografía secundaria fuera de escala):** El valor `.85rem` (13.6px) se repetía en seis lugares para textos de ayuda, errores de formulario, descripciones (`dt`), avisos y chips, sin pertenecer a la escala tipográfica existente (`--text-sm: .8rem` y `--text-md: .9rem`).
5. **Punto 06 (Texto debajo del mínimo en landing):** Se detectó en revisiones previas una etiqueta de `.68rem` en `landing.css`, resuelta en TASK-032 elevándola a `var(--text-xs)`.

Objetivo:
Normalizar e incorporar a la escala oficial de tokens los valores literales y derivados acordados, garantizando coherencia visual en todo el frontend, alineación con [frontend-estilos.md](../../standards/frontend-estilos.md) y actualización controlada de la línea base visual de Playwright.

## 2. Alcance

### 2.1. Nuevos tokens en `front/src/styles/tokens.css`

| Token | Valor | Propósito |
|---|---|---|
| `--primary-rgb` | `18 64 201` | Canal RGB del color primario (`#1240C9`) para componer opacidades/sombras con `rgb(var(--primary-rgb) / N%)`. |
| `--content-max-app` | `83rem` | Ancho máximo para el área de contenido de la aplicación interna (`.system-content`). |

### 2.2. Reemplazo de literales y normalización en hojas de estilo

| Archivo | Selector | Propiedad | Valor original | Token aplicado |
|---|---|---|---|---|
| `styles/tokens.css` | `:root` | Tokens | - | Agrega `--primary-rgb` y `--content-max-app` |
| `styles/layout.css` | `.system-content` | `max-width` | `83rem` | `var(--content-max-app)` |
| `styles/base.css` | `input, select` | `border-radius` | `.7rem` | `var(--radius-md)` (.75rem) |
| `styles/base.css` | `dt` | `font-size` | `.85rem` | `var(--text-sm)` (.8rem) |
| `styles/components/notice.css` | `.notice` | `border-radius` | `.7rem` | `var(--radius-md)` (.75rem) |
| `styles/components/academic.css` | `.academic-list li` | `border-radius` | `.8rem` | `var(--radius-md)` (.75rem) |
| `styles/components/card.css` | `.profile-avatar` | `border-radius` | `1.1rem` | `var(--radius-lg)` (1rem) |
| `styles/components/card.css` | `.card-panel dl` | `border-radius` | `.8rem` | `var(--radius-md)` (.75rem) |
| `styles/components/account-menu.css` | `.account-menu-panel a, .account-menu-action` | `border-radius` | `.55rem` | `var(--radius-sm)` (.5rem) |
| `styles/components/account-menu.css` | `.account-menu-panel .notice` | `font-size` | `.85rem` | `var(--text-sm)` (.8rem) |
| `styles/components/form.css` | `.hint, .field-error` | `font-size` | `.85rem` | `var(--text-sm)` (.8rem) |
| `components/academic/MateriasList.module.css` | `.filters .clearButton` | `border-radius` | `.65rem` | `var(--radius-sm)` (.5rem) |
| `components/academic/MateriasList.module.css` | `.filters .clearButton` | `font-size` | `.85rem` | `var(--text-sm)` (.8rem) |
| `components/academic/MateriasList.module.css` | `.filters .chip` | `font-size` | `.85rem` | `var(--text-sm)` (.8rem) |
| `components/academic/MateriasList.module.css` | `.filters .chip[aria-pressed="true"]` | `box-shadow` | `0 2px 4px rgb(18 64 201 / 14%)` | `0 2px 4px rgb(var(--primary-rgb) / 14%)` |

### 2.3. Documentación
- Actualizar la tabla de tokens en `docs/standards/frontend-estilos.md` incorporando `--primary-rgb` y `--content-max-app`.

## 3. Fuera de alcance

- Modificar la escala existente de espaciado o introducir pasos tipográficos adicionales (`--text-sm2` o `--text-caption` descartados en `/grill-me`).
- Alterar las expresiones fluidas `clamp()` o `calc()` en layouts y paneles.
- Modificar componentes de React (`.tsx`) salvo que se requiera por cambios estructurales (no aplica en esta tarea).

## 4. Decisiones tomadas en `/grill-me`

1. **Color primario en sombras (Punto 02):** Se agrega `--primary-rgb: 18 64 201;` en `tokens.css` siguiendo el mismo patrón que `--shadow-rgb: 23 35 61;`, y se reemplaza el literal en `MateriasList.module.css`. Desacopla la sombra de cualquier color hardcodeado.
2. **Ancho máximo de aplicación (Punto 03):** Se reconoce formalmente la distinción entre el contenedor de páginas públicas/auth (`--content-max: 72rem`) y el layout interno multi-columna (`--content-max-app: 83rem`), tokenizando el valor en lugar de forzar 72rem en pantallas de gestión.
3. **Unificación de radios de control y contenedores (Punto 04):**
   - Inputs, selects y notices pasan a `--radius-md` (.75rem), alineándose de forma idéntica con los botones adyacentes (que ya usaban `--radius-md`).
   - Listas académicas y listas de definición (`dl`) pasan a `--radius-md` (.75rem).
   - Acciones de menú y botón de limpiar filtros pasan a `--radius-sm` (.5rem).
   - Avatar de perfil pasa de `1.1rem` a `--radius-lg` (1rem).
4. **Tipografía secundaria unificada a `--text-sm` (Punto 05):** `.85rem` pasa a `var(--text-sm)` (.8rem / 12.8px) en textos de ayuda, errores, descripciones y chips, alineándose con `.academic-list span`, `.sidebar-note` y `.card-panel dd`. No compromete la accesibilidad (mínimo exigido: 12px / .75rem).
5. **Texto landing (Punto 06):** Confirmado resuelto en `cbfce35` (TASK-032). `.feature-category` ya cuenta con `var(--text-xs)` (.75rem).

## 5. Criterios de aceptación

- `front/src/styles/tokens.css` define `--primary-rgb: 18 64 201;` y `--content-max-app: 83rem;`.
- No queda ningún uso literal de `.7rem`, `.8rem`, `.55rem`, `.65rem` o `1.1rem` en la propiedad `border-radius` de los archivos CSS del frontend.
- No queda ningún uso literal de `.85rem` en `font-size` en el frontend.
- `MateriasList.module.css` no contiene literales RGB en la sombra de los chips activos.
- `npm run lint --workspace=front` pasa sin advertencias ni errores.
- `npm run typecheck --workspace=front` pasa con 0 errores.
- `npm run test --workspace=front` pasa todos los tests unitarios.
- `npm run build --workspace=front` compila exitosamente.
- La línea base visual de Playwright (`tests/visual.browser.spec.mjs`) se regenera y pasa sin diferencias residuales.

## 6. Verificación planificada

Cuando se ejecute la tarea:
1. `npm run lint --workspace=front`
2. `npm run typecheck --workspace=front`
3. `npm run test --workspace=front`
4. `npm run build --workspace=front`
5. `npm run test:e2e --workspace=front -- tests/visual.browser.spec.mjs --update-snapshots`
6. Inspección en navegador de `/login`, `/account` y `/home/materias`.
