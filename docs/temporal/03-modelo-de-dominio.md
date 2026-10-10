# Modelo de dominio

Estado: sincronizado con el modelo implementado (2026-10-10). Describe las entidades académicas y
de valoración que necesita esta iteración, apoyado en los módulos `academic` y `reviews` definidos
en `01-arquitectura-y-tecnologias.md`.

Los nombres de entidad de este módulo están **en español**, por decisión puntual de Tiago para
`academic`. Es una excepción deliberada a la convención del proyecto (inglés), no una convención
nueva — ver `docs/tasks/in-progress/TASK-014-academic-etapa-1-jerarquia.md` sección 8.

## Entidades

| Entidad | Definición | Estado |
| --- | --- | --- |
| `Materia` | Unidad curricular de la carrera. Absorbe lo que antes era `Cátedra`. | Implementada. |
| `Profesor` | Docente. Su nombre **no es único** a propósito: puede haber homónimos reales. | Implementada. |
| `Cursada` | Una materia dictada en un período concreto (año + cuatrimestre) por un profesor. Es el registro histórico: inmutable respecto de quién dictó *ese* período. | Implementada. |
| `Comision` | Turno o grupo de cursada dentro de una `Cursada` puntual (mañana, tarde, noche). Tiene `activa`, porque se abren y cierran. | Implementada. |
| `Review` (valoración/comentario) | Valoración contextualizada a una `Cursada` o a una `Comision` — ver pregunta abierta #1. No se publica en esta iteración. | Sin modelar todavía. |

Las 4 entidades implementadas tienen `deletedAt` para baja lógica
(`docs/standards/soft-delete.md`), todavía sin ningún caso de uso que lo use.

## Relaciones

```
Materia  1 --- N Cursada
Profesor 1 --- N Cursada
Cursada  1 --- N Comision
Cursada  1 --- N Review   (futuro, no se escribe en esta iteración)
```

## Por qué existe `Cursada` (y por qué desapareció `Cátedra`)

Son dos cambios distintos, decididos el 2026-10-10:

1. **`Cátedra` se fusionó en `Materia`.** En la práctica de esta facultad no hay más de una
   cátedra por materia, así que mantenerlas separadas era una capa que no aportaba nada.

2. **`Cursada` reemplaza a la vieja asignación `ProfessorChair`**, y no es solo un cambio de
   nombre. Si el profesor a cargo de una materia se guardara como un campo mutable, al cambiar
   de titular en 2027 una reseña escrita en 2026 pasaría a mostrar al profesor nuevo —que nunca
   dio esa clase—, lo que es un error de integridad de datos, no un detalle. `Cursada` ata el
   profesor al período en el que efectivamente dictó, y queda fijo. El profesor "actual" de una
   materia se deriva de su Cursada más reciente; no se guarda aparte.

**Supuesto vigente, no confirmado:** el profesor se asigna a nivel `Cursada`, no a nivel
`Comision` — todas las comisiones de una misma cursada comparten titular. Si en la práctica cada
comisión tiene su propio profesor, `profesorId` se movería de `Cursada` a `Comision`.

## Consultas que necesita esta iteración

Lectura (HU-04, implementada — ver `TASK-014`):

- Listar Materias.
- Listar Cursadas de una Materia, con el nombre del profesor de cada una.
- Listar Comisiones de una Cursada.

Escritura (HU-11, pendiente — ver `06-administracion.md`):

- Alta y edición de Materia, Profesor, Cursada y Comisión.

Ninguna consulta de esta iteración necesita agregaciones de `Review` (promedios, conteos) porque
no hay valoraciones publicadas todavía. Esa proyección queda documentada en
`01-arquitectura-y-tecnologias.md` como diseño para cuando exista contenido real.

## Sobre `Review`

A diferencia de lo que planteaba la versión anterior de este documento, `Review` **no se modeló**
en esta iteración: no existe la tabla, ni el puerto, ni el contrato. La razón es la misma que
hizo aparecer `Cursada` — a qué se asocia una reseña es justamente la pregunta abierta #1, y
fijar un contrato antes de resolverla sería adelantar una decisión que después hay que deshacer.

## Preguntas abiertas

1. Cuando llegue HU-06: ¿`Review` se asocia a `Cursada` (el profesor dictó ese período) o a
   `Comision` (el turno concreto que cursó quien escribe)? La segunda es más precisa; la primera
   es más simple y evita reseñas dispersas entre turnos con poca masa crítica. No bloquea esta
   iteración.
2. ¿El profesor es realmente de la `Cursada` o de cada `Comision`? Ver el supuesto de arriba.
