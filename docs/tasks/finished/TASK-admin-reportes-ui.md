# Presentación de reportes administrativos

## Alcance y plan

Rediseño visual localizado de Administración > Experiencias > Reportes. Bandeja compacta adaptable y detalle de dos columnas: evidencia histórica, situación actual e historial en principal; información, denunciante y resolución individual en secundaria. En móvil se conserva ese orden DOM. Inspección previa: Git limpio; tareas de Inicio, Experiencias y respuestas finalizadas, con límites de validación manual documentados. No hay HTML demostrativo en los archivos disponibles del repositorio.

## Exclusiones y restricciones

Sin backend, Prisma, endpoints, reglas, estados, permisos, navegación global, layout, autenticación, hooks compartidos, primitivas UI globales, dependencias, M1.3, IA, commits, push ni despliegues. Mantener consultas, filtros URL, orden, 9 reportes por página, 3 resoluciones por página, snapshot, permisos, justificación obligatoria, versión esperada, concurrencia y errores actuales. No hay archivos compartidos con otro agente de implementación; Testing modifica exclusivamente front/tests.

## Decisiones previas

- Reutilizar PageHeader, Badge, AdminSelect, AdminListResult, Pagination, Notice y diálogos/acciones actuales. Bandeja con lista semántica compacta para evitar una tabla ancha en móvil; sin duplicar servicios ni hooks. El contrato no contiene estadísticas globales: omitir indicadores y conservar total filtrado existente.
- CSS Module local a reportes dentro de capa components, con tokens existentes. Extensión visual opcional de acciones/status administrativos limitada al detalle de reporte para preservar otras pantallas. No se modifican primitivas globales.
- Identidad autorizada con icono decorativo y displayName; IDs secundarios con salto de palabra. No existe mecanismo de copiar identificadores reutilizable: conservarlos como texto secundario sin agregar una función nueva. Responsable administrativo por ID cuando el contrato lo provea; no inventar nombres.
- Historial mantiene eventos y orden recibido, con formato de lista cronológica, sin simular eventos de moderación ausentes del contrato.
- Estrategia TDD: ejecutar caracterización antes de editar; agente test prepara pruebas de estructura, estados, filtros y paginación, identidad, snapshot, historial, acciones, navegación y accesibilidad. Verificar CSS y teclado en navegador real con harness y servicios simulados si no hay sesión disponible; no afirmar E2E real.

## Criterios de aceptación

Jerarquía diferenciada; estados textuales con badges; estado de moderación separado de causas simultáneas de visibilidad; explicación preventiva; UUID/textos largos sin desbordar; dos columnas desde escritorio y una a 360/600 px; acciones válidas existentes con rechazo diferenciado y restitución identificable; modales, foco y validaciones conservados. Cierre de reporte no implica restitución. Evidencia histórica conserva texto y valoración. Historial compacto, vacío claro, responsable/fecha/justificación existentes.

## Validación prevista

Tests relevantes frontend y regresiones de Inicio, Experiencias, respuestas y detalle propio; typecheck, lint, build y git diff --check. Navegador a 360, 600 y escritorio, teclado, foco y axe cuando el entorno lo permita. Documentar resultados y límites, actualizar front/OVERVIEW.md y CHANGELOG.md. Sin tests backend porque no se modifica backend por restricción explícita de esta tarea.

## Implementación y evidencia (2026-11-18)

- Bandeja: lista semántica de filas compactas con materia, comisión/año/versión, motivo, fecha, badges, ocultamiento preventivo y número de denunciantes distintos abiertos. Accesos con nombre contextual para lector de pantalla; ninguna identidad en bandeja. Total filtrado provisto por AdminListResult, sin agregados globales.
- Detalle: dos columnas 1.8:1, apiladas hasta 800 px; snapshot con párrafos y contenido completo, metadatos agrupados; situación actual con estado textual independiente de cada causa de ocultamiento y explicación preventiva. Identidad autorizada con icono decorativo/displayName e ID secundario. Resolución individual abierta/cerrada separada y advertencia de que cerrar no vuelve a publicar. Historial compacto con eventos reales, justificación, fecha y administradorId existente, sin inventar nombres ni estados resultantes.
- Reutilizadas primitivas y acciones/modales actuales. Variantes opcionales de status y acciones solo se activan desde reporte; los otros usos conservan salida anterior. Sin modificaciones a consultas, servicios, hooks, tipos, validaciones, contratos, reglas, permisos ni backend.
- Revisión react-best-practices: sin efectos/peticiones ni estado duplicado nuevos; hooks incondicionales, componentes externos, claves por ID, controles nativos e iconos decorativos. Estilos locales en capa components con tokens; ninguna modificación global.
- Caracterización inicial T6: 20/20. Fase roja de presentación confirmó ausencia de la estructura solicitada. Primera corrida tras implementación: 36/38, dos expectativas nuevas usaban Datos personales en vez del label existente Información personal; se corrigieron los tests conservando el texto del sistema.
- Resultado final: 8 archivos, 179 pruebas aprobadas. Comando: `npm run test --workspace=front -- admin-reportes-presentation.spec.tsx admin-moderation-t6.spec.tsx inicio-ui.spec.tsx experiencias-list.spec.tsx feedback-respuestas.spec.tsx mis-experiencias-visibilidad.spec.tsx feedback-moderation-components.spec.tsx admin-experience-presentation.spec.tsx`. Incluye 20 casos nuevos, 20 T6 y 139 regresiones de Inicio, Experiencias, respuestas y detalles propio/administrativo.
- `npm run typecheck --workspace=front`, `npm run lint --workspace=front`, `npm run build --workspace=front`: exit 0.
- Chromium headless con React, componentes, hooks, validaciones, diálogos nativos y CSS reales en harness Vite local; solo navegación/Link y servicios sustituidos. Bandeja, detalle, textos/identidades largos, cerrado y vacío a 360/600/1280 px: 15 combinaciones sin desbordamiento ni incidencias axe serious/critical (incluye contraste). Se verificó geometría de columnas, foco visible, Enter, foco inicial del textarea, tabulación sin acceder a controles del fondo, Escape y devolución de foco. El recorrido simulado de restitución levanta solo ocultoReportes y conserva autor/administración. Capturas inspeccionadas de escritorio y bandeja móvil; script/capturas en `.tmp/reportes-ui/` (ignorado).
- Primer intento de axe requirió corregir la creación del contexto Playwright; la comprobación estricta de tabulación se ajustó al ciclo nativo que puede enfocar la interfaz del navegador (document.activeElement body). No se alteró Dialog. La corrida final completa terminó 0.
- No hay prueba E2E autenticada contra backend ni comprobación de persistencia real; los tests y el recorrido del harness usan servicios simulados. HTML aprobado no disponible. El contrato no incluye estadísticas globales ni nombres de administradores; se omiten las primeras y se muestran IDs secundarios de los responsables existentes.
- A pedido posterior del usuario se reconstruyó frontend local con `docker compose -f docker-compose.dev.yml up -d --build --no-deps --wait frontend`: build satisfactorio y frontend saludable. Base y backend conservados; sin migraciones, seeds ni reinicialización. Proxy reiniciado para resolver el contenedor actualizado.

## Cierre

Implementación y validación completadas dentro del alcance. `git diff --check` sin errores. Frontend, backend, PostgreSQL, proxy y Mailpit saludables al cierre. `/health`, `/login` y `/home/admin/experiencias` responden HTTP 200 por localhost:8080; esto confirma disponibilidad, no autenticación ni persistencia E2E. Stack actualizado y levantado para aceptación visual del usuario. Sin commits ni push. No se continúa con otras secciones ni IA.

Mensaje de commit sugerido: `style(admin): reorganizar la bandeja y el detalle de reportes`.

## Aprobación e integración posterior

El usuario aprobó el aspecto administrativo y autorizó expresamente el commit restante después
de integrar el merge de Comunidad en desarrollo. El trabajo visual se respaldó con stash,
se integró `origin/desarrollo` c418172 mediante merge f9f1f35 y se recuperó sin conflictos
adicionales. Los componentes de reportes conservan íntegra la implementación aprobada.
La evidencia de validación conjunta y del stack actualizado se registra en
`TASK-integrar-comunidad-reportes-ui`.
