# TASK-055: Retomar HU-11 sobre el modelo académico actual

Estado: Finalizada; implementación aprobada por el desarrollador el 2026-10-27
Fecha: 2026-10-26
Rama: feat/hu11-administracion, actualizada a b41b1cd desde origin/desarrollo

## Contexto y objetivo

El desarrollador solicita continuar el CRUD pendiente en su rama. La implementación anterior
(TASK-029 de HU-11, independiente de la TASK-029 de primitivas del otro colaborador) se
conserva en stash `HU11-TASK029-pendiente-antes-commit-Brevo`. No aplicarlo íntegramente:
el modelo y las primitivas cambiaron. Este documento usa un número libre y registra la
adaptación; el respaldo histórico permanece intacto para recuperar comportamiento y pruebas.

Brevo ya se integró en desarrollo (#26) y su flujo se validó en producción con el usuario.
Esta tarea no cambia autenticación, correo ni despliegue productivo.

## Alcance vigente

Completar alta/edición/listado de materias, profesores, cursadas y comisiones, y listado
paginado de usuarios solo consulta. Ya existen las altas y edición/historial de materias;
reutilizar sus implementaciones actuales, sin reemplazar contratos públicos ni modelos.
Roles/CSRF existentes protegen operaciones administrativas, sin bajas ni cambios de activa
o roles. Profesores se asignan por comisión con cargo mediante operaciones ya existentes;
no reintroducir profesorId en Cursada ni nombre libre en Comision.

## Decisiones previas que se conservan

Tablas paginadas con una entidad por fila y acciones a la derecha, sin filas colapsables.
Cursadas seleccionadas por materia y comisiones por cursada. Conservar ids y asociaciones
al editar, auditoría actual de materias sin auditoría nueva. Sin gestión de roles, borrados
ni activación/desactivación de comisión. Preservar contexto al guardar/cancelar y formularios
ante errores; evitar doble envío. Sin nuevas dependencias ni migraciones previstas.

## Decisiones confirmadas antes de implementar

1. Comisión: editar carrera y número (sustituyen el nombre legado), conservando cursada y
   docentes. Mantener carrera entre las ofrecidas por la materia.
2. Cursada: editar materia/año/cuatrimestre sin profesor (el modelo vigente lo eliminó).
   Para cambio de materia con comisiones, bloquear incompatibilidad de carreras, incluidas
   comisiones inactivas no borradas. Conservar ids, comisiones y profesores asignados.
3. Mantener portada administrativa rediseñada y añadir accesos a tablas por rutas propias.

Respuestas del desarrollador registradas antes de código. Auditoría back/front completada.

## Contratos y decisiones de implementación

- GET /profesores/:id nuevo, solo ADMIN. Los GET enriquecidos de cursada y comisión
  conservan permisos y respuestas; PATCH3 nuevo solo ADMIN y parcial estricto no vacío.
  Profesor: nombreCompleto; cursada: materiaId/anio/cuatrimestre; comisión: carrera/numero.
  No reintroducir campos legados ni permitir activa/cursadaId/roles/profesorId.
- Puertos update nuevos y adaptadores devuelven las entidades con contratos actuales,
  incluyendo nombre derivado de comisión y sus docentes. Prechecks y respaldo de unicidad
  SQL traducen duplicados a 409; referencias incompatibles usan error de dominio 400.
- Invariantes concurrentes: creación/edición de comisión y movimiento de cursada bloquean
  Cursada antes de Materia (SHARE); si hay dos materias, ordenarlas por id. Luego bloquear
  Comisión al editarla. Releer datos bajo lock, persistir solo campos incluidos en PATCH.
  ActualizarMateria bloquea Materia UPDATE y revalida antes de quitar carreras con comisiones;
  no bloquea Cursada, para evitar orden inverso. Endurecer estos adaptadores existentes está
  incluido en alcance: sin esto, una carrera podría retirarse entre validación y escritura.
- Tablas en /home/admin/materias, /profesores, /cursadas y /comisiones; Usuarios conserva
  /home/admin/usuarios. Portada conserva composición y cambia accesos Ver todas. Sin listados
  globales nuevos: cursadas exige materia, comisiones materia y cursada, mediante GET anidados.
- Paginación por URL con hooks/primitivas actuales. Materias nueve por defecto, otros veinte.
  Al cambiar padre reiniciar página y limpiar hijo. Guardar/cancelar preserva sección,
  filtros y página; si una cursada cambia materia, vuelve a destino/página1.
- Reutilizar altas actuales y modales donde ya existen, sin remount del listado para recargar;
  refreshKey/propietario del diálogo actual conserva estado. Formularios de edición con datos
  precargados, validación local y de red Zod, manejo de errores y antireenvío existentes.
- Crear helper de contexto interno en validations/admin; destino limitado a listados admin,
  sin redirects externos ni parámetros arbitrarios. Los servicios nuevos validan respuestas.
- Nuevos CSS Modules locales se limitan a tabla/filtros usando tokens existentes; sin nueva
  primitiva global ni cambio de estilos base. Se sigue el uso actual de módulos por área.

## Diseño base y restricciones

- Mantener GET /cursadas/:id y GET /comisiones/:id con sus proyecciones actuales.
- Agregar solo detalles faltantes y PATCH administrativos con validación Zod estricta,
  campos permitidos, referencias activas, unicidad SQL y protección de invariantes en tx.
- Reutilizar primitivas/hooks públicos y esquemas de respuesta actuales; no reintroducir
  componentes anteriores ni aserciones de tipos para omitir validación de red.
- Leer estándares frontend y checklist de pantallas actuales, CSS Modules con tokens.
- Sin tocar layout global, router principal, auth, hooks compartidos, estilos base o ui/;
  cambios solo dentro de módulos administrativos/académicos autorizados y documentación.
- No modificar README, datos productivos, credenciales ni enviar correos reales.
- TDD antes de implementar; no migrar la base de trabajo automáticamente. Integración
  contra base exclusiva de pruebas con modelo vigente y datos ficticios, sin eliminar datos ajenos.

## Criterios y verificación previstos

ADMIN puede crear/editar/listar y navegar HU-04 con cambios persistidos. Usuarios no admite
escrituras. 401/403/CSRF, 400/404/409, duplicados, relaciones/carreras y concurrencia cubiertos.
Tablas semánticas paginadas, formularios precargados y contexto estable, errores/cancelación/
doble envío y roles cubiertos. Suites relevantes, typecheck y lint de ambos, builds y recorrido
real en navegador con cuenta ficticia y base aislada. Evidencia de TDD y checks en esta tarea.
Sin push/PR/merge hasta solicitud; cierre y CHANGELOG tras validación de la implementación.

## Implementación y evidencia (2026-10-27)

Implementación completa; pendiente de revisión funcional del desarrollador antes del cierre
administrativo, commit y publicación. El respaldo HU11 anterior sigue intacto en stash@{0}.

TDD: test_current capturó RED por módulos ausentes (actualizar-profesor y validations/admin)
antes de dar GO a back/front. Luego se verificaron los contratos actuales y los casos negativos.

- Backend: 511 pruebas unitarias aprobadas; 164 integraciones omitidas en la ejecución sin DB.
- PostgreSQL real: 76/76 pruebas académicas/administrativas aprobadas sobre utn_hu11_v2_test,
  incluidas carreras incompatibles, preservación de docentes/cargos, permisos, CSRF y carreras
  entre creación de comisión, movimiento de cursada y retirada de oferta de carrera.
- Frontend: 320/320 aprobadas (307 en suite completa y 13 reintentadas tras suspensión del
  equipo que interrumpió cuatro workers; ningún caso pendiente). Precarga verificada esperando
  el efecto de inicialización local, sin modificar primitivas compartidas.
- Typecheck back/front y lint de código frontend y pruebas modificadas: aprobados.
- Build backend y frontend final: aprobados. Next reintentó prerender tras suspensión del equipo.
- Lint general backend: falla por no-control-regex en back/src/auth/email.config.ts:22,
  archivo preexistente sin cambios en esta tarea. No se modificó autenticación/correo.
- git diff --check: aprobado. No dependencias ni migraciones nuevas; README sin modificaciones.
- Catálogo visual incorpora cuatro tablas administrativas; no se generaron baselines Windows.
  Comparación de imágenes oficial pendiente del entorno Linux establecido por el repositorio.

Recorrido real en navegador sobre API 127.0.0.1:3401 y frontend 127.0.0.1:3400, con DB exclusiva,
cuenta ficticia ADMIN y EMAIL_PROVIDER=smtp hacia Mailpit (sin correos reales):

1. Inicio de sesión y acceso a portada administrativa conservada.
2. Profesor editado desde página 2; retorno a página 2 con datos persistidos.
3. Materia creada desde modal, tabla actualizada sin remount y edición desde página 3 con retorno.
4. Cursada rechaza materia sin Civil, conserva formulario/error; acepta otra materia compatible
   preservando dos comisiones y un docente, y vuelve al filtro destino/página 1.
5. Comisión S-101 editada a S-102 conservando cursada/docente TITULAR; alta S-103 conserva filtros.
6. Cursada 2027/SEGUNDO creada en modal con actualización inmediata del listado.
7. Usuarios en tabla de solo lectura. Datos ficticios persistidos exclusivamente en la DB de QA.

Evidencia local ignorada: .atl/hu11-v2-comisiones.png. Scripts de arranque, fixture y credenciales
ficticias permanecen en .atl ignorado. No se hicieron commits, push, PR ni cambios productivos.

## Ajuste aprobado: cursadas anuales y selector de carreras (2026-10-27)

El desarrollador confirmó agregar Anual al período de cursada y reemplazar los checkbox de
carreras de Materia por un selector de selección múltiple. Se conserva la posibilidad de
ofrecer una materia en varias carreras, sus datos por carrera y el flujo previo de guardado.

Diseño antes de código: conservar nombre API/DB cuatrimestre por compatibilidad y ampliar su
enum con ANUAL. Migración PostgreSQL aditiva ADD VALUE, sin reinterpretar registros actuales.
Crear/editar cursada y esquemas de respuesta aceptan ANUAL; la interfaz dice Período y muestra
Anual + año en listados/detalles/comisiones. Se conserva unicidad materia/año/período, sin
introducir restricciones de coexistencia entre anual y cuatrimestrales. No hay cambios en auth,
router, layout, hooks compartidos ni primitivas globales. Selector nativo multiple local al
formulario de materia, con etiqueta e instrucciones de teclado y estado reactivo existente.
Pruebas RED primero: alta/edición ANUAL, rechazo de valores ajenos, formato y roundtrip BD,
selección de varias carreras y precarga/conservación en edición. Migrar solo la DB QA exclusiva,
regenerar Prisma y recompilar local. No migrar base de trabajo ni producción, no commit/push.

Validación de la ampliación anual/selector (2026-10-27): RED capturado antes de producción
(ANUAL rechazado, formato undefined y selector ausente). GREEN: 77 pruebas backend y 81 front
relevantes; 1 integración HTTP/PostgreSQL de alta/listado/edición ANUAL, sin tocar fixtures ajenas.
Typecheck ambos, lint académico/front/pruebas y build de ambos aprobados. Migración aditiva
20261102000000 aplicada únicamente a utn_hu11_v2_test; base de trabajo y producción sin migrar.
Navegador: alta HU11 Materia 04, Anual 2026 confirmada; materia HU11 Selector múltiple creada con
Sistemas y Civil y confirmada por listado. Evidencia .atl/hu11-selector-carreras.png. Servicios
locales reiniciados con la ampliación; sigue pendiente revisión del desarrollador, sin commit/push.

## Cierre autorizado (2026-10-27)

El desarrollador aprobó el resultado y solicitó commit, push y PR hacia desarrollo.
La evidencia anterior corresponde a las validaciones previas a esa aprobación.
Migración ANUAL incluida; debe ejecutarse en el backend destino antes de usar ANUAL.
Permanece documentado el fallo previo de lint en email.config.ts, fuera del alcance.

## Corrección de CI solicitada (2026-10-27)

El desarrollador reporta backend verify job 122402444037: no-control-regex en email.config.ts22.
Autoriza corregir el bloqueo de la PR30; alcance exclusivo validación de configuración de correo,
sin modificar autenticación ni entrega. Sustituir regex de controles por comparación de códigos
U+0000..U+001F/U+007F conservando trim/rechazo/mensajes y todos los proveedores. Caracterizar
exhaustivamente controles incrustados y límites imprimibles antes del cambio; no hace falta RED
funcional para equivalencia, el RED es lint existente. Validar lint completo y suite de correo,
typecheck y publicar commit correctivo en misma rama/PR. Sin merge.

Resultado corrección CI: 148/148 pruebas de proveedor/Brevo aprobadas tras el cambio;
caracterización previa 118/118. Lint completo backend y typecheck aprobados.
Validación equivalente sin deshabilitar reglas. Commit correctivo en PR30; sin merge.

## Sincronización posterior a PR29 (2026-10-27)

El desarrollador confirmó la integración de PR29 y solicitó corregir nuestra PR30.
Integrar origin/desarrollo 0315dc1 mediante merge sin reescribir historia publicada. Conservar
workflows backend-ci/frontend-ci y documentación CI de PR29; conservar tablas/ANUAL HU11 y la
validación numérica de controles ya probada en f45fa53. Retirar la excepción ESLint de PR29,
innecesaria sobre esa validación, pues falla con unused eslint-disable si se conserva.
Resolver CHANGELOG y back/OVERVIEW concatenando ambos aportes y revisar auto-merge front/OVERVIEW.
No cambiar tests ni comportamiento: ejecutar pruebas de correo y lint/typecheck ambos, y dejar
la PR actualizada con commit merge/push. Sin merge hacia desarrollo ni cambios productivos.

Resolución validada: 148/148 pruebas correo, lint y typecheck completos de ambos workspaces
aprobados. Workflows idénticos a origin/desarrollo; sin marcadores ni archivos sin resolver.
El merge conserva el código email.config.ts exacto de f45fa53, sin la excepción ESLint redundante.
