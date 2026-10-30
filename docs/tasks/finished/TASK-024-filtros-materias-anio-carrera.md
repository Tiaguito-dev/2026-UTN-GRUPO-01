# TASK-024: Filtros de materias por año de carrera

Estado: Implementada, verificada y validada manualmente por el usuario el 2026-10-22.
Fecha: 2026-10-22.

Ampliación posterior: TASK-025 agrega búsqueda por nombre y nivel de electivas. Los resultados
de pruebas de esta tarea corresponden al contrato inicial; los casos actualizados y la evidencia
de la ampliación se documentan en TASK-025.

## Objetivo y aceptación

Estudiante autenticado: listado agrupado y ordenado por año (1 a 5), luego Electiva,
y nombre dentro de cada grupo; filtro por año persistente al regresar del detalle.
Administrador: exigir año de carrera 1 a 5 o Electiva al crear o editar materias.
Paginación del listado: 9 elementos; historial de cambios: 3 elementos.

## Alcance y restricciones

Modelo, migración, consulta filtrada y ordenada antes de paginar, alta y edición de
materias con validación, permisos ADMIN e historial de campos. Frontend limitado a
controles funcionales, agrupación, navegación y feedback. Sin rediseño, dependencias
nuevas, cambios a autenticación, layout, hooks compartidos ni componentes globales.
Trabajar en desarrollo por instrucción explícita, sin commit, push ni PR.
Conservar archivos locales ajenos a esta tarea.

## Decisiones de diseño

- Contrato `anioCarrera`: cadenas `1`, `2`, `3`, `4`, `5`, `ELECTIVA`.
  Persistencia nullable para materias heredadas, sin inventar clasificación; null se
  muestra al final como Sin año asignado. Nuevas altas y cambios de año exigen valor válido.
  Restricción SQL e índice para filtrado y orden. No confundir con año calendario de cursada.
- GET /materias admite anioCarrera y paginación; orden fijo año, nombre, id.
  GET /materias/:id entrega detalle. PATCH /materias/:id solo ADMIN, campos modificados.
  GET /materias/:id/historial paginado registra cambios con actor y fecha.
- URL del listado mantiene anioCarrera y page; vínculos al detalle conservan contexto
  para Volver y breadcrumb. Electivas se muestran después del quinto año.
- Formularios de materia propios cuando sea necesario, reutilizando estilos existentes;
  no alterar AltaForm compartido. Alta vuelve al listado con successMessage; edición al detalle.
- Backend, frontend y pruebas se delegan a sus perfiles conforme .agents/OVERVIEW.md.

## Trazabilidad de casos probados

Los casos siguientes cubren comportamientos de negocio y sus límites. Se reutilizaron las
suites existentes; las variantes de entradas inválidas se parametrizan en lugar de duplicar
pruebas. Los totales de ejecución incluyen pruebas anteriores del proyecto.

| ID | Criterio o regla | Caso y resultado esperado | Evidencia automatizada |
| --- | --- | --- | --- |
| MAT-01 | Escenario 1: orden inicial | Ordenar años 1 a 5, Electiva y heredadas al final; nombres ascendentes dentro del año, antes de cortar páginas. | [academic.integration.spec.ts](../../../back/tests/academic.integration.spec.ts), caso «filtra y ordena en PostgreSQL antes de paginar»; [materias-filtros.spec.tsx](../../../front/tests/materias-filtros.spec.tsx), caso «presenta grupos del primero al quinto». |
| MAT-02 | Escenario 2: filtro | Solicitar un año devuelve exclusivamente materias de ese año; total y páginas corresponden al filtro. Electiva es una opción válida. | [academic.integration.spec.ts](../../../back/tests/academic.integration.spec.ts), mismo caso de consulta real; [academic-service.spec.ts](../../../front/tests/academic-service.spec.ts), «envía el año seleccionado y limita pageSize a nueve». |
| MAT-03 | Escenario 2: conservación | Leer año y página desde URL, trasladarlos al detalle y recuperarlos con Volver y breadcrumb. | [materias-filtros.spec.tsx](../../../front/tests/materias-filtros.spec.tsx), «carga el filtro y la página desde URL»; [materia-detalle.spec.tsx](../../../front/tests/materia-detalle.spec.tsx), «Volver y breadcrumb recuperan año y página». |
| MAT-04 | Paginación y cambio de filtro | Máximo 9; pasar de página conserva año; elegir otro año o Todos reinicia la página. | [materias-filtros.spec.tsx](../../../front/tests/materias-filtros.spec.tsx), «pagina sin perder el año elegido» y «cambiar el año reinicia la página»; [materias-filtros.spec.ts](../../../back/tests/materias-filtros.spec.ts), límite de nueve. |
| MAT-05 | Escenario 3: alta | Aceptar `1` a `5` y `ELECTIVA`; rechazar omisión, null, vacío, fuera de rango y formatos no admitidos. Frontend bloquea envío y enfoca el año faltante. | [materias-filtros.spec.ts](../../../back/tests/materias-filtros.spec.ts), contrato parametrizado; [admin.integration.spec.ts](../../../back/tests/admin.integration.spec.ts), «alta exige año»; [materias-filtros.spec.tsx](../../../front/tests/materias-filtros.spec.tsx), «exige año antes de llamar al backend». |
| MAT-06 | Escenario 3: edición | Admitir cambio de año sin reenviar nombre; rechazar año inválido; una materia heredada debe clasificarse al editar. | [materias-filtros.spec.ts](../../../back/tests/materias-filtros.spec.ts), «edita solo el año», entradas inválidas y «exige clasificar una materia heredada»; [materias-filtros.spec.tsx](../../../front/tests/materias-filtros.spec.tsx), «no envía una edición sin cambios». |
| MAT-07 | Feedback y navegación | Alta regresa al listado con successMessage; edición al detalle conservando contexto; sin cambios muestra aviso y no llama al backend. | [materias-filtros.spec.tsx](../../../front/tests/materias-filtros.spec.tsx), «crea electiva y vuelve al listado» y «no envía una edición sin cambios». |
| MAT-08 | Permisos y protección | Sin sesión: 401; USER editando: 403; ADMIN sin CSRF: 403; lecturas disponibles a USER. Editar visible solo para ADMIN y materia activa. | [admin.integration.spec.ts](../../../back/tests/admin.integration.spec.ts), «solo ADMIN puede editar»; [materia-detalle.spec.tsx](../../../front/tests/materia-detalle.spec.tsx), visibilidad de Editar. |
| MAT-09 | Historial real | Cuatro cambios producen cuatro eventos con actor, fecha y valores anteriores/nuevos; repetir valor o PATCH vacío no agrega eventos. Páginas de 3; sin sesión, acceso denegado. | [admin.integration.spec.ts](../../../back/tests/admin.integration.spec.ts), «historial solo registra diferencias reales, con actor y páginas de tres». |
| MAT-10 | Prevención de errores | Filtro inválido o repetido devuelve 400; nombre duplicado no se actualiza; soft-deleted no aparece. | [academic.integration.spec.ts](../../../back/tests/academic.integration.spec.ts), consulta filtrada y soft delete; [materias-filtros.spec.ts](../../../back/tests/materias-filtros.spec.ts), filtro inválido y edición duplicada. |

## Resultados de validación

- Backend general sin base configurada: 336 pruebas aprobadas; 134 omitidas por requisitos
  de integración de otras suites. No se contabilizan esas omisiones como cobertura verificada.
- Integración académica y administrativa en PostgreSQL real aislado: 46 pruebas aprobadas.
  Los fixtures de estas suites sustituyen el envío de correo; no prueban SMTP.
- Frontend: 122 pruebas aprobadas. Tras el ajuste final del hook local `useMateria`, se
  repitieron los 8 casos de filtro/formulario y el chequeo completo de tipos, aprobados.
- `npm run typecheck --workspace=back` y `npm run typecheck --workspace=front`: aprobados.
- Builds de backend y frontend aprobados. `npm run lint --workspace=front`: sin errores;
  13 advertencias en código preexistente tras quitar la advertencia del nuevo hook local.
  ESLint del hook nuevo ejecutado por separado: sin advertencias.
- `git diff --check`: aprobado. Dependencias restauradas con `npm ci`, sin modificar lock.
- Runtime local Node 22.17.0, inferior al 22.22.3 fijado por el proyecto: las verificaciones
  anteriores pasaron, pero no se afirma haberlas ejecutado con la versión fijada.

Comandos para repetir la cobertura funcional necesaria:

```powershell
# TEST_DATABASE_URL debe apuntar exclusivamente a una base de pruebas migrada.
npm run test --workspace=back -- tests/materias-filtros.spec.ts tests/academic.integration.spec.ts tests/admin.integration.spec.ts
npm run test --workspace=front -- materias-filtros materia-detalle academic-service
npm run typecheck --workspace=back
npm run typecheck --workspace=front
```

## Validación en navegador y recorrido para el equipo

Ejecutado con Chrome real mediante Playwright, frontend compilado, backend real y PostgreSQL
aislado. La verificación final no utiliza endpoints del harness. No se modificó la base local
preexistente. URL: `http://localhost:3300`; API: `http://localhost:3301`.

| Caso manual | Pasos | Resultado comprobado |
| --- | --- | --- |
| Navegación del estudiante | Iniciar sesión, abrir Materias, elegir segundo año, abrir detalle y pulsar Volver. | Año conservado; sin enlace Editar. |
| Agrupación y páginas | Abrir Todos; seleccionar segundo año y avanzar a página 2. | Grupos por año, máximo nueve elementos y tres restantes en la segunda página del conjunto de doce. |
| Regreso desde detalle | Abrir materia desde segundo año, página 2; pulsar Volver. | URL y selector conservan año 2 y página 2. |
| Edición administrativa | Guardar sin cambios; luego cambiar año a Electiva y guardar. | Cero PATCH sin diferencias, un PATCH con el año cambiado, mensaje de éxito y evento en historial. |
| Alta y validación | Completar nombre, enviar sin año; elegir Electiva y reenviar. | Error visible y sin alta inicial; luego regresa al listado con mensaje de éxito. |
| Disponibilidad | Consultar login y health/ready; observar consola durante el recorrido. | Ambos HTTP 200; sin errores JavaScript. |

Se dejan frontend, backend y contenedor PostgreSQL `utn-materias-task024` levantados por pedido
del usuario. Las cuentas de prueba se entregan en la conversación; los scripts y logs locales
de arranque y smoke están bajo `.tmp/`, ignorado por Git. Registro y recuperación por correo
no forman parte de este recorrido y no se levantó SMTP. La aprobación visual/manual del equipo
queda a cargo del usuario; no se hizo refinamiento general de UI.
