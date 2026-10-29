# Integración de desarrollo y compatibilidad de pruebas

## Alcance

Integrar origin/desarrollo en hot-fix/ui sin commit ni push. Resolver el conflicto de CHANGELOG conservando ambas ramas. Corregir pruebas de listados y navegación administrativa con fixtures conformes al contrato actual.

## Restricciones y exclusiones

Conservar el documento local TASK-academic-detail-refinement.md y los ajustes actuales. No modificar autenticación, layout, router, hooks compartidos, estilos base ni primitivas globales. No ejecutar navegador, capturas ni pruebas visuales: la validación en navegador queda a cargo del desarrollador. Sin dependencias, migraciones ni cambios de datos reales.

## Decisiones

- Se respeta la decisión funcional de TASK-057: docentes se asignan, actualizan y desvinculan inmediatamente, independientemente del guardado de carrera/número de comisión.
- Los fixtures reconstruyen materia y cursada con sus relaciones reales. No se eliminan pruebas ni se debilitan los controles de paginación, filtros o retorno; las expectativas contemplan la jerarquía administrativa vigente.
- La revisión previa reprodujo 11 fallos también en la rama actual: listados (8), tablas administrativas (1), detalle de comisión (1), edición de cursada (1). Esta evidencia es el estado RED previo a los ajustes.
- El merge se inicia con --no-commit y se deja resuelto para revisión del desarrollador, sin modificar referencias remotas.

## Criterios de aceptación

- Incorporar la gestión docente y preservar navegación contextual, permisos y refresco de auditoría.
- Resolver conflictos sin perder entradas de documentación.
- Suite frontend completa, typecheck y lint aprobados; backend sin regresiones.
- Registrar evidencia y omisiones; proporcionar mensaje Conventional Commits sin ejecutar commit.

## Validaciones

Ejecutar primero las cuatro suites corregidas junto con docentes/asignaciones. Después ejecutar suites completas, typecheck, lint y builds de ambos workspaces. Las integraciones que requieren TEST_DATABASE_URL/SMTP se omiten si no están configuradas; no usar la base de trabajo como reemplazo. Revisar diff, marcadores de conflicto e índice Git.

## Resultado

- Merge de `origin/desarrollo` (`d076872`) aplicado sobre `hot-fix/ui` (`a771397`) con `--no-commit --no-ff`. Único conflicto: CHANGELOG, resuelto conservando ambas entradas. Sin commit ni push.
- Perfil test: fixtures compartidos tipados de materia/cursada, filas de comisión con números válidos y relaciones completas. Los listados esperan la carga del padre; las expectativas comprueban jerarquía, filtros, retorno y página. Se reemplazaron llamadas reales a servicios de padres por mocks.
- Detalle de comisión prueba un origen administrativo compatible con la misma materia/cursada. Edición de cursada comprueba destino completo y reinicio de página. El test de reintento de profesor espera la precarga antes de editar para evitar una carrera.
- GREEN focal: seis suites, 71/71 pruebas aprobadas. Incluye `listados`, `admin-tables`, `comision-detalle`, `hu11-editar`, `hu11-docentes-comisiones` y `admin-assignment-flows`.
- Build backend aprobado; build frontend aprobado con 28 páginas estáticas generadas. Typecheck de código y pruebas aprobado en ambos workspaces. Node 22.22.3 oficial.
- Suite backend: 663 aprobadas, 209 omitidas por configuración de DB/SMTP ausente. No se ejecutaron migraciones ni se modificaron bases reales.
- Checklist react-best-practices aplicada al código integrado: hooks incondicionales, estado sin mutación, control de doble envío, permisos, labels y foco tras confirmación. Sin cambios adicionales de comportamiento o dependencias.
- El documento local `TASK-academic-detail-refinement.md` se conserva intacto. Navegador, capturas y Playwright no ejecutados por indicación expresa; revisión manual a cargo del desarrollador.
- Suite frontend completa: 67 archivos y 588/588 pruebas aprobadas. Lint de ambos workspaces aprobado con cero advertencias. No se deshabilitó ni eliminó ninguna prueba.
- Revisión final: sin marcadores de conflicto ni entradas sin resolver; diff e índice revisados. Se corrigió únicamente una línea vacía adicional al final de la documentación entrante para satisfacer `git diff --check`.
- Ajustes de integración y validación automática terminados. La validación en navegador permanece expresamente a cargo del desarrollador. Merge preparado en el índice, pendiente del commit del desarrollador.
- Mensaje sugerido: `chore(integration): integrar desarrollo y actualizar pruebas de navegación`.
