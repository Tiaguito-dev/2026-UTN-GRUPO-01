# Regla: Task Intake

Un agente (`back`, `front` o `test`) no puede empezar a implementar una tarea a menos que:

1. **Exista una tarea bajo `docs/tasks/`.** Debe incluir alcance, exclusiones, restricciones,
   criterios de aceptación y validaciones. Una tarea ambigua se aclara antes de escribir código,
   no mientras se escribe.
2. **Las decisiones no triviales estén respaldadas por un TDD.** Si la tarea involucra una
   elección de diseño/arquitectura, una dependencia nueva, o un cambio a una decisión existente,
   tiene que referenciar un documento de diseño técnico bajo `docs/tdd/`. Si todavía no existe
   para esa decisión, se escribe primero.

## Restricciones operativas

- El agente no descarga archivos ni genera ejecutables que la tarea no requiera expresamente.
- Instalar dependencias declaradas forma parte de la tarea solo cuando el alcance lo autoriza.
- No se realizan cambios fuera del alcance ni se modifican zonas sensibles sin autorización.
- Antes de una acción particular, destructiva o con efectos externos, el agente explica qué
  necesita hacer y espera la aprobación del desarrollador.
- Los cambios se realizan en una rama de trabajo y se integran mediante pull request; nunca se
  incorporan directamente a una rama protegida.
- Al finalizar, el agente registra el resultado en `CHANGELOG.md`, completa la evidencia de
  validación y mueve la tarea a `docs/tasks/finished/`.

## Por qué

Las tareas bien definidas dan mejores resultados que las ambiguas, y las decisiones que viven
solo en un historial de chat se pierden. Registrarlas como TDD mantiene el razonamiento
disponible para la próxima persona (o agente) que toque esa área.
