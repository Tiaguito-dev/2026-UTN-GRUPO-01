# HU-C04 — Administrar normas de convivencia

## Alcance y base
Continuar exclusivamente en `feat/modulo-comunidad`, worktree `.tmp/modulo-comunidad`, base HU-C01 `7c7e3b4`. Estado local/remoto verificado idéntico y limpio. Reutilizar comunidad sin duplicar módulos; no alterar commits/migración anteriores ni cambios del workspace original. Push autorizado al cerrar; sin PR, merge ni siguiente historia. Aplicar skill commit-work.

Se autorizan los cambios de modelo/módulo, rutas y componentes locales de Comunidad requeridos por HU-C04. Conservar autenticación, layouts, estilos base y tema HU-C06. Sin nuevas dependencias ni hooks globales. Excluye sugerencias/likes/feed/términos y registros históricos de aceptación.

## Análisis y decisiones previas
- HU-C01: singleton NormasConvivencia `vigentes`, array ordenado, createdAt/updatedAt, GET autenticado mediante puerto/repositorio Prisma. Nginx dev/TLS ya reenvía el location exacto sin limitar el método.
- Nueva columna nullable `actualizadoPorId` UUID con relación a User y onDelete Restrict, sin backfill ni seed. Nullable identifica correctamente documentos aún no editados. Nueva migración aditiva conserva contenido, fechas y la migración anterior. Reusar @updatedAt; createdAt no entra en el update.
- Mantener el GET y su DTO público existentes, sin exponer el UUID del administrador a estudiantes. El responsable se registra en persistencia; la respuesta PUT conserva el documento público. La trazabilidad se comprueba en PostgreSQL.
- PUT `/comunidad/normas`, AuthenticationGuard + RolesGuard + @Roles ADMIN. Caso `ActualizarNormas.execute(body,actorId)` valida objeto estricto `{titulo,introduccion,normas,cierre}`: texto trim no vacío, título <=160 (modelo), lista >=1 y cada norma no vacía. Rechaza propiedades desconocidas (actor/fechas/id). Actor obligatorio desde sesión, nunca del body. Mantener saltos internos y texto plano. Errores de dominio 400/404 y manejo global para inesperados.
- Puerto `actualizarVigentes(input,actorId)` y una única sentencia de actualización del documento+actor+fecha (sin read-then-write y sin upsert que invente documentos). Actualizaciones simultáneas completas siguen semántica de último guardado, sin mezclar campos; no introducir versionado ajeno a la HU.
- Botón/enlace “Administrar normas de convivencia” solo ADMIN en Comunidad. Ruta `/home/admin/comunidad/editar` bajo guard existente. Página carga contenido real; formulario local controlado con título/introducción/cierre, filas con IDs estables, agregar/eliminar y subir/bajar mediante botones de texto accesibles. No drag-only, rich text ni deps.
- Validaciones frontend equivalentes, foco al primer error, mensajes claros; bloquear envío duplicado con ref además de disabled, mantener borrador ante fallo; deshabilitar edición mientras guarda para no perder cambios posteriores. Tras éxito volver a `/home/admin/comunidad?actualizada=1`, aviso de éxito y consulta fresca. Cancelar sin cambios regresa directamente, con cambios requiere confirmación.
- Protección local de cambios sin guardar: diálogo existente para Cancelar y enlaces que abandonen la pantalla (incluye navegación compartida mediante captura local de clicks), beforeunload nativo para recarga/cierre y manejo local de Atrás mediante entrada de historial del mismo URL. No parchear router ni hooks compartidos. Debe permitir continuar editando o confirmar salida, conservar borrador al cancelar y limpiar listeners al desmontar; expiración de sesión conserva prioridad de seguridad. Documentar ajustes si el navegador exige otra implementación.
- CSS Module local y primitivas existentes; USER conserva la apariencia de HU-C01 y solo ve el nuevo contenido guardado. Nginx debe permitir PUT; comprobar autenticación/CSRF por proxy real aislado, sintaxis dev/TLS y sin modificar el proxy local activo.

## Criterios y TDD
CA01–12 de la HU: acceso ADMIN/USER, precarga, actualización/campos/lista/orden, lectura USER nueva, cancelación/confirmación de abandono, validación, error/reintento, seguridad y trazabilidad, responsive/regresión.

Agentes front/back/test según OVERVIEW. Test primero y RED antes de producción. Cubrir migración conservadora, usecase/validación, HTTP con PostgreSQL real, sesión401/USER403/ADMIN200 y spoofing/CSRF; frontend formulario/cancelación/borrador/reorden/envío duplicado y guard de abandono; navegador 375/1280, axe, capturas ADMIN formulario + USER actualizado, proxy y regresiones HU-C01/06. Node22.22.3, suites completas y tipos/lint/build ambos, DB/Mailpit/proxy temporales. No afirmar pruebas no ejecutadas.

## Commits previstos
1. Modelo+ nueva migración de responsable con prueba conservadora.
2. Actualización backend con permisos, validaciones y regresiones.
3. Acceso/formulario/frontend con regresiones y capturas pertinentes.
4. CHANGELOG/evidencia/cierre. Ajustar límites a cambios lógicos reales; revisar staged diff antes de cada commit.

## Evidencia
Pendiente de ejecución.
