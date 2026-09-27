# Tareas del Proyecto

Esta carpeta contiene tareas autocontenidas que una persona o agente puede ejecutar sin depender
del historial de una conversación.

## Estados

- `pendient/`: tarea definida y todavía no iniciada.
- `in-progress/`: tarea actualmente en ejecución.
- `finished/`: tarea terminada y validada.

El nombre `pendient` se conserva porque forma parte de la estructura acordada inicialmente.

## Convención

Cada archivo usa `TASK-NNN-descripcion-corta.md` y debe incluir:

- estado y fecha de última actualización;
- objetivo y contexto;
- TDD relacionado cuando exista una decisión técnica no trivial;
- alcance y exclusiones explícitas;
- restricciones operativas;
- criterios de aceptación verificables;
- validaciones requeridas;
- resultado final cuando se complete.

Antes de implementar, la tarea se mueve a `in-progress/`. Cuando el desarrollador aprueba la
validación manual, se actualizan una sola vez la documentación de entrega, sus resultados y
`CHANGELOG.md`; recién entonces la tarea se mueve a `finished/` y se aplica `commit-work`.

Las tareas deben respetar el ["Gate de tarea" en `agents/OVERVIEW.md`](../../agents/OVERVIEW.md#gate-de-tarea-exigible),
los estándares bajo `docs/standards/` y las decisiones bajo `docs/tdd/`.
