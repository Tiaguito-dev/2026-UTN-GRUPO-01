# Formularios de comisiones y retorno de altas administrativas

## Alcance y aceptación

- Carrera de comisión limitada a las carreras de la materia: asignación automática y contexto de lectura si hay una; elección si hay varias; bloqueo explicativo si no hay ninguna. Recalcular al cambiar materia y validar también en backend.
- Mantener límites y formato actuales de número, carrera y período, sin generar numeraciones.
- Altas de materias, profesores, períodos, comisiones y docentes regresan al listado o sección administrativa de origen después del éxito, con confirmación y datos actualizados.
- Preservar filtros; avisar si ocultan el registro y permitir limpiarlos explícitamente.
- Errores conservan campos y permiten reintentar. Guardar edición sin diferencias no realiza actualización.

## Decisiones y restricciones

- Usar los contratos y mecanismos existentes de navegación, servicios e invalidación; sin dependencias nuevas ni cambios de autenticación, router principal, estilos base o hooks compartidos.
- AltaForm es un componente del módulo administrativo: puede ajustarse dentro de este alcance.
- Preservar cambios previos presentes en el árbol de trabajo. No crear commits, push ni PR.
- Backend valida las carreras desde persistencia, incluso frente a peticiones manipuladas.

## Validación

- Tests de regresión primero para reglas de carrera, retornos por origen, filtros, error/reintento y ediciones sin cambios.
- Ejecutar pruebas pertinentes de frontend/backend, typecheck y lint; recorridos de navegador si el entorno disponible lo permite.
- Documentar resultados, limitaciones y contratos en OVERVIEW de front/back y CHANGELOG.

## Exclusiones

- Cambios de layout global, infraestructura o reglas de numeración; otros módulos ajenos a los flujos solicitados.

## Implementación y evidencia

- Alta y edición de comisión muestran carrera única como contexto, restringen selección múltiple y bloquean cuando falta asociar carreras. Cambiar materia descarta la selección previa. El período se identifica por año y cuatrimestre.
- POST admite carrera omitida únicamente cuando persistencia ofrece una sola. Rechaza carreras ajenas, requiere elección entre varias y explica corregir materia cuando no hay carreras; PATCH mantiene la misma validación y la revalidación transaccional existente.
- AltaForm resuelve el destino administrativo explícito o uno derivado de los valores enviados. Se revisaron páginas directas, listados administrativos en modal y enlaces de comisión desde materia/período. Edición de materia vuelve al detalle y conserva returnTo del listado.
- adminCreationHref preserva consulta y página y marca incompatibilidad de filtros. El listado ofrece limpieza explícita. Los modales recargan listas y las páginas confirman y refrescan después del éxito; HTTP usa no-store.
- Asignaciones docentes conservan selección ante error, bloquean envíos simultáneos, actualizan detalle/opciones/auditoría y no navegan. Cargo sin cambios no envía petición. Los formularios existentes de edición mantienen comparación de diferencias.

Validación automatizada aprobada:

- Backend: 148 tests pertinentes en carreras-comisiones, academic-admin.use-cases y hu11-edicion; typecheck y lint correctos.
- Frontend: regresiones de admin-comision-carreras (9), admin-creation-flows, admin-creation-list-refresh, admin-assignment-flows, comisiones-creation-origin (2) y admin-creation-filters (8), más las suites existentes de comisiones-materia, cursadas-nueva-modal, materias-filtros, admin-materia-form-page, admin-alta-form, hu11-admin-context, hu11-editar, admin-alta-precarga, admin-tables y comision-detalle. Todas aprobadas en corridas focalizadas con maxWorkers=1.
- Typecheck y lint del frontend correctos, incluyendo los tests nuevos. git diff --check sin errores.
- La corrida global inicial de frontend se interrumpió por saturación y timeouts de múltiples suites paralelas; se validó el alcance con corridas de un worker. No se afirma aprobación de la suite global completa.
- Integración PostgreSQL no ejecutada: TEST_DATABASE_URL ausente.
- Por instrucción explícita del usuario, no se ejecutó navegador ni pruebas visuales; quedan a su cargo.
- Sin commits, push ni cambios de dependencias, infraestructura o zonas sensibles.
