# Consulta de contenido

Estado: propuesta para discutir con el equipo. Cubre el recorrido de consulta de solo lectura (HU-04 Escenario 2) y la necesidad de contenido precargado para que la demo de la iteración no se muestre vacía.

**Esto no incluye publicar comentarios ni valoraciones.** La publicación de contenido es HU-06, explícitamente fuera de alcance de esta iteración (ver `02-alcance-primera-iteracion.md`). Este documento solo cubre lectura sobre datos que ya existen en la base.

## Recorrido de consulta

1. El usuario **autenticado** entra a la vista de Materias (`/home/materias`). El acceso de
   Visitante sin sesión quedó descartado para esta iteración por decisión de Tiago: la jerarquía
   académica exige sesión.
2. Selecciona una Materia y ve sus **Cursadas** (período + profesor que la dictó ese período).
3. Selecciona una Cursada y ve sus **Comisiones** (turnos).

Nota de modelo: este recorrido ya no pasa por `Cátedra` ni `ProfessorChair` — esas entidades se
reemplazaron por `Materia` (fusionada con Cátedra) y `Cursada` el 2026-10-10, ver
`03-modelo-de-dominio.md`.

No hay, en esta iteración, una pantalla de "perfil de profesor" con valoraciones agregadas — eso depende de que exista contenido real (HU-06), y por ahora no lo hay.

## Contenido precargado (seed)

Para que la demo de la iteración (ver `02-alcance-primera-iteracion.md`) no muestre pantallas vacías, la base necesita datos de ejemplo cargados de antemano:

- Al menos 2-3 Materias.
- Cursadas de esas Materias, cada una con su profesor y su período (año + cuatrimestre).
- Al menos una Comisión por Cursada.

Este seed se carga por script o migración de datos, no por el panel de administración (HU-11) — el panel sirve para mantenimiento posterior, no para la carga inicial de demo.

### Implementado (2026-10-10)

`back/src/academic/seed-academic.ts`, comando `npm run academic:seed --workspace=back` (requiere
`DATABASE_URL` y las migraciones aplicadas; sigue la misma convención de comando compilado que
`auth:provision-admin`).

Carga 3 Materias, 4 Profesores, 5 Cursadas y 8 Comisiones:

| Materia | Cursadas | Comisiones |
| --- | --- | --- |
| Análisis Matemático II | 2026 1er cuat. (Mariana Rivas) · 2025 2do cuat. (Héctor Balcedo) | 2 + 1 |
| Algoritmos y Estructuras de Datos | 2026 1er cuat. y 2026 2do cuat. (Lucía Ferreyra en ambas) | 2 + 1 |
| Sistemas Operativos | 2026 1er cuat. (Daniel Ocampo) | 2 (una inactiva, para ejercitar ese estado) |

Decisiones del seed:

- **Los profesores son ficticios, a propósito.** Los nombres de materia siguen el estilo real de
  la carrera, pero no se cargan docentes reales: esta plataforma existe para que estudiantes
  opinen sobre ellos, y meter personas reales como dato de demostración —sin que lo sepan— es una
  decisión de producto que nadie tomó. Confirmado con Tiago el 2026-10-10.
- **Aditivo e idempotente**: puede correrse más de una vez sin duplicar (verificado: la segunda
  corrida reporta 0 nuevos) y nunca borra ni modifica nada preexistente. `Profesor.nombreCompleto`
  no es único a propósito (puede haber homónimos reales), así que la idempotencia de profesores se
  resuelve buscando por nombre antes de crear.
- **El volumen del seed no ejercita el control de paginación de la interfaz**: el frontend no
  expone `pageSize` y usa el default del backend (20), así que con 3 materias ese control nunca
  se muestra. La paginación del backend sí quedó verificada por API (`?page=2&pageSize=1` devuelve
  la segunda materia). Si se quiere ver el control en la demo, hace falta más volumen de seed o
  exponer `pageSize` en la interfaz — ninguna de las dos se hizo acá.

## Por qué no hay valoraciones en el seed

Sembrar valoraciones falsas obligaría a definir ahora el modelo de agregación (promedios, conteos) que `01-arquitectura-y-tecnologias.md` deja explícitamente para cuando HU-06 exista. Mostrar la jerarquía académica sin valoraciones es suficiente para demostrar esta iteración; agregar valoraciones de prueba sin un caso de uso de publicación real sería construir algo que después hay que rehacer.

## Preguntas abiertas

1. ~~¿El recorrido de consulta debe estar disponible para usuarios sin sesión (Visitante, HU-03d)?~~
   **Resuelto (2026-10-10): no.** Exige sesión autenticada.
2. ~~Cantidad y realismo del contenido de seed~~ **Resuelto (2026-10-10)**: 3 materias con nombres
   realistas y profesores ficticios (ver arriba). Si para la defensa hace falta más volumen o
   mayor realismo, se amplía el array `MATERIAS` del script — no requiere cambios de código.
3. **Pendiente**: cargar este seed en producción. Bloqueado por acceso — ver abajo.

## Producción

El seed **todavía no se cargó en producción** (2026-10-10). Según
`docs/architecture/DEFINICION-ARQUITECTURA.md`, producción es Vercel (front) + Render (back) +
Neon (base), pero en este entorno no hay credenciales de Neon (`DATABASE_URL` del `.env` local
está vacío; el stack de desarrollo arma su cadena desde las variables `POSTGRES_*` de Compose) ni
se encontró ninguna URL desplegada documentada.

Para cargarlo allá hace falta, con la `DATABASE_URL` de Neon en el entorno:

```sh
npm run build --workspace=back
npm run academic:seed --workspace=back
```

Es seguro correrlo contra una base con datos: es aditivo e idempotente, no borra ni modifica nada.
