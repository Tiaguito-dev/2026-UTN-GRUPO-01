# Eliminación de experiencias por autor o administrador

## Alcance y aceptación

Permitir al ADMIN eliminar comentarios de cualquier autor desde su detalle administrativo;
conservar la eliminación del autor desde Tu comentario. Confirmación accesible, acción secundaria
roja con Trash2, errores y éxito visibles, sin operaciones de restauración o borrado definitivo.
No ampliar lectura/edición/historial privados ni modificar autoría o snapshots. Sin commit
automático ni recorridos de navegador, reservados al desarrollador.

## Decisiones previas

- Reutilizar DELETE /feedback/:id, sesión y CSRF existentes. El rol viaja exclusivamente desde
  la identidad autenticada del servidor, nunca desde payloads o parámetros del cliente.
- Extender solo la política de eliminación a autor o ADMIN. La edición y el historial privado
  siguen siendo exclusivos del autor. No tocar autenticación ni guards compartidos.
- Mantener soft delete y transacción con bloqueo de comisión. Revalidar existencia y autorización
  tras adquirir el bloqueo para impedir eventos duplicados frente a eliminaciones concurrentes.
- Registrar el actor real en AdministracionHistorial y el snapshot en FeedbackHistorial. Eliminar
  incluso con comisión inactiva, conservando datos, relaciones y versiones anteriores.
- El administrador permanece en detalle con estado Eliminado y auditoría actualizada; el autor
  conserva su retorno contextual y mensaje de éxito existentes. Cancelar no llama al servidor.
- Reutilizar AdminConfirmDialog para la nueva acción administrativa, sin variantes globales.

## Validación

Pruebas HTTP con PostgreSQL aislado para autor, ADMIN ajeno y propio, tercero, sin sesión, CSRF,
doble eliminación, comisión inactiva, auditoría y retiro del feed. Tests de UI para confirmación,
cancelación, permisos, errores/reintento, éxito y contexto, manteniendo los del autor. Tipos,
lint, builds Docker y suites pertinentes. Documentar contratos en ambos OVERVIEW y CHANGELOG.

## Implementación

- Backend: `feedback-policy.ts`, `feedback.service.ts`, puerto `feedback.repository.ts`,
  `prisma-feedback.repository.ts` y `reviews.controller.ts`. El rol proviene de authUser, con
  valor por defecto USER en servicio/repositorio para no conceder moderación implícitamente.
  DELETE no cambia contratos de respuesta, esquema ni migraciones.
- Frontend: `AdminExperienceDeleteAction.tsx` y `AdminRecordDetail.tsx` incorporan confirmación
  administrativa, errores/reintento, estado/auditoría actualizados y conservación del retorno.
  El autor ya disponía del flujo correcto en FeedbackDetail, conservado y cubierto por regresión.
- Pruebas: nuevos `feedback-removal-policy.spec.ts` y `admin-experience-removal.spec.tsx`,
  integración HTTP extendida en `feedback.integration.spec.ts` y expectativa de acción actualizada
  intencionalmente en `admin-experience-presentation.spec.tsx`.
- Documentación de contratos en `back/OVERVIEW.md`, `front/OVERVIEW.md` y `CHANGELOG.md`.

## Evidencia inicial

- Focalizadas frontend: 47 aprobadas, incluyendo autor, presentación y eliminación administrativa.
- Política/servicio backend: 4 aprobadas. PostgreSQL exclusivo temporal con las 17 migraciones
  existentes aplicadas, separado de los datos de desarrollo.
- Builds Docker backend y frontend aprobados; sin nuevas dependencias ni esquema de datos.
- La primera suite backend encontró dos timeouts de 5 segundos en pruebas de contraseñas durante
  los builds concurrentes. Se repite sin esa contención, sin cambiar timeouts ni código de auth.
- Navegador y pruebas visuales reservados al desarrollador. Sin commit ni staging.

## Validaciones completadas

- Frontend completo: 74 archivos, 727 pruebas aprobadas con `--maxWorkers=2`.
- Typecheck de aplicación y tests de ambos workspaces aprobado; ESLint de ambos aprobado,
  incluyendo pasada final sobre los archivos de tests agregados/actualizados.
- Backend y frontend reconstruidos y recreados en Compose; ambos saludables. Las 16
  comprobaciones HTTP del proxy, páginas y protección de endpoints aprobaron.
