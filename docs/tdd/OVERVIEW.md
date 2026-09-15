# TDD — Technical Design Documentation

Acá "TDD" significa *Technical Design Documentation* (documentación de diseño técnico) — **no**
test-driven development. Cada archivo registra una decisión que tomó el proyecto, por qué, y qué
alternativas se consideraron, para que el razonamiento quede disponible después de que la
conversación que lo produjo ya no esté.

Equivalente al patrón estándar de la industria [Architecture Decision Record
(ADR)](https://adr.github.io/).

## Cuándo escribir uno

Según [rules/task-intake.md](../../rules/task-intake.md), una decisión no trivial (arquitectura,
una dependencia nueva, un cambio a una decisión existente) necesita un TDD antes de que un agente
la implemente.

## Nombres de archivo

`TDD-[MÓDULO]-H[N].md` para el hito concreto de un módulo (ej. `TDD-AUTH-H1.md`), o
`TDD-[MÓDULO].md` para el TDD general de un módulo. Una feature compartida por varios módulos
sale a su propio documento bajo `docs/tdd/compartidos/` en vez de vivir adentro del TDD de un
solo módulo.

## Estado

`Propuesto` (recién escrito) → `En Revisión` (ya iterado, todavía sin validar) → `Aprobado` (el
equipo llegó a consenso).

## Plantilla

[docs/tdd/template.md](./template.md) — estructura completa (contexto de negocio, diseño
técnico, arquitectura/flujo, casos de borde, preguntas abiertas). Ver un ejemplo completo en
[docs/tdd/TDD-EJEMPLO-H1.md](./TDD-EJEMPLO-H1.md).
