# TASK-070: Resolver límites de administración

## Alcance y autorización

El usuario pide implementar las soluciones a las limitaciones de TASK-069: filtros/paginación remotos, estado y activación de cuentas, eliminación académica y validación con PostgreSQL real. Incluye frontend/backend, migración aditiva y ajuste mínimo de autenticación necesario para rechazar cuentas desactivadas. Se mantienen las autorizaciones de reiniciar/reconstruir servicios después de cada bloque. No hacer commit, no ejecutar pruebas visuales ni analizar imágenes. Preservar cambios previos.

## Decisiones previas a implementar

- Todos los listados administrativos consultan páginas remotas de nueve elementos. Profesores admite `q`; Usuarios `q`, `rol` y `estado=ACTIVO|INACTIVO`. Se valida la búsqueda hasta 150 caracteres; coincidencias literales, insensibles a mayúsculas/tildes. Comisiones ya admite carrera y selección de período por cursada; Cursadas conserva filtro de materia. Conteo y página comparten snapshot y orden determinista.
- Los selectores de contexto cargan opciones por páginas bajo demanda; materias admite búsqueda remota y la selección actual se recupera por ID aunque esté fuera de la página de opciones. No se usa el cargador completo para operar las tablas ni sus filtros.
- User incorpora `disabledAt` nullable. `GET /users` devuelve `disabledAt` explícito; `PATCH /users/:id/estado` recibe exclusivamente `{activo:boolean}` y exige ADMIN. Se rechaza la autodesactivación y desactivar al último administrador activo. La baja revoca sesiones y refresh vigentes atómicamente; login, refresh y acceso no admiten cuentas desactivadas. Reactivar no recupera sesiones anteriores. Sin crear cuentas ni cambiar roles.
- DELETE de materias, profesores, cursadas y comisiones es baja lógica (`deletedAt`), protegida por ADMIN. Evitar cascadas: materia con cursadas vigentes, cursada con comisiones vigentes y profesor con asignaciones vigentes responden 409. Una comisión se puede dar de baja conservando comentarios y snapshots. Operaciones con concurrencia deben mantener esas reglas. No ejecutar bajas sobre datos reales durante validación.
- Auditoría aditiva `AdministracionHistorial`: id UUID, entidad (materia/profesor/cursada/comision/usuario), entidadId UUID, actorId UUID, accion, cambios JSON (lista de `{campo,anterior,nuevo}`), createdAt. Actor referenciado a User e índice por entidad/id/fecha/id. Materia conserva su historial existente; estados/bajas y ediciones restantes registran cambios reales. Sin credenciales ni datos secretos en historial.
- Endpoints ADMIN de historial por entidad: `/profesores/:id/historial`, `/cursadas/:id/historial`, `/comisiones/:id/historial`, `/users/:id/historial`; páginas de tres. Materias mantiene `/materias/:id/historial`. Pantallas de detalle consumen historia; Usuarios la presenta en un diálogo desde la tabla.
- Acciones reales Trash2 y UserX/UserCheck con confirmación, prevención de dobles envíos, mensajes visibles, tooltip por foco y nombre accesible. Reutilizar Dialog y estilos del módulo sin modificar primitivas globales. Historial en detalle con tres elementos por página. Experiencias permanece en tarjetas.

## Criterios de aceptación

- Sin carga completa ni límite 2000 para resultados tabulares. Filtros antes de LIMIT/OFFSET y total correcto, URL y retorno preservados.
- Permisos, validación, auditoría, baja lógica y bloqueo inmediato de acceso de cuentas inactivas comprobados; no autodesactivación ni pérdida del último ADMIN.
- Eliminación confirmada en UI; 409 relacional conserva datos y comunica acción correctiva. Historial muestra eventos reales.
- Migración aditiva compatible con Docker; nada de reset, borrado de volumen o cambios destructivos en datos existentes.
- Pruebas unitarias y de integración contra PostgreSQL efímero exclusivo. HTTP funcional sin capturas cuando sea necesario. Verificación visual a cargo del usuario.
- Documentación front/back y CHANGELOG, mensajes de commit sugeridos sin ejecutar commits. Builds y reinicio de servicios con healthchecks.

## Plan de trabajo por perfiles

1. back: filtros académicos, bajas y auditoría académica.
2. front: consumo remoto, acciones, estados e historial; pruebas de interacción correspondientes.
3. test: pruebas backend y preparación de validación PostgreSQL aislada.
4. Coordinación: schema/migración, administración de cuentas y seguridad de acceso, integración, documentación, reconstrucción y healthchecks.

## Resultado y evidencia

- Implementados filtros/páginas remotos en resultados y selectores administrativos, sin límite de 2000. Materias conserva su contrato de búsqueda. La URL mantiene filtros y página; ediciones vuelven al detalle con éxito y retorno contextual.
- Usuarios incorpora estado, confirmación y auditoría de activación/reactivación; se revocan sesiones y credenciales pendientes. Se conservó el JSON público de autenticación y se ajustó únicamente la validación de acceso necesaria para cuentas inactivas.
- Bajas académicas lógicas con bloqueos relacionales, auditoría, concurrencia y reutilización de claves sin modificar identidad histórica. Experiencias conserva tarjetas y contenido histórico.
- TDD: pruebas nuevas de usuarios y administración académica fallaron antes de implementación; las expectativas de navegación de los tres editores también fallaron antes de corregirlas. Regresiones actualizadas con comentarios de cambio intencional.
- Frontend: 54 archivos, 513 pruebas aprobadas en la suite completa con dos workers. Typecheck y lint finales aprobados.
- Backend: 36 archivos, 843 pruebas ejecutadas sin omisiones en PostgreSQL/Mailpit exclusivos. La ejecución completa aprobó 841 y tuvo dos timeouts bajo carga de builds; al repetir el archivo de contraseñas con un worker y timeout de 20 segundos aprobaron sus 24 pruebas, cubriendo los dos casos pendientes sin modificar asserts. Tipos y lint aprobados.
- Integración nueva: 11 flujos HTTP con permisos, filtros literales/tildes, 2005 profesores, estados, revocación, auditoría/no-op, bajas, conservación de comentarios, reutilización de claves y carreras concurrentes. Pruebas usan TEST_DATABASE_URL explícita; no escriben sobre datos de desarrollo.
- Navegador funcional: `npx playwright test admin-limits.browser.spec.mjs --config=playwright.config.ts --reporter=line`: 2/2 aprobadas contra NestJS real y PostgreSQL temporal. Cubren estado/historial, filtrado/paginación, edición/retorno, baja persistida y error409. Sin capturas ni análisis de imágenes.
- Builds backend/frontend locales y Docker aprobados. Migración 20261105000000 aplicada exitosamente al stack local, confirmada por consulta de solo lectura a _prisma_migrations. Frontend/backend/proxy recreados; PostgreSQL y Mailpit de desarrollo conservados.
- Cinco servicios healthy. `/proxy-health`, `/health`, `/health/ready`, `/home/admin/usuarios` y `/home/admin/materias` devolvieron 200 en localhost:8080. No se ejecutaron bajas ni cambios de estado sobre cuentas/datos habituales.
- Documentados contratos, seguridad, operaciones, migración y validación en front/OVERVIEW.md, back/OVERVIEW.md y CHANGELOG. Sin commits; la aceptación visual queda a cargo del usuario.

## Verificación manual en navegador

1. Entrar como ADMIN en http://localhost:8080/home/admin.
2. Materias/Profesores: buscar, cambiar filtros, avanzar página y recargar. Total y página se conservan en URL; Limpiar filtros reinicia página. Abrir Eye, editar con Pencil y guardar: vuelve al detalle con aviso de éxito y Volver conserva el origen.
3. Cursadas/Comisiones: elegir Materia en diálogo con búsqueda y páginas; elegir Período por páginas en Comisiones y filtrar Carrera. Una selección por URL fuera de la primera página mantiene su nombre.
4. Usuarios: buscar nombre/email y combinar rol/estado. Usar cuenta secundaria para confirmar desactivación; pasa a Inactivo y su acceso se rechaza. Reactivar exige iniciar sesión nuevamente. La cuenta propia no ofrece desactivación. History abre eventos paginados de tres.
5. Baja: usar registro de prueba. Trash2 abre confirmación; Cancelar no modifica nada. Confirmar oculta la fila y muestra éxito. Una materia con cursadas o docente vinculado responde409 en el diálogo, conserva los datos e indica resolver las relaciones primero. Los comentarios de entidades dadas de baja permanecen en Experiencias.

## Mensajes de commit sugeridos (no ejecutados)

- `feat(users): gestionar estados y acceso con auditoría`
- `feat(academic): agregar filtros remotos y bajas lógicas auditadas`
- `feat(admin): conectar estados, bajas e historial en tablas remotas`
