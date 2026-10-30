# Presentación del detalle administrativo de Experiencias

## Alcance y aceptación

Alinear exclusivamente la presentación del detalle administrativo de comentarios con materias,
profesores y usuarios. Mantener breadcrumb, retorno contextual, Ver comisión, permisos, registros,
actores e historial paginado. No cambiar backend, rutas, diseño global, comentarios públicos ni
operaciones. Sin commit automático ni recorridos en navegador, reservados al desarrollador.

## Decisiones previas

- Reutilizar PageHeader y clases del detalle de materias para ancho máximo, encabezado y tarjetas.
- Mostrar contenido completo y metadatos semánticos agrupados: autor, publicación anónima,
  estado y contexto académico registrado. Valores ausentes explícitos y nombres largos adaptables.
- Usar nombres disponibles en el registro, sin reconstruir ni sustituir snapshots históricos con
  datos actuales. Mantener las referencias internas para enlaces, sin exponerlas como valores UUID.
- Reutilizar UserAudit con kind feedback, que ya admite eliminación, actores, tres columnas e
  historial integrado. Añadir únicamente las etiquetas compartidas de texto/anonimato para que
  sus cambios sean legibles, sin variante local ni ajustes globales de estilo.
- Separar la tarjeta de experiencia del componente de usuarios; conservar su lógica actual y
  evitar solicitudes duplicadas para auditoría. El cargo del docente es el de esta comisión.
- Validar presentación, datos ausentes, anonimato, eliminación, contenido largo, actores y
  paginación, navegación anterior y separación de roles mediante tests de componentes.

## Validación prevista

Tests frontend, tipos, lint y build. Documentar resultado en OVERVIEW y CHANGELOG, actualizar
el frontend del stack para revisión manual si el entorno lo permite. Sin pruebas visuales.

## Implementación y archivos

- `AdminRecordDetail.tsx`: encabezado de materias, acción Ver comisión con icono y auditoría
  compartida; mantiene el contexto de navegación y las operaciones de usuarios.
- `AdminExperienceCard.tsx` y su CSS Module: identidad con iniciales reales y estado, contenido
  completo con saltos de línea y metadatos con dl/dt/dd, etiquetas legibles y ausencias explícitas.
  Conserva los nombres académicos registrados sin reemplazarlos por entidades actuales.
- `UserAudit.tsx`: etiquetas de contenido/anonimato; el contenido histórico se muestra literalmente
  sin confundir las palabras true/false del texto con valores booleanos.
- `admin-experience-presentation.spec.tsx`: doce casos de presentación, estados, datos ausentes,
  anonimato, contenidos extensos, navegación, permisos, actores, historial y paginación.
- `front/OVERVIEW.md` y `CHANGELOG.md`: descripción del cambio y contratos preservados.

## Evidencia de validación

- Pruebas focalizadas: 28 aprobadas entre experiencia, navegación y auditoría.
- Suite frontend completa: 73 archivos, 721 pruebas aprobadas con `--maxWorkers=2`, incluyendo
  regresiones de usuarios, auditoría compartida y retornos contextuales.
- Typecheck de aplicación y tests, ESLint y build de producción mediante Docker aprobados.
- Frontend recreado y saludable en `http://localhost:8080`; 16 comprobaciones HTTP del proxy,
  páginas y protección de API aprobadas, sin modificar volúmenes ni datos.
- Revisión React: presentación separada sin estado adicional, sin solicitudes duplicadas de
  auditoría, datos derivados durante render y permisos existentes conservados.
- No se ejecutó navegador ni se tomaron capturas. Foco del summary y despliegue de historial
  comprobados en jsdom; Enter/Espacio nativos, responsive y aspecto final quedan para revisión
  manual del desarrollador.
- Sin cambios backend, dependencias, commits ni staging.
