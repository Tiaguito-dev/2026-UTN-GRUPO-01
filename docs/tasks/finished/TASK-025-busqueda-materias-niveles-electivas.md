# TASK-025: Búsqueda de materias y niveles de electivas

Estado: Implementada, verificada y validada manualmente por el usuario el 2026-10-22.
Fecha: 2026-10-22.

## Objetivo y aceptación

- Buscar materias por nombre combinando texto con el filtro actual por año o Electivas.
- Al elegir Electivas se habilita un selector de Todos los niveles, 3.er Nivel,
  4.º Nivel y 5.º Nivel. Al cambiar a otro año se elimina el nivel del filtro.
- Aplicar texto y nivel antes de paginar, máximo 9 materias. Conservar todos los criterios
  y página al navegar al detalle, editar, cursadas y volver.
- Alta y edición de electivas exigen un nivel válido 3, 4 o 5; las materias obligatorias
  no guardan nivel de electiva. Mostrar el nivel en listado/detalle y registrar cambios.

## Alcance, exclusiones y restricciones

Extender TASK-024 sin descartar cambios locales ni realizar commits/push. Modificar solo el
módulo académico, sus vistas, pruebas y documentación. Mantener UI funcional mínima, sin
rediseño global ni cambios a auth, layout, hooks compartidos o componentes globales.
Sin nuevas dependencias. Dejar proyecto levantado para validación manual como ya se solicitó.

## Decisiones técnicas

- Mantener `anioCarrera` (`1` a `5` o `ELECTIVA`) compatible con TASK-024 y agregar
  `nivelElectiva`: `3`, `4`, `5` o null. El nivel es el año real de la electiva y no
  el año calendario de cursada. Se evita una conversión incompatible del contrato existente.
- Columna nullable para electivas heredadas cuyo año no se conoce. No inventar niveles.
  Las altas y ediciones de electivas exigen nivel (también al editar heredadas);
  al pasar a materia obligatoria se limpia nivel en backend y se audita.
- GET /materias admite `q` (texto recortado, máximo 150, sin controles; vacío equivale
  a sin búsqueda) y `nivelElectiva` válido únicamente junto con `anioCarrera=ELECTIVA`.
  Búsqueda parcial sin distinguir mayúsculas/minúsculas; caracteres `%` y `_` literales.
  Filtrado en PostgreSQL y mismo criterio para items y total; nunca filtrar solo la página.
- URL conserva `q`, `anioCarrera`, `nivelElectiva` y página. Buscador con envío explícito
  y opción de limpiar; cambiar búsqueda/año/nivel reinicia página.
- Historial incluye cambios de nivel y admite nuevo=null al limpiar el nivel.
  Migración aditiva con restricciones de consistencia e índice para nivel.

## Contratos y reglas finales

Ejemplo de consulta: `GET /materias?q=Plan&anioCarrera=ELECTIVA&nivelElectiva=4&page=2`.
Respuesta paginada `{items,total,page,pageSize}`; cada materia incluye `nivelElectiva`.
Orden: clasificación, nivel, nombre e id; null al final de su grupo.
La búsqueda ignora mayúsculas, pero no elimina tildes.

Alta electiva: `{nombre,anioCarrera:"ELECTIVA",nivelElectiva:"4"}`. Edición:
`PATCH /materias/:id` acepta diferencias de nombre, clasificación o nivel. Si se omite el
nivel conserva el actual, siempre que siga siendo válido. Electivas heredadas sin nivel
deben completarlo al editar. Para obligatorias, un nivel válido recibido se normaliza a
null; un valor fuera de catálogo siempre devuelve 400. La restricción SQL también impide
guardar un nivel conocido en una materia obligatoria.

Lecturas requieren sesión; escrituras ADMIN y protección Origin/CSRF. Las reglas se
revalidan después de bloquear la fila, y cambios e historial se guardan atómicamente.

## Matriz de trazabilidad de casos probados

Se agregaron 11 casos netos (8 backend y 3 frontend) y se ampliaron casos existentes de
TASK-024. No se añadieron suites para comprobar cada detalle de implementación.

| ID | Comportamiento | Resultado esperado | Evidencia |
| --- | --- | --- | --- |
| BUS-01 | Buscar y combinar filtros sobre todo el catálogo | Texto con espacios y diferencias de mayúsculas encuentra una subcadena; `%` y `_` son literales. Solo se incluyen electivas del nivel pedido. Doce coincidencias producen páginas de 9 y 3; no entran otros niveles ni eliminadas. | [academic.integration.spec.ts](../../../back/tests/academic.integration.spec.ts), «combina búsqueda literal sin distinguir mayúsculas, año y nivel antes de paginar». |
| BUS-02 | Validar consulta antes de acceder a datos | Recorta búsqueda; rechaza más de 150 caracteres, controles y nivel aplicado a un año obligatorio. | [materias-filtros.spec.ts](../../../back/tests/materias-filtros.spec.ts), «recorta búsqueda y combina filtros» y «rechaza consulta inválida antes del repositorio»; integración BUS-01 verifica HTTP 400. |
| BUS-03 | Asignar nivel a electivas | Acepta 3, 4 y 5; rechaza nivel faltante, fuera de rango o numérico. Electiva heredada exige completar nivel. Al pasar a obligatoria limpia nivel y registra anterior/nuevo null. | [materias-filtros.spec.ts](../../../back/tests/materias-filtros.spec.ts), contrato de alta; [admin.integration.spec.ts](../../../back/tests/admin.integration.spec.ts), «exige nivel de electiva, permite clasificar heredadas y audita su limpieza». |
| BUS-04 | Buscador con envío explícito y limpieza | Escribir no consulta hasta pulsar Buscar; buscar o limpiar conserva filtros y reinicia página. El servicio transporta texto y nivel codificados correctamente. | [materias-filtros.spec.tsx](../../../front/tests/materias-filtros.spec.tsx), «busca explícitamente y limpia texto»; [academic-service.spec.ts](../../../front/tests/academic-service.spec.ts), consulta con `Plan %_` y nivel 4. |
| BUS-05 | Selector dependiente y persistencia | Nivel aparece solo para Electivas; cambiar a obligatoria lo retira del control y de URL. Paginar, abrir detalle y volver conserva texto, año, nivel y página. | [materias-filtros.spec.tsx](../../../front/tests/materias-filtros.spec.tsx), «habilita nivel solo para Electivas» y «conserva texto, nivel y página»; [materia-detalle.spec.tsx](../../../front/tests/materia-detalle.spec.tsx), caso existente de Volver/breadcrumb ampliado. |
| BUS-06 | Validación y navegación del formulario | Elegir Electiva exige nivel antes de enviar; alta envía nivel y vuelve al listado con éxito. Se conserva no enviar una edición sin cambios. | [materias-filtros.spec.tsx](../../../front/tests/materias-filtros.spec.tsx), caso existente «crea electiva y vuelve al listado» ampliado y caso de edición sin cambios. |

## Resultados y límites de validación

- Frontend: 125 pruebas aprobadas en 11 archivos.
- Backend general sin base de integración configurada: 342 pruebas aprobadas, 136 omitidas
  por requisitos de integración. Estas omisiones no se cuentan como cobertura validada.
- Módulo académico con PostgreSQL real aislado: 166 pruebas aprobadas, incluidas 48 de
  integración y 118 unitarias; las de integración cubren BUS-01/BUS-03 y permisos previos.
- Typecheck de código y pruebas de ambas aplicaciones aprobado. Builds backend/frontend
  aprobados. Lint frontend sin errores, con 13 advertencias preexistentes; ningún archivo
  de la ampliación agregó advertencias. `git diff --check` aprobado.
- Migración nueva aplicada en las bases aisladas de integración y navegador. Conservó
  las electivas antiguas con nivel null. No se migraron bases preexistentes del usuario.
- Chrome real, aplicación compilada y backend real: recorridos BUS-04/BUS-05/BUS-06
  aprobados, incluyendo edición 3 → 5 y conversión a obligatoria con historial de limpieza.
  Consola sin errores JavaScript; login y health/ready devuelven HTTP 200.
- Node local 22.17.0; la versión fijada por el proyecto es 22.22.3. Se mantiene esta
  limitación de entorno ya registrada en TASK-024. No se valida SMTP en esta tarea.

Para repetir las pruebas necesarias (configurar primero TEST_DATABASE_URL con una base
de pruebas exclusiva y aplicar todas las migraciones sobre ella):

```powershell
npm run test --workspace=back -- tests/materias-filtros.spec.ts tests/academic.integration.spec.ts tests/admin.integration.spec.ts
npm run test --workspace=front -- materias-filtros materia-detalle academic-service
npm run typecheck --workspace=back
npm run typecheck --workspace=front
```

## Recorrido manual disponible

Se mantienen frontend `http://localhost:3300` y API `http://localhost:3301` levantados,
con las mismas cuentas de estudiante y administrador entregadas para TASK-024. PostgreSQL
aislado utiliza el contenedor `utn-materias-task024`; hay electivas demo de niveles 3 y 5
y doce de nivel 4 para comprobar paginación. No se reemplazaron credenciales ni datos del
entorno previo. Scripts y logs de arranque/verificación permanecen en `.tmp/` ignorado.

1. Como estudiante, abrir Materias, buscar `electiva demo`, elegir Electivas y 4.º Nivel.
   Se ven nueve coincidencias; página 2 muestra tres. Abrir una y volver conserva todo.
2. Cambiar de Electivas a 3.º año: desaparece nivel y se conserva búsqueda. Pulsar
   Limpiar búsqueda elimina solo el texto y vuelve a página 1.
3. Como ADMIN, crear una materia Electiva sin nivel: aparece error y no se crea.
   Elegir 3.er Nivel y guardar: se crea y vuelve al listado con confirmación.
4. Editar esa electiva a 5.º Nivel y luego a materia obligatoria: comprobar detalle
   e historial, incluyendo la limpieza del nivel anterior. Las pantallas mantienen UI mínima.

El usuario confirmó la validación manual de los cambios el 2026-10-22 y autorizó crear
el commit local de la etapa, sin push.
