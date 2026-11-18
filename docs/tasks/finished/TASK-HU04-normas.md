# HU-04 — Normas de convivencia
Publicar por primera vez requiere consentimiento explícito a la versión vigente. Consultar las reglas conserva el borrador. Bloquear solicitudes directas sin conformidad. Guardar usuario, fecha y versión en la misma transacción que la publicación válida. Una aceptación previa solo sirve para su versión. No cambiar edición, autenticación ni moderación. Validar los seis escenarios con pruebas de backend y frontend. Contrato: GET /feedback/normas devuelve {version, aceptada, reglas: string[]}; POST de creación admite versionNormas opcional. La API es la fuente de texto y versión.

## Decisiones
- Versión inicial `1`. Cambiarla cuando una revisión de las reglas requiera otra aceptación. El documento servido por la API es la fuente de texto y versión.
- Clave compuesta usuario/versión con fecha generada por PostgreSQL y relación al usuario. Las cuentas existentes empiezan sin aceptación. La creación concurrente es idempotente y conserva la primera fecha.
- La validación y el registro se realizan dentro de la transacción de publicación. Una publicación inválida no registra conformidad.
- Consulta mediante diálogo accesible en el editor. La nueva versión reinicia la casilla y conserva el borrador. La edición de reseñas sigue su contrato existente.

## Criterios de aceptación y validación
- Primera publicación muestra casilla desmarcada y documento completo accesible sin perder el texto.
- Sin aceptación la interfaz y la API impiden publicar y explican la acción requerida.
- Una publicación válida registra usuario, fecha y versión. Otra publicación no repite la aceptación vigente.
- Una versión anterior requiere aceptación de la vigente, incluso si el documento cambia con el editor abierto.
- Las reglas prohíben insultos, acoso, amenazas y divulgación de datos personales no autorizada. Informan responsabilidad del autor y posibilidad de reporte y moderación.
- Verificar migración, tipos y lint de ambos workspaces, suites de reseñas y regresión frontend, y builds.

## Evidencia
- Node 22.22.3 en contenedor aislado con PostgreSQL 17.
- Migración aplicada desde una base vacía. Tipos y lint aprobados para ambos workspaces.
- Backend: 56 pruebas aprobadas en feedback.integration, feedback-input y admin-limits.integration, incluidas solicitudes directas, versión obsoleta y persistencia de la conformidad.
- Frontend: 74 archivos, 755 pruebas aprobadas, incluidas consulta sin perder borrador y cambio de versión durante la escritura.
- Builds de NestJS y Next.js/Turbopack aprobados.
- Las pruebas de interfaz se ejecutaron con Testing Library/jsdom. Revisión visual manual en navegador pendiente.
