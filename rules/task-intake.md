# Regla: Task Intake

Un agente (`back`, `front` o `test`) no puede empezar a implementar una tarea a menos que:

1. **La tarea esté bien definida** — alcance claro y criterios de aceptación. Una tarea ambigua
   se aclara antes de escribir código, no mientras se escribe.
2. **Las decisiones no triviales estén respaldadas por un TDD.** Si la tarea involucra una
   elección de diseño/arquitectura, una dependencia nueva, o un cambio a una decisión existente,
   tiene que referenciar un documento de diseño técnico bajo `docs/tdd/`. Si todavía no existe
   para esa decisión, se escribe primero.

## Por qué

Las tareas bien definidas dan mejores resultados que las ambiguas, y las decisiones que viven
solo en un historial de chat se pierden. Registrarlas como TDD mantiene el razonamiento
disponible para la próxima persona (o agente) que toque esa área.
