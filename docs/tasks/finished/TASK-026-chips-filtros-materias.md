# TASK-026: Presentación de filtros de materias con chips

Fecha: 2026-10-22. Estado: Implementada y verificada.

## Alcance y objetivo

Mejorar únicamente la sección de filtros del listado de materias: agrupar el buscador y
reemplazar los selectores de año y nivel de electiva por chips accesibles y responsive.
Conservar la búsqueda explícita y su limpieza, los contratos existentes y la navegación.

## Exclusiones y restricciones

Sin cambios al backend, resultados, formularios, autenticación, router, layout, hooks
compartidos, estilos base ni componentes globales. Sin dependencias nuevas.
Documentación del módulo y CHANGELOG incluidos. Preservar archivos ajenos preexistentes.

## Decisiones

Usar estilos locales mediante CSS Module y botones nativos con aria-pressed agrupados
con etiquetas accesibles. Primera fila: Todos los años, años 1 a 5 y Electivas. Solo para
Electivas, segunda fila: Todos los niveles y niveles 3, 4 y 5. Una selección por grupo.
Conservar constructores de URL: cambiar filtro reinicia página, conserva búsqueda y
descarta nivel al salir de Electivas. Mantener envío explícito del buscador.

## Criterios de aceptación y validación

- Selección visible y anunciada, uso por teclado y foco visible; chips ajustables en móvil.
- Buscador con etiqueta, Buscar y Limpiar búsqueda; estilos limitados al panel de filtros.
- Año/nivel desde URL, selección, reinicio de página y persistencia conservados.
- Adaptar pruebas de interacción existentes antes de implementar y comprobar su fallo;
  luego ejecutar pruebas frontend pertinentes, typecheck y lint del componente.
- Revisar en navegador desktop/móvil si el entorno local permite acceder; registrar
  evidencia y límites reales. Backend sin cambios: ejecutar pruebas unitarias de filtros.

## Resultado

Panel implementado en MateriasList.tsx con CSS Module local. Se actualizaron las
pruebas existentes del listado; los selectores del formulario administrativo se conservan.

- TDD: tres casos fallaron por ausencia de chips antes de implementar; luego pasaron.
- Frontend: 19 pruebas aprobadas (materias-filtros, materia-detalle, academic-service).
- Backend: 32 pruebas unitarias de filtros aprobadas, sin modificaciones de backend.
- Typecheck de aplicación y tests aprobado; ESLint de componente y pruebas sin avisos.
- git diff --check aprobado (solo aviso de normalización de finales de línea en Windows).
- Chrome real con API y PostgreSQL existentes: búsqueda combinada, selección año/nivel,
  paginación de 9 elementos, detalle y regreso con contexto, limpieza y selección por Enter.
- Inspección visual a 1280 y 390 px; 390 y 320 px sin desbordamiento horizontal.
  Axe sin violaciones serious/critical en los filtros; consola sin errores JavaScript.
- Capturas y script reproducible local en .tmp/materias-chips-* (ignorados por Git).

Para no reemplazar el proceso de producción existente en 3300 se ejecutó Next dev en
3302. El script Playwright adaptó únicamente Origin/CORS hacia la API local de 3301
al origen de pruebas previamente permitido (3300). Las respuestas procedieron de la
API y base reales, sin mock de datos; no se alteró configuración de auth ni CORS.
Esto valida filtros y datos, no un despliegue nuevo ni la política CORS de 3302.
Node local 22.17.0 frente a 22.22.3 fijado por el proyecto; sin nuevas dependencias.
El usuario aprobó esta etapa y autorizó commits y push a desarrollo el 2026-10-22.
Se verificó también el frontend actualizado en 3300 con Chrome, login y API real,
sin adaptación de Origin/CORS: selección de Electivas y chips de nivel correctos.

## Verificación antes de publicar

- Suite frontend completa: 125 pruebas aprobadas; typecheck de aplicación y tests aprobado.
- Verificación backend acotada al módulo académico: 80 pruebas aprobadas en
  materias-filtros, academic.integration y admin.integration, sin omisiones.
- Lint frontend: cero errores y 13 advertencias preexistentes en archivos ajenos al cambio.
- Build de producción frontend aprobado mediante docker compose -f docker-compose.dev.yml
  build frontend, con Node 22.22.3 y salida standalone; imagen dev construida correctamente.
- Las ocho migraciones se aplicaron correctamente en una base PostgreSQL aislada para
  verificación, sin modificar los datos del entorno de navegación del usuario.
- La ejecución general backend detectó 60 fallos asociados al flujo de correo/registro
  y 418 pruebas aprobadas. El usuario confirmó que Mailpit pertenece a una etapa
  pendiente de otro integrante y autorizó publicar los filtros sin resolver ese alcance.
  No se modificó código de correo ni autenticación ni se presenta la suite general como aprobada.
- Los borradores preexistentes .github/ci.yml y TASK-002-definir-CI.md quedan fuera del commit.
