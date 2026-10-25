# TASK-053: Tonos de etiqueta para cargos (Titular, Adjunto, JTP)

Estado: Finalizada.
La parte visual no depende de back; el mapeo cargo → tono depende del tipo de cargo de TASK-037.
Fecha: 2026-10-25

## 1. Contexto y objetivo

Artboards de referencia:

- `CursadaDetalle.dc.html`: en cada tarjeta de comisión, cada profesor lleva una etiqueta de cargo
  (píldora, texto 12px, peso 650): **Titular** fondo `--primary` y texto blanco; **Adjunto** fondo
  `--soft-blue` y texto `--primary`; **JTP** fondo `--surface`, texto `--muted` y borde `--border`.
- `ComisionDetalle.dc.html`: las mismas etiquetas en la lista de profesores (texto 12.8px).

Estado actual: `components/ui/Badge.tsx` es la única etiqueta, con tonos `role` y `upcoming`
(`styles/components/badge.css`). `components/ui/` no puede conocer el dominio
(`frontend-componentes.md`), así que la primitiva no puede tener un tono "titular".

Objetivo: agregar a `Badge` tres tonos genéricos que cubran los cargos y dejar el mapeo de dominio
fuera de `ui/`.

> Esta tarea modifica un componente reutilizable global (`AGENTS.md`, áreas sensibles). Esta tarea
> es la autorización explícita, dentro del alcance de la sección 2. Justificación: las etiquetas
> aparecen en dos pantallas del rediseño y los mismos tonos sirven para "Activa", "Inactiva" y
> "2.º año" de los detalles.

## 2. Alcance

- `components/ui/Badge.tsx`: `tone` acepta además `"solid" | "soft" | "outline"`.
- `styles/components/badge.css`: las tres clases. Tokens existentes: `--primary`, `--soft-blue`,
  `--surface`, `--muted`, `--border`, `--radius-pill`, `--text-xs`, `--weight-semibold`.
  **Token declarado:** el padding vertical de 2px del artboard no está en la escala (`--space-1` es
  4px); se usa `--space-1` si la captura no muestra diferencia apreciable y, si la muestra, la tarea
  agrega `--space-half: .125rem` justificándolo en `tokens.css`.
- `lib/format/cargo.ts` (nuevo, cuando exista el tipo de cargo de TASK-037): `CARGO_LABEL` y
  `CARGO_TONE` (`TITULAR → solid`, `ADJUNTO → soft`, `JTP → outline`).
- `docs/standards/frontend-componentes.md`: documentar los tonos nuevos y que el mapeo de dominio va
  en `lib/format/`.

## 3. Fuera de alcance

- Usar las etiquetas en una pantalla (detalle de cursada y de comisión, que dependen de TASK-037).
- Tonos de estado (`success` para "Activa"/"Nueva"): se agregan con la pantalla que los use.
- Cambiar los tonos `role` y `upcoming`.

## 4. Decisiones de diseño

1. **Tonos genéricos en `Badge`, mapeo en `lib/format/` (propuesta).** Respeta la regla de que
   `ui/` no conoce el dominio, igual que `ROLE_LABEL` en `lib/format/role.ts`.
2. **Extender `Badge` en vez de una primitiva nueva (propuesta).** "Si existe la primitiva, se usa;
   una variante nueva se agrega a la primitiva" (`frontend-componentes.md`).
3. **`cargo.ts` se crea recién con el tipo de cargo (propuesta).** Hasta que TASK-037 defina el
   enum, un mapeo sin tipo sería código muerto. Si TASK-037 no llegó, la tarea se cierra solo con los
   tonos y el mapeo pasa a la tarea de la pantalla.

## 5. Casos de prueba y criterios de aceptación

Vitest + Testing Library (`ui-badge.spec.tsx`, ampliado):

- cada tono nuevo renderiza la clase `badge badge-<tono>` y su texto;
- los tonos existentes no cambian;
- si se crea `cargo.ts`: `cargo.spec.ts` (node) verifica etiqueta y tono de los tres cargos.

Playwright + axe: sin consumidor no hay captura en esta tarea. La captura y el chequeo de contraste
con axe se hacen en la tarea del detalle de cursada o de comisión, que agrega su pantalla a `SCREENS`.
Contraste a verificar ahí: `--muted` sobre `--surface` y `--primary` sobre `--soft-blue` (ambos ya se
usan en el sistema con texto chico).

Criterios:

- `Badge.tsx` no importa tipos de dominio.
- `npm run lint --workspace=front`, `npm run typecheck --workspace=front` y
  `npm run test --workspace=front` pasan.
- Capturas existentes sin cambios.

## 6. Validación

- Tests unitarios de Vitest: `npm run test --workspace=front` pasa con 33 archivos y 269 pruebas, incluyendo `cargo.spec.ts` y `ui-badge.spec.tsx` ampliado para los tonos `role`, `upcoming`, `solid`, `soft` y `outline`.
- Verificación de tipos: `npm run typecheck --workspace=front` pasa sin errores.
- Linteo: `npm run lint --workspace=front` pasa con 0 errores y 0 advertencias.
- `Badge.tsx` permanece completamente agnóstico al dominio (`BadgeTone = "role" | "upcoming" | "solid" | "soft" | "outline"`).
- Estilos en `badge.css` incorporan las tres clases `.badge-solid`, `.badge-soft` y `.badge-outline` utilizando la escala oficial de tokens (`--primary`, `--soft-blue`, `--surface`, `--muted`, `--border`, `--radius-pill`, `--text-xs`, `--weight-semibold`, `--space-1`, `--space-3`).
- Se creó `front/src/lib/format/cargo.ts` con `CARGO_LABEL`, `CARGO_SHORT_LABEL`, `CARGO_TONE` (`TITULAR → solid`, `ADJUNTO → soft`, `JTP → outline`) y `cargoLabel`.
- Documentación en `docs/standards/frontend-componentes.md` actualizada.

### Pruebas manuales para el desarrollador

Ninguna visible en esta tarea. No se tiene que romper: la etiqueta de rol en el menú de cuenta y
"Próximamente" en las secciones futuras.

## 7. Riesgos

- Sin consumidor, los tonos podrían quedar sin uso si cambia el diseño; por eso la tarea es chica y
  conviene hacerla justo antes del detalle de cursada.
