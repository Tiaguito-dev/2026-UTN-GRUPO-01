# Experiencias: jerarquía visual y moderación propia

## Alcance

Selector segmentado Comunidad/Mis experiencias; encabezados y filtros del listado; estados
asociados a cada tarjeta propia y aviso previo al contenido del detalle propio. Acciones
voluntarias con textos que distingan su alcance. Reutilizar tokens y componentes existentes.

## Exclusiones y restricciones

Sin backend, contratos, permisos, transiciones, reportes, M1.3, dependencias, commits, push ni
despliegue. Sin cambios de layout, auth, router, hooks ni primitivas globales. No rediseñar
administración ni Inicio. T1–T6 permanecen vigentes.

## Inspección y decisiones previas

- Inicio finalizó: tarea TASK-inicio-ui en finished, commits de412f1 y 268f59b; sesión T6
  01a1ea56-fdee-7120-9c2b-295455f2902a con último turno completed y árbol limpio.
- FeedbackModerationStatus centraliza presentación compacta/extendida: aprobación y causas
  son dimensiones independientes. Nunca mostrar Publicada si existe una causa de ocultamiento.
  Reportes no equivale a rechazo; si el estado real es RECHAZADO no afirmar lo contrario.
- Usar el slot footer existente de ExperienceCard para asociar estado y enlace a la tarjeta
  propia sin cambiar el componente compartido que utiliza Inicio.
- CSS Module local nuevo para selector, filtros y estados; reutilizar Notice, tokens e íconos.
- Conservar botones y endpoints; renombrar la acción cuando hay restricciones concurrentes.
- Validación: caracterización existente, tests de interacción antes de implementar, suite
  frontend, typecheck, lint y build. El usuario reservó posteriormente el navegador, axe
  y la revisión manual a 360/600/1280 para su propia validación; no se ejecutan acá.

## Criterios de aceptación

- Enlaces y filtros mantienen URLs, paginación 9, origen y semántica de navegación.
- Todas las causas simultáneas son legibles; motivo de rechazo seguro; sin identidades ni
  cantidades de reportantes. Aviso de reportes adaptado a listado y detalle.
- Editar/Eliminar, historial y operaciones versionadas conservados. Quitar ocultamiento
  voluntario nunca se anuncia como restitución pública bajo otras restricciones.
- Sin overflow; controles accesibles por teclado, foco visible y texto con contraste.

## Evidencia

- Implementados ExperienciasList, MisExperiencias, FeedbackModerationStatus, FeedbackDetail
  y ExperienciasPresentation.module.css. Documentados en front/OVERVIEW.md y CHANGELOG.md.
- Testing delegado al perfil test según .agents/OVERVIEW.md. Primera caracterización
  existente de moderación: 17/17 aprobadas. Los casos nuevos se escribieron mientras se
  implementaba: primer intento bloqueado por import del CSS aún en creación, siguiente
  47/48 por una espera faltante del fetch de comisión en el test; se corrigió usando
  findByRole. No se afirma un ciclo rojo funcional previo a implementar.
- `npm run test --workspace=front -- experiencias-list.spec.tsx feedback-moderation-components.spec.tsx`:
  56/56 aprobadas. Selector, URLs, teclado, estados, ocho combinaciones de causas,
  motivo seguro, integración en article, aviso antes del contenido, acciones versionadas,
  conflicto y navegación al detalle con origen/página.
- `npm run test --workspace=front -- inicio-ui.spec.tsx feedback-components.spec.tsx`:
  78/78 aprobadas. Total focalizado 134/134; regresión compartida de Inicio conservada.
- Typecheck y lint del workspace front: exit 0. Build de producción: exit 0, Next 16.3.8,
  31 páginas estáticas; API local 3301 configurada solo para ese proceso de compilación.
- `git diff --check`: exit 0. ExperienceCard, FeedPrincipal, FeedPrincipal.module.css,
  InicioSection, estilos compartidos, backend, contratos y dependencias sin diferencias.
- Se actualizaron tres expectativas del recorrido existente moderation.browser.spec.mjs
  para las nuevas etiquetas; no se ejecutó. No se crearon tests/configs nuevos de navegador,
  no se abrió navegador ni se realizaron operaciones con datos reales.
- Dos intentos adicionales de suite completa (comando habitual y maxWorkers=2) no emitieron
  resultados de casos; se interrumpieron sin resumen y no se cuentan aprobados. Causa no
  determinada; log del segundo intento .tmp/experiencias-ui-vitest-bounded.log.
- Revisión React realizada con react-best-practices: composición mediante slot existente,
  sin hooks condicionales, efectos/peticiones nuevas ni estado duplicado; íconos decorativos,
  navegación nativa, textos de acción descriptivos, foco y aria-describedby locales.

## Cierre

Implementación y validación focalizada completadas. Sin regresiones detectadas en los casos
ejecutados; la suite completa no tiene resultado. Responsive efectivo, contraste, axe y
comportamiento de navegador quedan pendientes de validación por el usuario por instrucción
expresa. Sin commits, push ni despliegue. No se continúa con otras pantallas.

## Actualización del stack local solicitada al cierre

- El usuario autorizó reiniciar el stack si era necesario. El frontend usaba una imagen
  anterior a estos cambios: `docker compose -f docker-compose.dev.yml up -d --build
  --no-deps --wait frontend` terminó 0, build y healthcheck satisfactorios.
- Reiniciado proxy para resolver el contenedor recreado; healthcheck satisfactorio.
  Frontend, proxy, backend, postgres y mailpit saludables. Backend y base conservados.
- HTTP GET `/home/experiencias` y `/health` por localhost:8080 respondieron 200.
  Log de compilación `.tmp/experiencias-ui-docker.log`. Sin pruebas de navegador.
