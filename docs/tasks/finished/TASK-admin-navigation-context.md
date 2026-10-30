# Contexto de navegación administrativa

## Alcance y aceptación

Corregir Experiencias → comisión y los accesos existentes a auditoría, profesores y edición.
Conservar filtros y página por URL, breadcrumb contextual, sección activa y retornos compatibles
con las entidades reales. Mantener el recorrido académico y los accesos de estudiantes.
No cambiar permisos, endpoints, operaciones ni diseño. El pedido inicial excluyó commits;
el desarrollador autorizó posteriormente el commit de este ajuste tras validarlo.

## Decisiones previas a implementación

- Reutilizar `returnTo` y los validadores administrativos. El origen de Experiencias es su listado
  canónico; nunca se acumulan detalles de comentarios como historial de navegación.
- Resolver la comisión por sus padres reales cuando falta un origen válido. Un acceso explícito a
  materia/cursada inicia el contexto académico. Compartir la resolución con menú y enlaces.
- La edición iniciada desde detalle regresa a ese mismo detalle al cancelar y guardar, sin anidar
  otra copia de la URL del detalle. Limitar profundidad de validación también en listas anidadas.
- Los profesores pueden regresar a la comisión que los enlazó. Ese contexto es navegación,
  nunca autorización. Los guards y contratos del servidor permanecen vigentes.
- El pedido autoriza cambios acotados al menú y utilidades compartidas de navegación. No se
  modifica autenticación, estructura del shell ni presentación compartida del breadcrumb.
- No existe restauración persistente de scroll del listado; conservar la restauración nativa de
  Next cuando sea posible. Evaluar un ancla de tarjeta si es necesaria sin introducir estado global.

## Validación prevista

Tests enfocados en validación y resolución del contexto, componentes, roles, edición y retornos;
typecheck, lint, suite frontend y build. Playwright sin capturas para el flujo real si el entorno
local lo permite; documentar cualquier impedimento. Actualizar OVERVIEW y CHANGELOG al cierre.

## Resultado y alcance final

- El detalle administrativo de comisión acepta Experiencias como origen explícito. Breadcrumb
  de tres elementos con código real y enlaces al listado con sus filtros/página; menú coherente.
- La misma comisión desde Materias conserva la jerarquía académica, con validación de padres
  contra el registro real. Los enlaces directos/inválidos reconstruyen su padre administrativo.
- Comentarios y profesores cargan la comisión real de origen cuando corresponde; conservan
  la página de comentarios y eliminan de la URL un origen descartado para actualizar el menú.
- La edición de materias, cursadas, comisiones y profesores desde detalle regresa al mismo
  detalle al guardar/cancelar, sin acumular copias del destino. Mensajes de éxito transitorios
  no pasan a los retornos. Materias desde Experiencias inicia su gestión académica explícita.
- Usuarios conserva su listado filtrado también en el breadcrumb. El recorrido de estudiantes
  conserva las rutas y parámetros públicos; no se modificaron guards ni backend.
- El listado de Experiencias tiene orden fijo descendente del servidor, sin parámetro de orden
  configurable. Se conservan sus parámetros existentes de carrera, materia y página.

## Verificación manual y limitaciones

El desarrollador indicó durante la implementación: «los recorridos en navegador los pruebo yo».
No se ejecutó Playwright ni pruebas visuales; los archivos provisionales de navegador se retiraron.
El desarrollador confirmó después que los cambios estaban validados y solicitó el commit
relacionado. La revisión manual quedó a su cargo; el agente no ejecutó recorridos en navegador.

No existe un mecanismo propio de persistencia de scroll en estos listados. Se conserva el
comportamiento nativo de Next/navegador; no se garantiza recuperar la posición exacta mediante
un enlace explícito a Volver. No se agregó almacenamiento global ni un nuevo contrato de URL.

Commit local autorizado tras la validación del desarrollador. Sin push ni cambios de configuración
de infraestructura.

## Archivos de implementación

- `front/src/validations/admin.ts`: saneamiento de retornos y límites de cadenas.
- `front/src/validations/admin-academic-navigation.ts`: resolución compartida por recorrido.
- `front/src/components/home/SidebarNav.tsx`: sección activa contextual por URL.
- `front/src/components/academic/ComisionDetail.tsx`: breadcrumb, retorno, edición y equipo.
- `front/src/components/admin/AdminAcademicDetail.tsx`: profesores, materias y cursadas.
- `front/src/components/admin/AdminRecordDetail.tsx`: comentario y breadcrumb de usuarios.
- `front/src/components/admin/useAdminCommissionOrigin.ts`: padre real y descarte de origen.
- `front/src/components/admin/EditarAcademico.tsx`: guardar/cancelar sin anidar detalles.
- `front/src/components/admin/EditarMateria.tsx` y `MateriaFormPage.tsx`: contexto de materia.
- `front/src/components/feedback/ExperienceCard.tsx` y `ComisionFeedback.tsx`: enlaces de entrada.
- `front/OVERVIEW.md` y `CHANGELOG.md`: contratos y resultados.

Pruebas ajustadas en `front/tests/`: `admin-academic-detail.spec.tsx`,
`admin-academic-navigation.spec.ts`, `admin-cursada-presentation.spec.tsx`,
`admin-materia-form-page.spec.tsx`, `admin-materia-presentation.spec.tsx`,
`admin-profesor-presentation.spec.tsx`, `comision-detalle.spec.tsx`,
`experiencias-list.spec.tsx`, `hu11-editar.spec.tsx`, `navegacion.spec.tsx`.
Nuevas: `admin-record-navigation.spec.tsx` y `admin-invalid-origin.spec.tsx`.

## Evidencia automatizada

- Suite frontend completa: 72 archivos, 709 pruebas aprobadas con `--maxWorkers=2`.
  La primera corrida paralela encontró un timeout por contención con el build; la pasada
  completa posterior sin esa contención aprobó sin ampliar timeouts.
- Pasada focalizada final de comentario, formulario de materia y descarte de origen:
  25 pruebas aprobadas, incluyendo `history.replaceState(null, ...)` y parámetros conservados.
- Typecheck de aplicación y tests aprobado. ESLint sin advertencias. Build local y build
  Docker de frontend aprobados. `git diff --check` sin errores.
- Frontend recreado en Compose, saludable en `http://localhost:8080`; 16 comprobaciones
  HTTP de proxy, páginas y protección de API aprobadas. No se alteraron volúmenes ni datos.
- Ningún cambio backend: no se alteraron endpoints, datos ni autorizaciones.
