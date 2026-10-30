# TASK-034: Reemplazo de literales por tokens en MateriasList.module.css

Estado: Implementada. Decisiones tomadas en `/grill-me` y aprobadas en `/plan`.
Depende de TASK-027 (tokens de diseño) y TASK-028 (cascada CSS y capas).
Fecha: 2026-10-25

## 1. Contexto y objetivo

El archivo `front/src/components/academic/MateriasList.module.css` es el único CSS Module del proyecto
(según documenta [frontend-estilos.md](../../standards/frontend-estilos.md), sección "CSS Modules").
En su estado original, contenía varios valores literales de radio (`1.5rem`, `2rem`, `1rem`), tamaño de
texto (`.9rem`), peso (`750`, `650`) y espaciado (`.25rem`, `.5rem`, `.75rem`, `1rem`, `1.25rem`, `1.5rem`)
que coincidían exactamente con la escala de tokens definida en `front/src/styles/tokens.css`.

El estándar `frontend-estilos.md` establece en la Regla 4:
> "Un valor que coincide con un token se escribe como `var(--…)`, nunca como literal."
y en la sección de CSS Modules añade:
> "Si se toca un módulo existente, también usa tokens."

Objetivo:
Reemplazar todos los valores literales de `MateriasList.module.css` que coinciden con tokens por sus
variables correspondientes `var(--...)`, garantizando el mismo valor computado y cero diferencias
visuales.

## 2. Alcance

Modificación exclusiva de `front/src/components/academic/MateriasList.module.css`:

| Propiedad | Selector | Valor original | Token aplicado |
|---|---|---|---|
| `margin-bottom` | `.filters` | `1.5rem` | `var(--space-6)` |
| `border-radius` | `.filters` | `1.5rem` | `var(--radius-xl)` |
| `margin-bottom` | `.heading` | `1.25rem` | `var(--space-5)` |
| `margin` | `.title` | `0 0 .25rem` | `0 0 var(--space-1)` |
| `font-weight` | `.title` | `750` | `var(--weight-heavy)` |
| `font-size` | `.description` | `.9rem` | `var(--text-md)` |
| `gap` | `.search` | `.5rem 1rem` | `var(--space-2) var(--space-4)` |
| `margin-bottom` | `.search` | `1.5rem` | `var(--space-6)` |
| `padding-top` | `.filterGroup` | `1.25rem` | `var(--space-5)` |
| `margin` | `.groupLabel` | `0 0 .75rem` | `0 0 var(--space-3)` |
| `font-size` | `.groupLabel` | `.9rem` | `var(--text-md)` |
| `font-weight` | `.groupLabel` | `650` | `var(--weight-semibold)` |
| `gap` | `.chips` | `.5rem` | `var(--space-2)` |
| `padding` | `.filters .chip` | `.5rem 1rem` | `var(--space-2) var(--space-4)` |
| `border-radius` | `.filters .chip` | `2rem` | `var(--radius-pill)` |
| `margin-top` | `.electiveGroup` | `1.25rem` | `var(--space-5)` |
| `padding` | `.electiveGroup` | `1rem` | `var(--space-4)` |
| `border-radius` | `.electiveGroup` | `1rem` | `var(--radius-lg)` |

## 3. Fuera de alcance

- Normalización de valores fuera de escala (`.65rem`, `.85rem`, `.4rem .7rem`, `2.75rem`, sombra custom de chips). Estos valores quedan literales a la espera de la tarea de normalización global (sección 6 de TASK-027).
- Modificar el literal dentro de `clamp(1.25rem, 3vw, 2rem)` en la línea 4 de `.filters` (permitido expresamente por la excepción de `frontend-estilos.md` y alineado con `.card-panel`).
- Migrar `MateriasList.module.css` a `styles/components/academic.css` (decisión de arquitectura abierta bajo TASK-028).

## 4. Decisiones tomadas

1. **Reemplazar todos los valores coincidentes con la escala.** Se incorporan `.25rem` (`--space-1`), `.75rem` (`--space-3`) y `1rem` (`--space-4`) además de los radios, pesos y espacios inicialmente detectados, para lograr paridad total con la escala de tokens en el archivo.
2. **Preservar literales en `clamp()`.** Según la decisión 5 de TASK-027 y `frontend-estilos.md`, las expresiones `clamp()` fluidas conservan sus literales para evitar mezclas parciales de tokens con unidades de viewport (`vw`), manteniendo idéntica definición que `.card-panel`.

## 5. Criterios de aceptación

- `front/src/components/academic/MateriasList.module.css` no contiene ningún valor literal que coincida con la escala de espaciado, radio, tamaño de texto o peso (salvo dentro de `clamp()`).
- `npm run lint --workspace=front` pasa sin advertencias ni errores.
- `npm run typecheck --workspace=front` pasa con 0 errores.
- `npm run test --workspace=front` pasa todos los tests unitarios.
- La pantalla de materias (`/home/materias`) mantiene idéntico renderizado visual.

## 6. Validación

Ejecutada el 2026-10-25 tras aplicar los cambios en `front/src/components/academic/MateriasList.module.css`.

- **Valores computados y equivalencias 1:1**:
  - `1.5rem` $\rightarrow$ `var(--space-6)` (24px) y `var(--radius-xl)` (24px)
  - `1.25rem` $\rightarrow$ `var(--space-5)` (20px)
  - `1rem` $\rightarrow$ `var(--space-4)` (16px) y `var(--radius-lg)` (16px)
  - `.75rem` $\rightarrow$ `var(--space-3)` (12px)
  - `.5rem` $\rightarrow$ `var(--space-2)` (8px)
  - `.25rem` $\rightarrow$ `var(--space-1)` (4px)
  - `.9rem` $\rightarrow$ `var(--text-md)` (14.4px)
  - `750` $\rightarrow$ `var(--weight-heavy)` (750)
  - `650` $\rightarrow$ `var(--weight-semibold)` (650)
  - `2rem` $\rightarrow$ `var(--radius-pill)` (32px)
  
  Los valores computados son 100% idénticos a los definidos en `front/src/styles/tokens.css`, produciendo un diff visual nulo (0 diferencias de renderizado en `materias-1280.png` y `materias-390.png`).

- **Comprobación de escala**:
  El único literal dentro de la propiedad de espaciado/radio restante es `clamp(1.25rem, 3vw, 2rem)`, amparado por la excepción de `frontend-estilos.md`. Los restantes literales (`.65rem`, `.85rem`, `.4rem .7rem`, `2.75rem`) no corresponden a ningún token de la escala y quedan documentados como valores fuera de escala.

- **Comandos ejecutados**:
  - `npm run lint --workspace=front`: Exited 0 (0 warnings, 0 errors).
  - `npm run typecheck --workspace=front`: Exited 0 (0 errors en `src/` y `tests/`).
  - `npm run test --workspace=front`: Exited 0 (22 test files passed, 222 tests passed).
  - `npm run build --workspace=front`: Exited 0 (Next.js 16.3.8 Turbopack, 22 páginas estáticas/dinámicas generadas correctamente).
  - `npm run typecheck --workspace=front` (post-build): Exited 0.
