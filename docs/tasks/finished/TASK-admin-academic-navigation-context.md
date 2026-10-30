# Navegación contextual de materias, cursadas y comisiones

## Alcance
Corregir jerarquía, contexto de origen, destinos Volver y selección lateral en rutas
administrativas de materias, cursadas y comisiones. Inspeccionados Breadcrumb, adminListHref,
safeAdminReturnTo, AdminAcademicList, AdminAcademicDetail, MateriaDetail y ComisionDetail.
No rediseñar tarjetas/auditoría ni cambiar permisos/endpoints. Mantener recorrido global de cursadas.

## Decisiones y restricciones
El breadcrumb se construye desde asociaciones reales y cada nivel tiene href administrativo válido.
`returnTo` sigue siendo la convención para volver a la vista de origen. Añadir validación específica
de rutas/contexto académicos: ruta interna, query allowlist sin duplicados, ids coherentes con el
registro cargado, ciclo invalidado al caer en fallback. No confiar en returnTo para autenticación.
Los enlaces de edición retienen su retorno y los listados bajo un padre retienen el detalle padre.
La selección de sidebar se deriva del pathname/query, centralizada y sin estado volátil.

## Validación
Pruebas unitarias focalizadas para validadores de rutas/contexto, componente de detalle y sidebar;
typecheck y lint frontend. No se realizan pruebas de navegador a pedido del desarrollador, quien
verificará recorrido completo, presentación responsive, recargas y pestañas nuevas. Sin commit.

## Resultado
Typecheck frontend exitoso. 53 pruebas focalizadas exitosas en 4 archivos. Lint frontend exitoso.
Posteriormente se reconstruyó y actualizó el stack local por pedido del desarrollador; todos
los servicios quedaron saludables. La revisión previa al commit corrigió el retorno al detalle
de cursada desde Comisiones y las tildes de su breadcrumb. Commit autorizado posteriormente.
La verificación visual/navegador continúa a cargo del desarrollador.
