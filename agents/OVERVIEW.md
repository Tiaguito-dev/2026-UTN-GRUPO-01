# Agentes

Este repositorio usa tres agentes con alcance por dominio. Cada uno tiene su propio perfil bajo
esta carpeta:

| Agente | Archivo | Alcance |
|---|---|---|
| Backend | [back.md](./back.md) | `back/` |
| Frontend | [front.md](./front.md) | `front/` |
| Testing | [test.md](./test.md) | `front/tests/`, `back/tests/` |

## Metodología

Para quien use agentes en este repositorio:

1. **Planificar primero.** Antes de que cualquier agente toque código, se planifica la tarea: qué
   tiene que pasar y por qué. Una tarea bien definida es mejor que una confusa — es la diferencia
   entre un agente haciendo lo correcto a la primera y un agente adivinando, equivocándose, y
   quemando un ciclo de revisión.
2. **Delegar al agente correcto.** Enrutar la tarea a `back`, `front` o `test` según qué parte
   del codebase toca.
3. **Respaldar toda tarea no trivial con un TDD.** Acá "TDD" significa *Technical Design
   Documentation* (documentación de diseño técnico) — no test-driven development. Registra por
   qué se tomó una decisión, no solo qué se implementó. Ver [docs/tdd/](../docs/tdd/).

## Gate de tarea (exigible)

Un agente (`back`, `front` o `test`) no puede empezar a implementar una tarea a menos que:

1. **Exista una tarea bajo `docs/tasks/`**, con alcance, exclusiones, restricciones, criterios de
   aceptación y validaciones. Una tarea ambigua se aclara antes de escribir código, no mientras se
   escribe.
2. **Las decisiones no triviales estén respaldadas por un TDD** bajo `docs/tdd/` — arquitectura,
   dependencia nueva, contrato o cambio a una decisión existente. Si todavía no existe, se escribe
   primero.

Restricciones operativas:

- No se descargan archivos ni se generan ejecutables que la tarea no requiera expresamente.
- Instalar dependencias forma parte de la tarea solo cuando el alcance lo autoriza.
- No se realizan cambios fuera del alcance ni se modifican zonas sensibles sin autorización.
- Antes de una acción destructiva o con efectos externos, el agente explica qué necesita hacer y
  espera la aprobación del desarrollador.
- Los cambios se integran mediante pull request; nunca directo a una rama protegida.
- Al finalizar, el agente registra el resultado en `CHANGELOG.md`, completa la evidencia de
  validación y mueve la tarea a `docs/tasks/finished/`.

Las tareas bien definidas dan mejores resultados que las ambiguas, y las decisiones que viven
solo en un historial de chat se pierden. Registrarlas como TDD mantiene el razonamiento
disponible para la próxima persona (o agente) que toque esa área.

## Estos perfiles vs. los sub-agentes de Claude Code

Los archivos de esta carpeta son perfiles agnósticos — documentación, pensada para usarse con
Claude, Codex o Gemini por igual. Además existen `.claude/agents/back.md`, `front.md` y
`test.md`: son las definiciones reales de sub-agente de Claude Code (frontmatter `name`,
`description`, `tools` + system prompt), atadas a esa herramienta puntual. No se versionan (están
en `.gitignore`, son personales) y cada una apunta al perfil correspondiente acá como fuente de
verdad, en vez de duplicar el rol/alcance — así no hay riesgo de que las dos formas queden
desincronizadas. Si en algún momento se arma el equivalente para Codex o Gemini, sigue el mismo
principio: wiring propio de la herramienta, contenido de fondo acá.
