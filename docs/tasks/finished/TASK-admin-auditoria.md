# Detalle administrativo y auditoría

Alcance: materias, profesores, usuarios, comentarios, comisiones y períodos existentes. Accesos Eye dentro del contexto administrativo, retorno a Experiencias preservando URL, auditoría compartida y protección backend ADMIN.

Exclusiones: secretos, reconstrucción de eventos históricos, cambios de autenticación y layout global, commits.

Decisiones: reutilizar los historiales existentes y transacciones Prisma; metadatos ausentes se muestran como no disponibles. Nuevas rutas de detalle bajo el segmento administrativo existente. Componente de auditoría del módulo admin compartido por todas las entidades. La fecha updatedAt no constituye un historial. Delegación por perfiles back/front/test conforme .agents/OVERVIEW.md.

Aceptación: datos actuales separados de auditoría, identificador y actores disponibles, permisos backend/UI, eventos futuros consistentes con mutación; retorno conserva filtros/página. Sin hashes/tokens/contraseñas.

Validación: tests backend de autorización y auditoría; tests frontend de enlaces y presentación; typecheck y lint. Documentar limitaciones de pruebas manuales.

## Implementacion y contrato

GET /admin/:kind/:id/detalle?page=1&pageSize=3 admite materias, profesores, cursadas, comisiones, users y feedback. Exige ADMIN y devuelve registro seguro, auditoria e historial paginado. Reutiliza MateriaHistorial, FeedbackHistorial y AdministracionHistorial bajo RepeatableRead; altas y relaciones nuevas escriben actor en el ledger dentro de la transaccion de mutacion. Comentarios futuros comparten identificador de snapshot y evento para correlacionar actor sin inferencias. Sin migraciones ni eventos retroactivos.

Frontend: AdminAudit presenta metadatos e historial; AdminRecordDetail agrega detalles de usuarios/comentarios. ReturnTo valida destinos internos y conserva el listado de Experiencias. Los detalles academicos administrativos permiten consultar bajas.

## Validacion

Typecheck y lint de ambas aplicaciones: correctos. Build de produccion frontend: correcto, incluidas nuevas rutas. No hay TEST_DATABASE_URL configurada: integracion PostgreSQL y recorrido manual autenticado completo no ejecutados. No se realizaron commits.

Pruebas backend: suite completa 652 aprobadas y 199 omitidas; pruebas focalizadas finales del detalle 8/8, incluyendo actor legado ausente y baja con cambios del ledger. Los campos sin cambios no generan diferencias en auditoria de comentarios.

Pruebas frontend finales: 56 archivos y 517 tests aprobados con --maxWorkers=2. Typecheck final de ambas aplicaciones aprobado incluyendo los tests nuevos. Cobertura nueva: acceso Eye ADMIN y retorno a Experiencias, presentacion de actores ausentes y diferencias reales, proteccion del controller, seleccion segura de usuarios, filtrado de secretos, paginacion SQL de materia y propagacion del fallo de auditoria desde la transaccion. El rollback real queda sujeto a ejecutar integracion PostgreSQL con TEST_DATABASE_URL explicita.
