# TASK-002: Refinar el tablero Trello del Gemelo Digital (2026-UTN-Cloud)

Estado: Finalizada
Fecha: 2026-09-27

## Objetivo

Refinar y auditar el tablero Trello `2026-UTN-Cloud` (Gemelo Digital) con el agente PO —
estructura de tarjetas (DoD/DoR), criterio de prioridad, mantenimiento de Historias de Usuario y
organización de listas — como paso previo a trasladar los cambios al tablero real del equipo
(`2026-UTN-Grupo-1`), que por permisos de workspace no se pudo tocar directamente.

## Contexto

El tablero real del equipo vive en un workspace de Trello ajeno (de Benjamín Briones) al que el
agente PO no tiene acceso vía API — solo puede leer y escribir en el tablero personal
`2026-UTN-Cloud`, usado como Gemelo Digital mientras tanto. La sincronización hacia el tablero
real queda pendiente, con dos caminos posibles:

1. Pedirle a Benjamín que sume a Tiago a su **workspace** de Trello (no solo al tablero), y
   correr ahí al agente PO para que traslade los cambios.
2. Migrar al equipo entero al Gemelo Digital, asumiendo el costo de migrar manualmente todas las
   tarjetas que ya existen en el tablero real.

## Alcance completado

- Definición del agente PO (`.claude/agents/po.md`, personal, no versionado): rol híbrido
  Product Owner + Scrum Master, estructura de tarjetas (DoD siempre, DoR condicional),
  refinamiento (detectar vs. ejecutar), mantenimiento de Historias de Usuario (template
  COMO/QUIERO/PARA + escenarios Gherkin + INVEST), auditoría del tablero, conciencia de
  documentos externos referenciados, criterio de prioridad (3 ejes) y flujo de listas / política
  de Sprint Backlog.
- Auditoría completa del tablero `2026-UTN-Cloud` (9 listas, ~20 tarjetas).
- Corrección de checklists DoD/DoR en las 6 Spikes.
- Fusión de Spike 6 en Spike 3 (contenido de IA) y de sus notas de infraestructura (Neon,
  Vercel, Amplify) en Spike 5; Spike 6 archivada.
- Conversión de las 9 Historias de Usuario originales a escenarios Gherkin, con checklist DoD y
  label de prioridad en cada una.
- División de HU-03 (rol "sistema" + 4 comportamientos empaquetados) en HU-03a/b/c/d, con
  HU-03d reemplazando a HU-07 (archivada, sin pérdida de contenido).
- División de HU-05 (rol ambiguo "administrador o sistema") en HU-05a/HU-05b, con ajuste de
  prioridad a URGENTE por la dependencia real con HU-06.
- Corrección del contenido de HU-06 contra el documento de backlog real (Google Doc): preguntas
  cerradas siempre presentes, campo de texto libre condicional a publicación identificada.
- Creación de la lista "Sprint Backlog" y de las tarjetas de referencia "CONVENCIONES DEL
  TABLERO" y "CONVENCIONES DE TARJETAS" (lista Info), visibles para todo el equipo.
- Archivado de la tarjeta vacía "HOLAA".

## Validaciones

- [x] Cada Spike y cada Historia de Usuario vigente tiene checklist DoD.
- [x] Los Spikes tienen su checklist DoR ("Tareas") con contenido específico, no genérico.
- [x] Las Historias de Usuario expresan sus criterios de aceptación como escenarios Gherkin.
- [x] Las etiquetas de prioridad se revisaron contra el criterio de 3 ejes documentado, y se
      corrigieron las inconsistencias encontradas (Spike 3/6, HU-05a/b vs HU-06).
- [x] El contenido de HU-06 se validó contra el documento de backlog real, no contra supuestos.

## Resultado

El tablero `2026-UTN-Cloud` (Gemelo Digital) quedó refinado, auditado y documentado — sirve de
referencia para replicar manualmente los cambios sobre el tablero real del equipo
(`2026-UTN-Grupo-1`) una vez resuelto el acceso al workspace, o para migrar el equipo al Gemelo
Digital si esa resulta la vía elegida. Pendiente explícito: nada de esto se sincronizó todavía al
tablero real.
