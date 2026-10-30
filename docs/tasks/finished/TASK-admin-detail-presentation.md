# Presentación compacta de detalles administrativos

## Alcance y decisiones
Primera aplicación en usuarios y reutilización del panel de auditoría administrativo.
Autorizado ajustar estos componentes compartidos de dominio y su CSS; se conservan shell,
breadcrumb, autenticación, endpoints, permisos y confirmaciones. Se usan los tokens actuales.
El contrato solo expone displayName: se presenta como nombre público, sin inventar un nombre legal.
Las fechas conservan la zona local del navegador, como el formato existente del proyecto.
El panel y su cargador deben ocultarse a cuentas sin rol ADMIN. El backend conserva sus guards.

## Aceptación
Datos semánticos compactos, valores completos, ausencias explícitas, estado textual,
acciones laterales en escritorio y debajo en móvil. Sin identificador interno visible en auditoría.
Auditoría agrupada y con fechas y horas diferenciadas. Historial nativo cerrado inicialmente,
contador real y paginación existente de tres eventos. Sin inferir estado desde una fecha de baja ausente.

## Validación
Actualizar regresiones de auditoría y acceso antes de implementar; ejecutar Vitest, lint,
typecheck y tests backend pertinentes. Verificar retorno con filtros y restricciones de rol.
Revisión móvil y teclado en navegador si el entorno permite levantar el flujo completo.
No se realizan commits ni cambios de contrato/backend.

## Resultado y evidencia
- Implementado en AdminRecordDetail, AdminAudit y CSS compartido de detalles administrativos.
- Typecheck y lint frontend: correctos.
- Suite frontend: 64 archivos, 560 pruebas correctas.
- Regresiones finales de auditoría y acceso: 2 archivos, 9 pruebas correctas.
- Backend (admin-detail, users-administration, users-admin, user-state): 4 archivos, 17 pruebas correctas.
- La prueba de navegador queda a cargo del desarrollador por indicación expresa.
  Revisar 390 px y escritorio, nombres/correos extensos, valores ausentes, teclado sobre summary,
  cancelación y confirmación de desactivación/reactivación, historial vacío/con eventos y retorno filtrado.
- Sin dependencias nuevas, cambios de autenticación o endpoints, ni commits.
