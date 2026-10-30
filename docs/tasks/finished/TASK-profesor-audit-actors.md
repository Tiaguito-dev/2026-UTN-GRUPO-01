# Actores de auditoría de profesores

## Alcance

Corregir resolución autorizada de nombres de actores del detalle administrativo de profesores. Verificar que alta, edición y baja registren operaciones y actor real de sesión. Reconstruir y reiniciar el stack existente y verificar salud/contrato sin borrar datos.

## Restricciones y exclusiones

No modificar auth, componentes globales, permisos, relaciones, eventos históricos ni inventar actores. Sin migraciones, dependencias, pruebas visuales, commit ni eliminación de volúmenes. Conservar cambios UI previos.

## Decisión previa

El ledger transaccional de profesores ya registra actorId. AdminDetailService resuelve nombres únicamente para users: extender esa consulta agrupada exclusivamente a profesores usando displayName, sin correo ni datos privados. Referencias no resolubles y datos históricos ausentes siguen siendo null. Frontend ya acepta estos campos.

## Aceptación y validación

Nombres autorizados en creación, última modificación, baja e historial de profesores; registros sin actor o usuario resoluble sin atribuciones ficticias. Pruebas backend de lectura y escritura transaccional, typecheck/lint, regresión frontend de auditoría. Reinicio Docker autorizado explícitamente por el usuario: build/up del stack actual, healthchecks y comprobación HTTP sin navegador. Documentar evidencia y límites.

## Resultado

- Causa confirmada: creación/edición/baja ya registraban actorId; AdminDetailService resolvía displayName exclusivamente para users. Se extendió esa lectura a profesores, sin cambios de escritura ni frontend.
- TDD: baseline admin-detail 9/9; tres fallos RED por nombres ausentes antes de corregir. Resultado GREEN: 101/101 pruebas backend en admin-detail (16 casos), academic-administration.use-cases, academic-admin.use-cases y profesores-comision. Cobertura de consulta agrupada, nombres de creación/modificación/baja/eventos, ausencias, legado, paginación, actor de sesión en controllers ADMIN, alta/edición transaccionales, diferencias reales y propagación de fallo de ledger.
- Frontend: 17/17 regresiones de admin-profesor-presentation aprobadas. Typecheck y lint backend completos aprobados; nueva versión de tests comprobada adicionalmente con tsc tsconfig.test y ESLint focalizado. git diff --check sin errores.
- Imágenes frontend/backend reconstruidas correctamente. Stack `docker-compose.dev.yml --profile mail` recreado con imágenes actualizadas, sin borrar volúmenes. postgres, mailpit, backend, frontend y proxy saludables; migrate finaliza con código 0. No se agregaron migraciones.
- Smoke HTTP: `node scripts/check-admin-proxy.mjs http://localhost:8080`, 16/16 comprobaciones aprobadas (API 401 JSON sin sesión, páginas 200 HTML). Sin navegador ni pruebas visuales.
- Lectura de base local: 28 profesores existentes y ningún evento de profesor en AdministracionHistorial. Sus actores históricos no se pueden reconstruir ni atribuir ficticiamente.
- Verificación adicional real en el contenedor actualizado: usando un ADMIN existente, alta de profesor temporal, edición de nombre y baja ejecutadas mediante repositorios y AdminDetailService sobre una transacción PostgreSQL real. Se verificaron tres eventos CREACION/EDICION/ELIMINACION, actorId y nombres correctos en auditoría e historial. Se revirtió toda la transacción y se comprobó ausencia de profesor y eventos temporales; no se modificaron datos existentes. El origen de sesión y guards se verificaron con tests de controller; el smoke HTTP es sin sesión.
- Documentación actualizada en back/OVERVIEW.md, front/OVERVIEW.md y CHANGELOG.md. Sin commit: la última instrucción reserva su ejecución al usuario con agrupación aislada de auditoría uniforme documentada en TASK-system-audit-actors. Sin cambios de auth/permisos. La revisión visual sigue a cargo del desarrollador.
