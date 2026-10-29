# Administración del acceso de usuarios

## Alcance y autorización
Completar y verificar desactivación/reactivación desde listado y detalle administrativo. El pedido autoriza inspección y ajustes acotados de autenticación y sesiones. Preservar los cambios locales de auditoría existentes. Sin commits.

## Exclusiones
Sin borrado definitivo, roles, creación de cuentas ni recuperación de contraseñas.

## Decisiones
Reutilizar disabledAt y el contrato PATCH /users/:id/estado con { activo: boolean }. La transacción serializa operaciones de estado con advisory lock PostgreSQL y bloquea actor y cuenta; revalida ADMIN activo, impide autodesactivación y conserva un ADMIN activo. Desactivar revoca sesiones e invalida credenciales; reactivar no revierte revocaciones. Login bloquea User al crear sesión, evitando accesos nuevos que sobrevivan a una desactivación concurrente. Historial administrativo con actor, fecha y cambios de estado; solo campos seguros. Ninguna escritura sobre comentarios o identidad pública. Sin dependencias nuevas.

## Criterios de aceptación
Estado, filtro y acciones Lucide accesibles en listado y detalle. Confirmaciones identifican nombre y email. Refrescar estado, historial y resultados filtrados tras éxito. Errores visibles y reintentables. Historial de 3 eventos, listado de 9 cuentas. Backend rechaza cuenta inactiva, sesiones revocadas y solicitudes sin permisos. Concurrencia conserva administradores activos.

## Validación
Pruebas unitarias, interacción frontend e integración HTTP/PostgreSQL para login, sesiones, reactivación, permisos, carreras y preservación de anonimato. Ejecutar typecheck, lint y suites pertinentes. Registrar evidencia y límites al finalizar.

## Coherencia detectada durante validación
La creación de comentarios existente escribe entidad feedback en AdministracionHistorial, pero el CHECK de la migración anterior no la admitía, provocando 500 antes de verificar preservación. Se agrega migración 20261106000000_administracion_feedback_historial ampliando el CHECK sin reescribir migraciones aplicadas. Es una corrección acotada autorizada por la regla de coherencia frontend/backend. No se modifican comentarios históricos.

## Entorno local
El usuario pidió reconstruir y reiniciar el stack al terminar. Se utiliza docker-compose.dev.yml con perfil mail, conservando volúmenes. Las pruebas de base se realizan en bases vacías aisladas creadas específicamente bajo PostgreSQL local; no se usa la base de desarrollo como TEST_DATABASE_URL.

## Evidencia final
- Frontend: 57 archivos, 522/522 pruebas pasan (`npm run test --workspace=front -- --maxWorkers=1`).
- Backend: pasada completa serial sobre base vacía con 851 casos aprobados y 5 omitidos por condiciones de entorno; único fallo fue contaminación entre casos del archivo feedback.integration. Se corrigió retirando el comentario creado por el caso administrativo antes de probar el feed vacío y limpiando AdministracionHistorial de sus actores de fixtures. Repetición del archivo afectado: 16/16 pasan. Las 14 pruebas de admin-limits, incluidos permisos, revocación, reactivación, login pausado, refresh concurrente, administradores y anonimato, aprobaron en la pasada completa.
- Typecheck y lint de ambas aplicaciones: aprobados. Build frontend local y builds backend/frontend Docker: aprobados. git diff --check y sintaxis de los specs browser: aprobados.
- Navegador Chrome con HTTP interceptado: caso acceso de usuarios aprobado, confirmaciones/cancelación, filtro, detalle, reactivación e historial; axe sin violaciones serious/critical. El runner fue detenido después del resultado aprobado al quedar esperando cierre del servidor local; no se afirma una suite E2E completa.
- Las primeras ejecuciones paralelas saturaron el entorno y produjeron timeouts; las comprobaciones se repitieron con concurrencia limitada. La conexión TEST_DATABASE_URL anterior apuntaba a otro puerto/credenciales; se usaron bases aisladas nuevas derivando solamente el nombre de base de la conexión local de Compose.
- Stack reconstruido/recreado con `docker compose -f docker-compose.dev.yml --profile mail up -d --build --force-recreate`, preservando volúmenes. Migración 20261106000000 aplicada correctamente. Backend, frontend, postgres, mailpit y proxy saludables. GET /health, /health/ready y /home/admin/usuarios devuelven 200 en http://localhost:8080.
- No se realizaron commits, staging, push ni cambios de roles. Cambios locales previos preservados.

## Mensaje sugerido
feat(users): completar gestión administrativa del acceso
